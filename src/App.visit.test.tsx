import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { emptyFilters } from "./types";
import { stageFancyVisit } from "./lib/fancy";
import { saveLibraryLayout } from "./lib/store";
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

function libraryPanel() {
  return within(screen.getByRole("heading", { name: "The Library" }).closest("section")!);
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

  describe("a Pick lasts for the visit", () => {
    it("is still marked and expanded after going to the Graveyard and Analytics and back", async () => {
      const user = userEvent.setup();
      render(<App />);

      await goLibrary(user);
      await pickFromDrawer(user);
      await user.click(topNav().getByRole("button", { name: "Graveyard" }));
      await user.click(topNav().getByRole("button", { name: "Analytics" }));
      await goLibrary(user);

      expect(pickedRow()).toHaveClass("open");
      expect(pickedRow()).toHaveTextContent("Your dram · Bottle is at: House shelf");
      expect(screen.getByRole("heading", { name: "Ardbeg" }).closest("section")).toContainElement(pickedRow());
    });

    it("stays marked and expanded when switching to Grid", async () => {
      const user = userEvent.setup();
      render(<App />);

      await goLibrary(user);
      await pickFromDrawer(user);
      await user.click(libraryPanel().getByRole("button", { name: "Grid" }));

      const card = libraryPanel().getByRole("button", { name: "Ardbeg 10. Your dram. Bottle is at: House shelf." });
      expect(card).toHaveAttribute("aria-expanded", "true");
    });

    it("stays marked after the picked bottle is collapsed", async () => {
      const user = userEvent.setup();
      render(<App />);

      await goLibrary(user);
      await pickFromDrawer(user);
      await user.click(within(pickedRow()!).getByRole("button", { expanded: true }));

      expect(pickedRow()).not.toHaveClass("open");
      expect(pickedRow()).toHaveTextContent("Your dram · Bottle is at: House shelf");
    });

    it("is gone after a reload", async () => {
      const user = userEvent.setup();
      const first = render(<App />);

      await goLibrary(user);
      await pickFromDrawer(user);
      first.unmount();
      render(<App />);
      await goLibrary(user);

      expect(libraryPanel().queryByText(/^Your dram · Bottle is at:/)).toBeNull();
    });

    it("with motion, returning scrolls straight to the Pick without replaying the pulse", async () => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn().mockImplementation(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })),
      );
      const user = userEvent.setup();
      render(<App />);

      await goLibrary(user);
      await pickFromDrawer(user);
      await waitFor(() => expect(pickedRow()).toHaveClass("open"), { timeout: 2500 });

      await user.click(topNav().getByRole("button", { name: "Graveyard" }));
      const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
      await goLibrary(user);

      expect(pickedRow()).toHaveClass("open");
      expect(pickedRow()).not.toHaveClass("pick-pulse");
      expect(scroll.mock.contexts).toContain(pickedRow());
      expect(scroll).toHaveBeenCalledWith({ block: "center" });
    });
  });

  describe("the fancy wheel round trip", () => {
    it("with I feel fancy, Pick stages its own pool and the visit, then opens the wheel", async () => {
      const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
      const user = userEvent.setup();
      render(<App />);

      await openFilters(user);
      await pickFlavorFamily(user, "Smoke");
      await user.click(filterDrawer().getByRole("checkbox", { name: "Match exactly" }));
      await user.click(filterDrawer().getByRole("checkbox", { name: "I feel fancy" }));
      await user.click(filterDrawer().getByRole("button", { name: "Pick from 3" }));

      expect(assign).toHaveBeenCalledWith("/fancy/index.html");
      const pool = JSON.parse(sessionStorage.getItem("what-to-drink-fancy-pool")!);
      expect(pool.bottles.map((b: { id: string }) => b.id)).toEqual(["house-smoke", "house-both", "house-closed"]);
      const visit = JSON.parse(sessionStorage.getItem("what-to-drink-fancy-visit")!);
      expect(visit.filters.families).toEqual(["Smoke"]);
      expect(visit.exact).toBe(true);
      expect(libraryPanel().queryByText(/^Your dram · Bottle is at:/)).toBeNull();
    });

    function returnFromWheel(landedId: string | null) {
      stageFancyVisit({ filters: { ...emptyFilters(), place: "apartment", families: ["Smoke"] }, exact: true });
      if (landedId) sessionStorage.setItem("what-to-drink-fancy-result", JSON.stringify({ version: 1, bottleId: landedId }));
    }

    it("comes back to the same visit with the landed bottle revealed as the Pick", async () => {
      returnFromWheel("apt-smoke");
      const user = userEvent.setup();
      render(<App />);

      expect(await screen.findByText("Your dram: Apartment Smoke Flat. Bottle is at: Apartment.")).toBeTruthy();
      expect(pickedRow()).toHaveClass("open");
      expect(libraryPanel().getByRole("button", { name: "Remove Smoke" })).toBeTruthy();
      await openFilters(user);
      expect(filterDrawer().getByRole("button", { name: /^Apartment/, pressed: true })).toBeTruthy();
      expect(filterDrawer().getByRole("checkbox", { name: "Match exactly" })).toBeChecked();
    });

    it("leads a landed closed bottle to the opened bottle of the same expression", async () => {
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
      stageFancyVisit({ filters: { ...emptyFilters(), search: "Pair" }, exact: false });
      sessionStorage.setItem("what-to-drink-fancy-result", JSON.stringify({ version: 1, bottleId: "pair-closed" }));
      render(<App />);

      expect(await screen.findByText("Your dram: Pair 12. Bottle is at: Bar.")).toBeTruthy();
    });

    it("comes back to the same visit with no new Pick when the wheel was left before it landed", async () => {
      returnFromWheel(null);
      render(<App />);

      expect(await libraryPanel().findByRole("button", { name: "Remove Smoke" })).toBeTruthy();
      expect(libraryCountsText()).toBe("1 expressions · 1 bottles");
      expect(libraryPanel().queryByText(/^Your dram · Bottle is at:/)).toBeNull();
    });

    it("does not reveal the result again on a later load", async () => {
      returnFromWheel("apt-smoke");
      const first = render(<App />);
      await screen.findByText("Your dram: Apartment Smoke Flat. Bottle is at: Apartment.");
      first.unmount();
      render(<App />);

      expect(libraryPanel().queryByText(/^Your dram · Bottle is at:/)).toBeNull();
      expect(libraryCountsText()).toBe("5 expressions · 5 bottles");
    });
  });

  it("is the only place to pick: a fresh load opens the Library and nothing else offers a Pick", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: "The Library" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /pick a dram/i })).toBeNull();
  });

  it("returns to the Library from the brand button", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(topNav().getByRole("button", { name: "Graveyard" }));
    await user.click(screen.getByRole("button", { name: "What To Drink" }));

    expect(screen.getByRole("heading", { level: 1, name: "The Library" })).toBeTruthy();
  });
});
