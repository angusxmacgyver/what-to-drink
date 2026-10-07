import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Bottle } from "../types";
import { emptyFilters } from "../types";
import { groupLibrary } from "../lib/library";
import { ExpressionDetail, Library, LibraryCard } from "./Library";

function bottle(overrides: Partial<Bottle>): Bottle {
  return {
    id: "id",
    bottleKey: "ardbeg::spectacular",
    distillery: "Ardbeg",
    bottling: "Spectacular",
    age: "NAS",
    abv: 46,
    status: "Open",
    notes: "",
    tastingNotes: "",
    location: "",
    region: "Islay",
    theme: "",
    flavorFamilies: ["Smoke"],
    subCharacteristics: [],
    atApartment: false,
    country: "Scotland",
    dateEmptied: "",
    smws: null,
    ...overrides,
  };
}

const openBottle = bottle({
  id: "open",
  status: "Open",
  location: "Bar",
  notes: "OPEN-NOTE",
  tastingNotes: "OPEN-TASTE",
});
const closedBottle = bottle({
  id: "closed",
  status: "Closed",
  location: "Crate",
  notes: "CLOSED-NOTE",
  tastingNotes: "CLOSED-TASTE",
});
const hakushu = bottle({
  id: "hakushu",
  bottleKey: "hakushu::12",
  distillery: "Hakushu",
  bottling: "12 Year",
  region: "Japan",
  country: "Japan",
  flavorFamilies: [],
});
const bottles = [closedBottle, openBottle, hakushu];

afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
});

describe("Library layout", () => {
  it("defaults to the list, in distillery then expression order", () => {
    const html = renderToStaticMarkup(
      <Library bottles={bottles} filters={emptyFilters()} onFilters={() => {}} owner={false} />,
    );
    expect(html).toContain('aria-pressed="true">List');
    expect(html).toContain('aria-pressed="false">Grid');
    expect(html).not.toContain("library-card");
    const names = [...html.matchAll(/<strong>([^<]+)<\/strong><em>([^<]+)<\/em>/g)].map((match) => match[1] + " " + match[2]);
    expect(names).toEqual(["Ardbeg Spectacular", "Hakushu 12 Year"]);
  });

  it("opens the grid from the saved choice, with the same order and no code", () => {
    localStorage.setItem("what-to-drink-library-layout", "grid");
    const html = renderToStaticMarkup(
      <Library bottles={bottles} filters={emptyFilters()} onFilters={() => {}} owner={false} />,
    );
    expect(html).toContain('aria-pressed="true">Grid');
    expect(html).not.toContain('class="list"');
    const labels = [...html.matchAll(/aria-label="([^"]+)"/g)].map((match) => match[1]);
    expect(labels).toContain("Ardbeg Spectacular");
    expect(labels).toContain("Hakushu 12 Year");
    expect(labels.indexOf("Ardbeg Spectacular")).toBeLessThan(labels.indexOf("Hakushu 12 Year"));
    expect(html).toContain("Islay · Scotland");
    expect(html).toContain(">Japan<");
    expect(html).not.toContain("Japan · Japan");
    expect(html).toContain(">×2<");
    expect(html).not.toContain("Full code");
    expect(html).not.toContain("CLOSED-NOTE");
  });
});

describe("expression detail", () => {
  const actions = { onEdit: () => {}, onKill: () => {}, onOpen: () => {} };

  it("shows the open bottle once and lists the others as status and location", () => {
    const html = renderToStaticMarkup(
      <ExpressionDetail bottles={[closedBottle, openBottle]} owner={false} />,
    );
    expect(html.match(/bottle-fields/g)).toHaveLength(1);
    expect(html).toContain("OPEN-NOTE");
    expect(html).toContain("OPEN-TASTE");
    expect(html).not.toContain("CLOSED-NOTE");
    expect(html).not.toContain("CLOSED-TASTE");
    expect(html).toContain("Open · Bar");
    expect(html).toContain("Closed · Crate");
    expect(html).not.toContain("Mark open");
  });

  it("puts Mark open, Edit, and Kill on each physical bottle", () => {
    const html = renderToStaticMarkup(
      <ExpressionDetail bottles={[closedBottle, openBottle]} owner {...actions} />,
    );
    const lines = [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((match) => match[1]);
    const open = lines.find((line) => line.includes("Open · Bar"));
    const closed = lines.find((line) => line.includes("Closed · Crate"));
    expect(open).toContain("Edit");
    expect(open).toContain("Kill → Graveyard");
    expect(open).not.toContain("Mark open");
    expect(closed).toContain("Mark open");
    expect(closed).toContain("Edit");
    expect(closed).toContain("Kill → Graveyard");
  });
});

describe("library card", () => {
  it("keeps the full name on the card", () => {
    const [row] = groupLibrary([openBottle, closedBottle]);
    const html = renderToStaticMarkup(<LibraryCard row={row} expanded={false} onToggle={() => {}} />);
    expect(html).toContain('aria-label="Ardbeg Spectacular"');
    expect(html).toContain('title="Ardbeg Spectacular"');
    expect(html).toContain("family-dot");
    expect(html).toContain(">×2<");
  });
});
