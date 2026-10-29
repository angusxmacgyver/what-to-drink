import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { emptyFilters } from "./types";
import { saveDramSelection, saveLibraryLayout, saveTheme } from "./lib/store";
import { visitBottle, visitCatalog } from "./test/visitCatalog";

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

async function closeFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard("{Escape}");
}

async function typeSearch(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(filterDrawer().getByPlaceholderText("Distillery, expression, code…"), text);
}

function filtersBadgeCount(panel: ReturnType<typeof within>) {
  const button = panel.getByRole("button", { name: /^Filters/ });
  return button.querySelector(".filters-badge")?.textContent ?? null;
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

  it("treats Library flavor families as alternatives and keeps Any/All only on Pick a Dram", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goLibrary(user);
    await openFilters(user);
    await pickFlavorFamily(user, "Smoke");
    await pickFlavorFamily(user, "Sweet");
    expect(libraryCountsText()).toBe("5 expressions · 5 bottles");
    expect(filterDrawer().queryByRole("button", { name: "Any" })).toBeNull();

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
    expect(libraryCountsText()).toBe("5 expressions · 5 bottles");

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

  // House and Apartment pools are disjoint in the fixture, so only the closing case is covered here.
  it("closes an open Pick when a place switch drops its bottle from the pool", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
    const user = userEvent.setup();
    render(<App />);

    await goPick(user);
    await openFilters(user);
    await typeSearch(user, "Ardbeg");
    await closeFilters(user);
    expect(pickAvailableText()).toBe("1 available");

    await user.click(pickPanel().getByRole("button", { name: "Pour one" }));
    await waitFor(() => expect(pickPanel().getByRole("dialog")).toBeTruthy(), { timeout: 2000 });

    await user.click(screen.getByRole("button", { name: "Switch to apartment" }));
    expect(pickPanel().queryByRole("dialog")).toBeNull();
  });

  it("keeps Library search off Pick criteria and Pick search off Library filters", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goLibrary(user);
    await openFilters(user);
    await typeSearch(user, "Ardbeg");
    await closeFilters(user);
    expect(libraryCountsText()).toBe("1 expressions · 1 bottles");

    await goPick(user);
    expect(pickAvailableText()).toBe("3 available");
    await openFilters(user);
    expect(filterDrawer().getByPlaceholderText("Distillery, expression, code…")).toHaveValue("");
    await closeFilters(user);

    await openFilters(user);
    await typeSearch(user, "Glendronach");
    await closeFilters(user);
    expect(pickAvailableText()).toBe("1 available");

    await goLibrary(user);
    expect(libraryCountsText()).toBe("1 expressions · 1 bottles");
    await openFilters(user);
    expect(filterDrawer().getByPlaceholderText("Distillery, expression, code…")).toHaveValue("Ardbeg");
  });

  it("counts only each screen's own choices on the Filters badge", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goLibrary(user);
    await openFilters(user);
    await pickFlavorFamily(user, "Smoke");
    await closeFilters(user);
    expect(filtersBadgeCount(libraryPanel())).toBe("1");

    await goPick(user);
    await openFilters(user);
    await pickFlavorFamily(user, "Sweet");
    await closeFilters(user);
    expect(filtersBadgeCount(pickPanel())).toBe("1");

    await goLibrary(user);
    expect(filtersBadgeCount(libraryPanel())).toBe("1");
  });

  it("narrows the Library to one Place at a time, shown only in the drawer, and shows the whole cellar again when removed", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
    const user = userEvent.setup();
    render(<App />);

    await goLibrary(user);
    expect(libraryCountsText()).toBe("5 expressions · 5 bottles");

    await openFilters(user);
    await user.click(filterDrawer().getByRole("button", { name: /^House/, pressed: false }));
    expect(libraryCountsText()).toBe("4 expressions · 4 bottles");

    await user.click(filterDrawer().getByRole("button", { name: /^Apartment/, pressed: false }));
    expect(filterDrawer().getByRole("button", { name: /^House/, pressed: false })).toBeTruthy();
    expect(libraryCountsText()).toBe("1 expressions · 1 bottles");
    await closeFilters(user);
    expect(filtersBadgeCount(libraryPanel())).toBe("1");
    expect(libraryPanel().queryByRole("button", { name: "Remove Apartment" })).toBeNull();
    expect(libraryPanel().queryByRole("button", { name: "Clear all" })).toBeNull();

    await openFilters(user);
    await user.click(filterDrawer().getByRole("button", { name: "Remove Apartment" }));
    expect(libraryCountsText()).toBe("5 expressions · 5 bottles");
  });

  it("keeps Place when the Library page's Clear all clears the other filters", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
    const user = userEvent.setup();
    render(<App />);

    await goLibrary(user);
    await openFilters(user);
    await user.click(filterDrawer().getByRole("button", { name: /^House/, pressed: false }));
    await pickFlavorFamily(user, "Sweet");
    expect(libraryCountsText()).toBe("2 expressions · 2 bottles");
    await closeFilters(user);

    await user.click(libraryPanel().getByRole("button", { name: "Clear all" }));
    expect(libraryCountsText()).toBe("4 expressions · 4 bottles");
  });

  it("undoes a Place change and forgets Place on reload", async () => {
    const user = userEvent.setup();
    const mounted = render(<App />);

    await goLibrary(user);
    await openFilters(user);
    await user.click(filterDrawer().getByRole("button", { name: /^House/, pressed: false }));
    await user.click(filterDrawer().getByRole("button", { name: /^Apartment/, pressed: false }));
    await user.click(filterDrawer().getByRole("button", { name: "Undo last" }));
    expect(filterDrawer().getByRole("button", { name: /^House/, pressed: true })).toBeTruthy();
    expect(libraryCountsText()).toBe("4 expressions · 4 bottles");

    mounted.unmount();
    render(<App />);
    await goLibrary(user);
    expect(libraryCountsText()).toBe("5 expressions · 5 bottles");
  });

  it("Match exactly requires every Library choice, stays out of Undo last and off the page, and resets on reload", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
    const user = userEvent.setup();
    const mounted = render(<App />);

    await goLibrary(user);
    await openFilters(user);
    const exactly = () => filterDrawer().getByRole("checkbox", { name: "Match exactly" });
    expect(exactly()).not.toBeChecked();
    await user.click(exactly());
    expect(exactly()).toBeChecked();
    expect(filterDrawer().getByRole("button", { name: "Undo last" })).toBeDisabled();

    await pickFlavorFamily(user, "Smoke");
    await pickFlavorFamily(user, "Sweet");
    expect(libraryCountsText()).toBe("1 expressions · 1 bottles");
    await user.click(exactly());
    await user.click(exactly());

    await user.click(filterDrawer().getByRole("button", { name: "Undo last" }));
    expect(libraryCountsText()).toBe("4 expressions · 4 bottles");
    expect(exactly()).toBeChecked();

    await user.click(filterDrawer().getByRole("button", { name: /^Open/, pressed: false }));
    await user.click(filterDrawer().getByRole("button", { name: /^Closed/, pressed: false }));
    expect(libraryCountsText()).toBe("0 expressions · 0 bottles");
    await user.click(filterDrawer().getByRole("button", { name: "Undo last" }));
    expect(libraryCountsText()).toBe("3 expressions · 3 bottles");

    await closeFilters(user);
    expect(libraryPanel().queryByText(/Match exactly/)).toBeNull();

    await user.click(topNav().getByRole("button", { name: "Graveyard" }));
    await goLibrary(user);
    await openFilters(user);
    expect(exactly()).toBeChecked();

    mounted.unmount();
    render(<App />);
    await goLibrary(user);
    await openFilters(user);
    expect(exactly()).not.toBeChecked();
  });

  it("counts each Library drawer option, dropping as filters are added and following Match exactly", async () => {
    const user = userEvent.setup();
    render(<App />);
    const count = (name: string) =>
      filterDrawer().getByRole("button", { name: new RegExp(`^${name}`) }).querySelector(".option-count")?.textContent;

    await goLibrary(user);
    await openFilters(user);
    expect(count("House")).toBe("4");
    expect(count("Apartment")).toBe("1");
    expect(count("Sweet")).toBe("2");

    await pickFlavorFamily(user, "Smoke");
    expect(count("House")).toBe("3");
    await user.click(filterDrawer().getByRole("button", { name: /^House/ }));
    expect(libraryCountsText()).toBe("3 expressions · 3 bottles");
    expect(count("Sweet")).toBe("2");
    expect(count("Closed")).toBe("1");

    await user.click(filterDrawer().getByRole("checkbox", { name: "Match exactly" }));
    expect(count("Sweet")).toBe("1");
    expect(count("Open")).toBe("2");
    expect(count("Smoke")).toBe("3");
  });

  it("says when nothing matches, flags the most constraining filter, and offers Undo last on the Library page", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
    const user = userEvent.setup();
    render(<App />);

    await goLibrary(user);
    await openFilters(user);
    await user.click(filterDrawer().getByRole("checkbox", { name: "Match exactly" }));
    await user.click(filterDrawer().getByRole("button", { name: /^Closed/ }));
    await pickFlavorFamily(user, "Sweet");
    expect(filterDrawer().getByRole("button", { name: "Remove Closed" })).toHaveTextContent("Most constraining");
    await closeFilters(user);

    expect(libraryCountsText()).toBe("0 expressions · 0 bottles");
    expect(libraryPanel().getByText("No bottles match this combination.")).toBeTruthy();
    expect(libraryPanel().getByRole("button", { name: "Remove Closed" })).toHaveTextContent("Most constraining");

    await user.click(libraryPanel().getByRole("button", { name: "Undo last" }));
    expect(libraryCountsText()).toBe("1 expressions · 1 bottles");
    expect(libraryPanel().queryByText("No bottles match this combination.")).toBeNull();
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

describe("Pick from the Library drawer", () => {
  beforeEach(() => {
    mockDeviceStorage();
    seedVisitCatalog();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function pickFromDrawer(user: ReturnType<typeof userEvent.setup>) {
    await openFilters(user);
    await user.click(filterDrawer().getByRole("button", { name: /^Pick from/ }));
  }

  function pickedRow() {
    return libraryPanel().getByText(/^Your dram · Bottle is at:/).closest("article");
  }

  it("picks a House bottle, closes the drawer, expands and marks it, and re-spins to another", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goLibrary(user);
    await openFilters(user);
    expect(filterDrawer().getByRole("button", { name: "Pick from 4" })).toBeEnabled();
    await user.click(filterDrawer().getByRole("button", { name: "Pick from 4" }));

    expect(screen.queryByRole("dialog", { name: "Filters" })).toBeNull();
    expect(screen.getByText("Your dram: Ardbeg 10. Bottle is at: House shelf.")).toBeTruthy();
    expect(pickedRow()).toHaveClass("open");
    expect(pickedRow()).toHaveTextContent("Your dram · Bottle is at: House shelf");
    expect(libraryCountsText()).toBe("5 expressions · 5 bottles");

    await pickFromDrawer(user);
    expect(screen.getByText("Your dram: Glendronach 12. Bottle is at: House shelf.")).toBeTruthy();
    expect(libraryPanel().getAllByText(/^Your dram · Bottle is at:/)).toHaveLength(1);
  });

  it("marks and expands the Pick in Grid", async () => {
    saveLibraryLayout("grid");
    const user = userEvent.setup();
    render(<App />);

    await goLibrary(user);
    await pickFromDrawer(user);
    const card = libraryPanel().getByRole("button", { name: "Ardbeg 10. Your dram. Bottle is at: House shelf." });
    expect(card).toHaveAttribute("aria-expanded", "true");
  });

  it("picks at the Apartment only when Place is Apartment, and has no pours when nothing at the House is showing", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goLibrary(user);
    await openFilters(user);
    await typeSearch(user, "Apartment");
    expect(libraryCountsText()).toBe("1 expressions · 1 bottles");
    expect(filterDrawer().getByRole("button", { name: "No pours available" })).toBeDisabled();

    await user.click(filterDrawer().getByRole("button", { name: /^Apartment/ }));
    await user.click(filterDrawer().getByRole("button", { name: "Pick from 1" }));
    expect(screen.getByText("Your dram: Apartment Smoke Flat. Bottle is at: Apartment.")).toBeTruthy();
  });

  it("can pick a closed bottle that is showing, and leads an expression to its opened bottle", async () => {
    localStorage.setItem(
      "what-to-drink-catalog",
      JSON.stringify({
        ...visitCatalog,
        bottles: [
          ...visitCatalog.bottles,
          visitBottle({ id: "pair-closed", bottleKey: "pair::12", distillery: "Pair", bottling: "12", status: "Closed", location: "Crate" }),
          visitBottle({ id: "pair-open", bottleKey: "pair::12", distillery: "Pair", bottling: "12", location: "Bar" }),
        ],
      }),
    );
    const user = userEvent.setup();
    render(<App />);

    await goLibrary(user);
    await openFilters(user);
    await typeSearch(user, "Pair");
    await user.click(filterDrawer().getByRole("button", { name: "Pick from 2" }));
    expect(screen.getByText("Your dram: Pair 12. Bottle is at: Bar.")).toBeTruthy();

    await openFilters(user);
    await user.clear(filterDrawer().getByPlaceholderText("Distillery, expression, code…"));
    await typeSearch(user, "Closed Backup");
    await user.click(filterDrawer().getByRole("button", { name: "Pick from 1" }));
    expect(screen.getByText("Your dram: Closed Backup Backup. Bottle is at: House shelf.")).toBeTruthy();
  });

  it("says a blank location is not tagged yet, and keeps the mark when another row is opened", async () => {
    localStorage.setItem(
      "what-to-drink-catalog",
      JSON.stringify({
        ...visitCatalog,
        bottles: [
          visitBottle({ id: "untagged", bottleKey: "aaa::untagged", distillery: "Aaa", bottling: "Untagged", location: "" }),
          ...visitCatalog.bottles,
        ],
      }),
    );
    const user = userEvent.setup();
    render(<App />);

    await goLibrary(user);
    await pickFromDrawer(user);
    expect(pickedRow()).toHaveTextContent("Your dram · Bottle is at: not tagged yet");

    const ardbeg = within(screen.getByRole("heading", { name: "Ardbeg" }).closest("section")!);
    await user.click(ardbeg.getByRole("button", { expanded: false }));
    expect(ardbeg.getByRole("button", { expanded: true })).toBeTruthy();
    expect(pickedRow()).toHaveTextContent("Your dram · Bottle is at: not tagged yet");
    expect(pickedRow()).not.toHaveClass("open");
  });

  it("clears the Pick when a filter hides it and keeps the filters after picking", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goLibrary(user);
    await openFilters(user);
    await pickFlavorFamily(user, "Smoke");
    await user.click(filterDrawer().getByRole("button", { name: "Pick from 3" }));
    expect(libraryPanel().getByRole("button", { name: "Remove Smoke" })).toBeTruthy();
    expect(pickedRow()).toHaveTextContent("Your dram");

    await user.click(libraryPanel().getByRole("button", { name: "Remove Smoke" }));
    expect(pickedRow()).toHaveTextContent("Your dram");

    await openFilters(user);
    await pickFlavorFamily(user, "Sweet");
    expect(libraryPanel().queryByText(/^Your dram · Bottle is at:/)).toBeNull();
    await user.click(filterDrawer().getByRole("button", { name: "Remove Sweet" }));
    expect(libraryPanel().queryByText(/^Your dram · Bottle is at:/)).toBeNull();
  });

  it("with motion, scrolls to the Pick and pulses it before expanding and marking it", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })),
    );
    const user = userEvent.setup();
    render(<App />);

    await goLibrary(user);
    await pickFromDrawer(user);
    const ardbeg = screen.getByRole("heading", { name: "Ardbeg" }).closest("section")!.querySelector("article")!;
    expect(screen.queryByRole("dialog", { name: "Filters" })).toBeNull();
    expect(ardbeg).not.toHaveClass("open");

    await waitFor(() => expect(ardbeg).toHaveClass("pick-pulse"), { timeout: 1500 });
    expect(ardbeg).not.toHaveClass("open");
    expect(libraryPanel().queryByText(/^Your dram · Bottle is at:/)).toBeNull();

    await waitFor(() => expect(ardbeg).toHaveClass("open"), { timeout: 1500 });
    expect(ardbeg).not.toHaveClass("pick-pulse");
    expect(ardbeg).toHaveTextContent("Your dram · Bottle is at: House shelf");
    expect(screen.getByText("Your dram: Ardbeg 10. Bottle is at: House shelf.")).toBeTruthy();
  });
});
