import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Bottle } from "../types";
import { emptyFilters } from "../types";
import { groupLibrary } from "../lib/library";
import { BottleFields } from "./BottleFields";
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
    primaryCask: [],
    secondaryCask: [],
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
  theme: "Sweet & Zesty",
  subCharacteristics: ["Honey"],
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
  it("defaults to a list grouped by distillery with section counts", () => {
    const html = renderToStaticMarkup(
      <Library bottles={bottles} filters={emptyFilters()} onFilters={() => {}} onUndo={() => {}} canUndo={false} exact={false} onExact={() => {}} owner={false} />,
    );
    expect(html).toContain('aria-pressed="true">List');
    expect(html).toContain('aria-pressed="false">Grid');
    expect(html).toContain(">Filters<");
    expect(html).not.toContain("SMWS Theme");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("library-card");
    const headings = [...html.matchAll(/<h2>([^<]+)<\/h2>/g)].map((match) => match[1]);
    const expressions = [...html.matchAll(/<em>([^<]+)<\/em>/g)].map((match) => match[1]);
    expect(headings).toEqual(["Ardbeg", "Hakushu"]);
    expect(expressions).toEqual(["Spectacular", "12 Year"]);
    expect(html).toContain("1 expression · 2 bottles");
    expect(html).toContain("1 expression · 1 bottle");
    expect(html).not.toContain("<strong>Ardbeg</strong>");
    expect(html).toContain("<strong><em>Spectacular</em></strong>");
    expect(html).toContain("Age: NAS | ABV: 46%");
    expect(html).toContain('class="theme smws-theme-sweet-zesty"');
  });

  it("shows a shared filter on the page and keeps the controls in the drawer", () => {
    const html = renderToStaticMarkup(
      <Library bottles={bottles} filters={{ ...emptyFilters(), countries: ["USA"] }} onFilters={() => {}} onUndo={() => {}} canUndo={false} exact={false} onExact={() => {}} owner={false} />,
    );
    expect(html).toContain("filters-badge");
    expect(html).toContain(">1<");
    expect(html).toContain('aria-label="Remove USA"');
    expect(html).toContain(">Clear all<");
    expect(html).not.toContain(">Country<");
    expect(html).not.toContain('role="dialog"');
  });

  it("shows which list flavor tags drive the active filters", () => {
    const filters = {
      ...emptyFilters(),
      families: ["Smoke"],
      subs: ["Honey"],
      subFamilies: { Honey: "Smoke" },
    };
    const html = renderToStaticMarkup(
      <Library bottles={bottles} filters={filters} onFilters={() => {}} onUndo={() => {}} canUndo={false} exact={false} onExact={() => {}} owner={false} />,
    );
    const list = html.slice(html.indexOf("distillery-groups"));
    expect(list).not.toContain(">Families<");
    expect(list).toContain(">Characteristics<");
    expect(list).not.toContain('class="tag family');
    expect(list).toContain('class="tag sub family-smoke matched"');
  });

  it("opens a grouped grid with full accessible names and no repeated maker labels", () => {
    localStorage.setItem("what-to-drink-library-layout", "grid");
    const html = renderToStaticMarkup(
      <Library bottles={bottles} filters={emptyFilters()} onFilters={() => {}} onUndo={() => {}} canUndo={false} exact={false} onExact={() => {}} owner={false} />,
    );
    expect(html).toContain('aria-pressed="true">Grid');
    expect(html).not.toContain('class="list"');
    const headings = [...html.matchAll(/<h2>([^<]+)<\/h2>/g)].map((match) => match[1]);
    const labels = [...html.matchAll(/aria-label="([^"]+)"/g)].map((match) => match[1]);
    expect(headings).toEqual(["Ardbeg", "Hakushu"]);
    expect(labels).toContain("Ardbeg Spectacular");
    expect(labels).toContain("Hakushu 12 Year");
    expect(labels.indexOf("Ardbeg Spectacular")).toBeLessThan(labels.indexOf("Hakushu 12 Year"));
    expect(html).not.toContain("card-distillery");
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
    expect(html).toContain('class="tag family family-smoke"');
    expect(html).not.toContain(">Characteristics<");
  });

  it("groups grid characteristics and fills the selected one", () => {
    const html = renderToStaticMarkup(
      <ExpressionDetail
        bottles={[openBottle]}
        owner={false}
        groupedFlavors
        filters={{ ...emptyFilters(), subs: ["Honey"], subFamilies: { Honey: "Smoke" } }}
      />,
    );
    expect(html).toContain(">Characteristics<");
    expect(html).toContain('class="flavor-cluster family-smoke"');
    expect(html).toContain('class="tag sub family-smoke matched"');
    expect(html).not.toContain('class="tag family');
  });

  it("shows primary cask and secondary cask in the Library and Pick a Dram detail", () => {
    const drum = bottle({ primaryCask: ["Ex-bourbon", "Oloroso sherry"], secondaryCask: ["Rum"] });
    for (const factsFirst of [false, true]) {
      const html = renderToStaticMarkup(<ExpressionDetail bottles={[drum]} owner={false} factsFirst={factsFirst} />);
      expect(html).toContain("<dt>Primary cask</dt><dd>Ex-bourbon · Oloroso sherry</dd>");
      expect(html).toContain("<dt>Secondary cask</dt><dd>Rum</dd>");
    }
  });

  it("leaves out cask fields for a bottle with no casks recorded", () => {
    const html = renderToStaticMarkup(<ExpressionDetail bottles={[openBottle]} owner={false} factsFirst />);
    expect(html).not.toContain("Primary cask");
    expect(html).not.toContain("Secondary cask");
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

describe("graveyard bottle fields", () => {
  it("shows a Society bottle's cask tags beside the Society's own descriptions", () => {
    const society = bottle({
      status: "Killed",
      primaryCask: ["Refill ex-bourbon"],
      secondaryCask: ["PX sherry"],
      smws: {
        fullCode: "33.1",
        distilleryNo: "33",
        caskNo: "1",
        flavorProfile: "",
        smwsCask: "Second-fill barrel",
        secondaryMaturation: "Pedro Ximénez hogshead",
        nameIntl: "",
        vintage: "",
        smwsUrl: "",
      },
    });
    const html = renderToStaticMarkup(<BottleFields bottle={society} />);
    expect(html).toContain("<dt>Primary cask</dt><dd>Refill ex-bourbon</dd>");
    expect(html).toContain("<dt>Secondary cask</dt><dd>PX sherry</dd>");
    expect(html).toContain("<dt>SMWS cask</dt><dd>Second-fill barrel</dd>");
    expect(html).toContain("<dt>Secondary maturation</dt><dd>Pedro Ximénez hogshead</dd>");
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
    expect(html).toContain("Age: NAS | ABV: 46%");
  });
});
