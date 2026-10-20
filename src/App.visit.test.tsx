import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { emptyFilters } from "./types";
import { saveDramSelection, saveLibraryLayout, saveTheme } from "./lib/store";
import { visitCatalog } from "./test/visitCatalog";

function mockDeviceStorage() {
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => local.set(key, value),
    removeItem: (key: string) => local.delete(key),
  });
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => session.set(key, value),
    removeItem: (key: string) => session.delete(key),
  });
}

function seedVisitCatalog() {
  localStorage.setItem("what-to-drink-catalog", JSON.stringify(visitCatalog));
}

function topNav() {
  return within(screen.getByRole("navigation"));
}

function filterDrawer() {
  return within(screen.getByRole("dialog", { name: "Filters" }));
}

async function goLibrary(user: ReturnType<typeof userEvent.setup>) {
  await user.click(topNav().getByRole("button", { name: "The Library" }));
}

async function goPick(user: ReturnType<typeof userEvent.setup>) {
  await user.click(topNav().getByRole("button", { name: "Pick a Dram" }));
}

async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  const panel = screen.getByRole("heading", { level: 1 }).closest("section")!;
  await user.click(within(panel).getByRole("button", { name: /^Filters/ }));
}

async function pickFlavorFamily(user: ReturnType<typeof userEvent.setup>, family: string) {
  await user.click(filterDrawer().getByRole("button", { name: new RegExp(`^${family}`) }));
}

function libraryCountsText() {
  return within(screen.getByRole("heading", { name: "The Library" }).closest("section")!).getByText(
    /\d+ expressions · \d+ bottles/,
  ).textContent;
}

function pickAvailableText() {
  const panel = screen.getByRole("heading", { name: "Pick a Dram" }).closest("section")!;
  const summary = panel.querySelector(".dram-summary");
  if (!summary) return null;
  return within(summary as HTMLElement).getByText(/\d+ available/).textContent;
}

function libraryPanel() {
  return within(screen.getByRole("heading", { name: "The Library" }).closest("section")!);
}

function pickPanel() {
  return within(screen.getByRole("heading", { name: "Pick a Dram" }).closest("section")!);
}

