import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Bottle, WheelFamily } from "../types";
import { emptyFilters } from "../types";
import { groupLibrary } from "../lib/library";
import { BottleFields } from "./BottleFields";
import { Graveyard } from "./Graveyard";
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
    wheelFamilies: [],
    wheelSubgroups: [],
    wheelDescriptors: [],
    primaryCask: [],
    secondaryCask: [],
    atApartment: false,
    country: "Scotland",
    dateEmptied: "",
    smws: null,
    drams: [],
    lastThird: false,
    killShot: false,
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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
      <Library bottles={bottles} wheel={[]} filters={emptyFilters()} onFilters={() => {}} onUndo={() => {}} canUndo={false} exact={false} onExact={() => {}} favorLastThird={false} onFavorLastThird={() => {}} pick={null} onPick={() => {}} owner={false} />,
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
      <Library bottles={bottles} wheel={[]} filters={{ ...emptyFilters(), countries: ["USA"] }} onFilters={() => {}} onUndo={() => {}} canUndo={false} exact={false} onExact={() => {}} favorLastThird={false} onFavorLastThird={() => {}} pick={null} onPick={() => {}} owner={false} />,
    );
    expect(html).toContain("filters-badge");
    expect(html).toContain(">1<");
    expect(html).toContain('aria-label="Remove USA"');
    expect(html).toContain(">Clear all<");
    expect(html).not.toContain(">Country<");
    expect(html).not.toContain('role="dialog"');
  });

  it("opens a grouped grid with full accessible names and no repeated maker labels", () => {
    localStorage.setItem("what-to-drink-library-layout", "grid");
    const html = renderToStaticMarkup(
      <Library bottles={bottles} wheel={[]} filters={emptyFilters()} onFilters={() => {}} onUndo={() => {}} canUndo={false} exact={false} onExact={() => {}} favorLastThird={false} onFavorLastThird={() => {}} pick={null} onPick={() => {}} owner={false} />,
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
      <ExpressionDetail bottles={[closedBottle, openBottle]} wheel={[]} owner={false} />,
    );
    expect(html.match(/bottle-fields/g)).toHaveLength(1);
    expect(html).toContain("OPEN-NOTE");
    expect(html).toContain("OPEN-TASTE");
    expect(html).not.toContain("CLOSED-NOTE");
    expect(html).not.toContain("CLOSED-TASTE");
    expect(html).toContain("Open · Bar");
    expect(html).toContain("Closed · Crate");
    expect(html).not.toContain("Mark open");
    expect(html).not.toContain(">Characteristics<");
  });

  it("no longer shows Flavor Families or Sub-Characteristics", () => {
    const html = renderToStaticMarkup(<ExpressionDetail bottles={[openBottle]} wheel={[]} groupedFlavors owner={false} />);
    expect(html).not.toContain("Smoke");
    expect(html).not.toContain("Honey");
  });

  it("groups grid characteristics by Subgroup, in the Family's color", () => {
    const html = renderToStaticMarkup(<ExpressionDetail bottles={[tasted]} wheel={wheel} groupedFlavors owner={false} />);
    expect(html).toContain(">Characteristics<");
    expect(html).toContain('class="flavor-cluster wheel-green" role="group" aria-label="Medicinal"');
    expect(html).toContain('<span class="flavor-cluster-label">Medicinal</span>');
    expect(html).toContain('class="tag wheel-term term-descriptor wheel-green">iodine<');
  });

  it("shows primary cask and secondary cask in the Library detail", () => {
    const drum = bottle({ primaryCask: ["Ex-bourbon", "Oloroso sherry"], secondaryCask: ["Rum"] });
    const html = renderToStaticMarkup(<ExpressionDetail bottles={[drum]} wheel={[]} owner={false} />);
    expect(html).toContain("<dt>Primary cask</dt><dd>Ex-bourbon · Oloroso sherry</dd>");
    expect(html).toContain("<dt>Secondary cask</dt><dd>Rum</dd>");
  });

  it("leaves out cask fields for a bottle with no casks recorded", () => {
    const html = renderToStaticMarkup(<ExpressionDetail bottles={[openBottle]} wheel={[]} owner={false} />);
    expect(html).not.toContain("Primary cask");
    expect(html).not.toContain("Secondary cask");
  });

  it("puts Mark open, Edit, and Kill on each physical bottle", () => {
    const html = renderToStaticMarkup(
      <ExpressionDetail bottles={[closedBottle, openBottle]} wheel={[]} owner {...actions} />,
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

const wheel: WheelFamily[] = [
  { name: "Fruity", color: "Orange", subgroups: [{ name: "Citric", descriptors: ["orange"] }] },
  { name: "Peaty", color: "Green", subgroups: [{ name: "Medicinal", descriptors: ["iodine"] }] },
];
const tasted = bottle({
  id: "tasted",
  wheelFamilies: ["peaty"],
  wheelSubgroups: ["Medicinal"],
  wheelDescriptors: ["IODINE", "raisins"],
});

describe("Flavor Wheel terms", () => {
  it("lists Families, Subgroups, and Descriptors in their Family's color, as the Wheel Glossary writes them", () => {
    const html = renderToStaticMarkup(<ExpressionDetail bottles={[tasted]} wheel={wheel} groupedFlavors owner={false} />);
    expect(html).toContain(">Families<");
    expect(html).toContain('class="tag wheel-term term-family wheel-green">Peaty<');
    expect(html).toContain('<span class="flavor-cluster-label">Medicinal</span>');
    expect(html).toContain('class="tag wheel-term term-descriptor wheel-green">iodine<');
  });

  it("shows Subgroups and Descriptors only in the characteristics, not again in their own lanes", () => {
    const html = renderToStaticMarkup(<ExpressionDetail bottles={[tasted]} wheel={wheel} groupedFlavors owner={false} />);
    expect(html).not.toContain(">Subgroups<");
    expect(html).not.toContain(">Descriptors<");
    expect(html.match(/>iodine</g)).toHaveLength(1);
    expect(html.indexOf(">Families<")).toBeLessThan(html.indexOf(">Characteristics<"));
  });

  it("gathers the terms of every bottle of the expression", () => {
    const backup = { ...closedBottle, wheelFamilies: ["Fruity"], wheelDescriptors: ["orange"] };
    const html = renderToStaticMarkup(
      <ExpressionDetail bottles={[backup, tasted]} wheel={wheel} groupedFlavors owner={false} />,
    );
    expect(html).toContain('wheel-orange">Fruity<');
    expect(html).toContain('wheel-orange">orange<');
    expect(html).toContain('wheel-green">iodine<');
  });

  it("puts an opened list row's details between its title and its characteristics, shown once", () => {
    const html = renderToStaticMarkup(
      <Library bottles={[tasted]} wheel={wheel} filters={emptyFilters()} onFilters={() => {}} onUndo={() => {}} canUndo={false} exact={false} onExact={() => {}} favorLastThird={false} onFavorLastThird={() => {}} pick={tasted} onPick={() => {}} owner={false} />,
    );
    const title = html.indexOf("<strong><em>Spectacular</em></strong>");
    expect(title).toBeGreaterThan(-1);
    expect(html.indexOf("bottle-fields")).toBeGreaterThan(title);
    expect(html.indexOf(">Families<")).toBeGreaterThan(html.indexOf("bottle-fields"));
    expect(html.indexOf(">Characteristics<")).toBeGreaterThan(html.indexOf(">Families<"));
    expect(html.match(/>Characteristics</g)).toHaveLength(1);
  });

  it("puts an opened list row's owner actions after its characteristics", () => {
    const html = renderToStaticMarkup(
      <Library bottles={[tasted]} wheel={wheel} filters={emptyFilters()} onFilters={() => {}} onUndo={() => {}} canUndo={false} exact={false} onExact={() => {}} favorLastThird={false} onFavorLastThird={() => {}} pick={tasted} onPick={() => {}} owner onEdit={() => {}} />,
    );
    expect(html.indexOf(">Edit<")).toBeGreaterThan(html.indexOf(">Characteristics<"));
  });

  it("opens and closes a list row from its characteristics", async () => {
    render(
      <Library bottles={[tasted]} wheel={wheel} filters={emptyFilters()} onFilters={() => {}} onUndo={() => {}} canUndo={false} exact={false} onExact={() => {}} favorLastThird={false} onFavorLastThird={() => {}} pick={null} onPick={() => {}} owner={false} />,
    );
    const row = screen.getByRole("button", { name: /Spectacular/ });
    await userEvent.click(screen.getByText("iodine"));
    expect(row.getAttribute("aria-expanded")).toBe("true");
    await userEvent.click(screen.getByText("iodine"));
    expect(row.getAttribute("aria-expanded")).toBe("false");
  });

  it("shows nothing for a bottle not tasted for the wheel yet", () => {
    const html = renderToStaticMarkup(<ExpressionDetail bottles={[openBottle]} wheel={wheel} owner={false} />);
    expect(html).not.toContain("wheel-term");
  });

  it("shows each list row's Subgroups with their Descriptors in the Family's color, strays last and neutral", () => {
    const html = renderToStaticMarkup(
      <Library bottles={[tasted]} wheel={wheel} filters={emptyFilters()} onFilters={() => {}} onUndo={() => {}} canUndo={false} exact={false} onExact={() => {}} favorLastThird={false} onFavorLastThird={() => {}} pick={null} onPick={() => {}} owner={false} />,
    );
    const clusters = [...html.matchAll(/class="flavor-cluster ([^"]+)"[^>]*><span class="flavor-cluster-label">([^<]+)</g)];
    expect(clusters.map((m) => [m[1], m[2]])).toEqual([
      ["wheel-green", "Medicinal"],
      ["wheel-neutral", "Other"],
    ]);
    expect(html).toContain('class="tag wheel-term term-descriptor wheel-neutral">raisins<');
  });

  it("shows a Graveyard bottle's three levels when it is opened", async () => {
    render(<Graveyard bottles={[{ ...tasted, status: "Killed" }]} wheel={wheel} />);
    await userEvent.click(screen.getByRole("button", { name: /Ardbeg/ }));
    expect(screen.getByText("Peaty").className).toBe("tag wheel-term term-family wheel-green");
    expect(screen.getByText("Medicinal").className).toBe("flavor-cluster-label");
    expect(screen.getByText("iodine").className).toBe("tag wheel-term term-descriptor wheel-green");
    expect(screen.queryByText("Subgroups")).toBeNull();
    expect(screen.queryByText("Flavor families")).toBeNull();
    expect(screen.queryByText("Smoke")).toBeNull();
  });
});

describe("library card", () => {
  it("keeps the full name on the card", () => {
    const [row] = groupLibrary([openBottle, closedBottle]);
    const html = renderToStaticMarkup(<LibraryCard row={row} wheel={[]} expanded={false} onToggle={() => {}} />);
    expect(html).toContain('aria-label="Ardbeg Spectacular"');
    expect(html).toContain('title="Ardbeg Spectacular"');
    expect(html).toContain(">×2<");
    expect(html).toContain("Age: NAS | ABV: 46%");
  });

  it("shows a swatch for each of the expression's Families in its color", () => {
    const [row] = groupLibrary([tasted, { ...closedBottle, wheelFamilies: ["Fruity", "Peaty"] }]);
    const html = renderToStaticMarkup(<LibraryCard row={row} wheel={wheel} expanded={false} onToggle={() => {}} />);
    expect([...html.matchAll(/class="family-dot ([^"]+)" title="([^"]+)"/g)].map((m) => [m[1], m[2]])).toEqual([
      ["wheel-green", "Peaty"],
      ["wheel-orange", "Fruity"],
    ]);
  });
});