describe("one visit: Library filters and Pick criteria", () => {
  beforeEach(() => {
    mockDeviceStorage();
    seedVisitCatalog();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps a Library filter off Pick criteria and a Pick criterion off Library filters", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goLibrary(user);
    await openFilters(user);
    await pickFlavorFamily(user, "Smoke");
    expect(libraryCountsText()).toBe("4 expressions · 4 bottles");

    await goPick(user);
    expect(pickAvailableText()).toBe("3 available");
    expect(screen.queryByText("Smoke", { selector: ".applied-tray .chip" })).toBeNull();

    await openFilters(user);
    await pickFlavorFamily(user, "Sweet");
    expect(pickAvailableText()).toBe("2 available");

    await goLibrary(user);
    expect(libraryCountsText()).toBe("4 expressions · 4 bottles");
    expect(libraryPanel().getByRole("button", { name: "Remove Smoke" })).toBeTruthy();
  });

  it("remembers each screen's choices when leaving and returning during the visit", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goLibrary(user);
    await openFilters(user);
    await pickFlavorFamily(user, "Smoke");

    await user.click(topNav().getByRole("button", { name: "Graveyard" }));
    await user.click(topNav().getByRole("button", { name: "Analytics" }));
    await user.click(screen.getByRole("button", { name: "What To Drink" }));

    await goLibrary(user);
    expect(libraryCountsText()).toBe("4 expressions · 4 bottles");

    await goPick(user);
    await openFilters(user);
    await pickFlavorFamily(user, "Smoke");
    await goLibrary(user);
    await goPick(user);
    expect(pickAvailableText()).toBe("2 available");
  });

  it("matches every selected Library flavor family and keeps Any/All only on Pick a Dram", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goLibrary(user);
    await openFilters(user);
    await pickFlavorFamily(user, "Smoke");
    await pickFlavorFamily(user, "Sweet");
    expect(libraryCountsText()).toBe("1 expressions · 1 bottles");

    await goPick(user);
    await openFilters(user);
    expect(filterDrawer().getByRole("button", { name: "Any", pressed: false })).toBeTruthy();
    await user.click(filterDrawer().getByRole("button", { name: "Any", pressed: false }));
    await pickFlavorFamily(user, "Smoke");
    await pickFlavorFamily(user, "Sweet");
    expect(pickAvailableText()).toBe("3 available");
  });

  it("remount clears Library filters and Pick criteria and opens Pick on the House with opened in and closed out", async () => {
    const user = userEvent.setup();
    const first = render(<App />);

    await goLibrary(user);
    await openFilters(user);
    await pickFlavorFamily(user, "Smoke");

    await goPick(user);
    await openFilters(user);
    await pickFlavorFamily(user, "Smoke");
    await user.click(screen.getByRole("button", { name: "Switch to apartment" }));

    first.unmount();
    render(<App />);

    await goLibrary(user);
    expect(libraryCountsText()).toBe("5 expressions · 5 bottles");

    await goPick(user);
    expect(screen.queryByText("Are you at the apartment or the house?")).toBeNull();
    expect(screen.getByText(/Randomizer · house/i)).toBeTruthy();
    expect(pickAvailableText()).toBe("3 available");
  });

  it("switching between House and Apartment keeps Pick criteria and drops bottles from the other place", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goPick(user);
    await openFilters(user);
    await pickFlavorFamily(user, "Smoke");
    expect(pickAvailableText()).toBe("2 available");
    expect(pickPanel().getByRole("button", { name: "Ardbeg 10" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Switch to apartment" }));
    expect(pickAvailableText()).toBe("1 available");
    expect(pickPanel().getByRole("button", { name: "Apartment Smoke Flat" })).toBeTruthy();
    expect(pickPanel().queryByRole("button", { name: "Ardbeg 10" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Switch to house" }));
    expect(pickAvailableText()).toBe("2 available");
  });

  it("keeps the Apartment and closed-bottle choices after leaving Pick a Dram", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goPick(user);
    await openFilters(user);
    await user.click(filterDrawer().getByRole("button", { name: "Closed", pressed: false }));
    expect(pickAvailableText()).toBe("4 available");

    await user.click(screen.getByRole("button", { name: "Switch to apartment" }));
    expect(screen.getByText(/Randomizer · apartment/i)).toBeTruthy();

    await goLibrary(user);
    await user.click(screen.getByRole("button", { name: "What To Drink" }));
    await goPick(user);

    expect(screen.getByText(/Randomizer · apartment/i)).toBeTruthy();
    expect(pickAvailableText()).toBe("1 available");
    await openFilters(user);
    expect(filterDrawer().getByRole("button", { name: "Closed", pressed: true })).toBeTruthy();
  });

  it("keeps Library and Pick undo history for the visit until a reload", async () => {
    const user = userEvent.setup();
    const mounted = render(<App />);

    await goLibrary(user);
    await openFilters(user);
    await pickFlavorFamily(user, "Smoke");
    await pickFlavorFamily(user, "Sweet");
    expect(libraryCountsText()).toBe("1 expressions · 1 bottles");

    await user.click(screen.getByRole("button", { name: "What To Drink" }));
    await goLibrary(user);
    await openFilters(user);
    await user.click(filterDrawer().getByRole("button", { name: "Undo last" }));
    expect(libraryCountsText()).toBe("4 expressions · 4 bottles");

    await goPick(user);
    await openFilters(user);
    await pickFlavorFamily(user, "Smoke");
    await pickFlavorFamily(user, "Sweet");
    expect(pickAvailableText()).toBe("1 available");

    await goLibrary(user);
    await goPick(user);
    await openFilters(user);
    await user.click(filterDrawer().getByRole("button", { name: "Undo last" }));
    expect(pickAvailableText()).toBe("2 available");

    await goLibrary(user);
    expect(libraryCountsText()).toBe("4 expressions · 4 bottles");

    mounted.unmount();
    render(<App />);
    await goLibrary(user);
    expect(libraryCountsText()).toBe("5 expressions · 5 bottles");
    await goPick(user);
    expect(pickAvailableText()).toBe("3 available");
    await openFilters(user);
    expect(filterDrawer().getByRole("button", { name: "Undo last" })).toBeDisabled();
  });

  it("ignores a saved Pick selection but restores theme, Library layout, and collapsed sections", async () => {
    saveTheme("light");
    saveLibraryLayout("grid");
    saveDramSelection({
      filters: { ...emptyFilters(), families: ["Smoke"], flavorMatch: "any" },
      place: "apartment",
      includeOpen: false,
      includeClosed: true,
    });
    sessionStorage.setItem("what-to-drink-collapsed-sections", JSON.stringify(["family"]));

    const user = userEvent.setup();
    render(<App />);

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    await goLibrary(user);
    expect(screen.getByRole("button", { name: "Grid", pressed: true })).toBeTruthy();
    expect(libraryCountsText()).toBe("5 expressions · 5 bottles");

    await goPick(user);
    expect(screen.getByText(/Randomizer · house/i)).toBeTruthy();
    expect(pickAvailableText()).toBe("3 available");
    await openFilters(user);
    expect(screen.getByRole("button", { name: "Flavor families", expanded: false })).toBeTruthy();
  });
});
