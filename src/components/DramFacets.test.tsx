import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyFilters, type Bottle, type FilterState } from "../types";
import { DramFacets } from "./DramFacets";

afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
  const session = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => session.set(key, value),
    removeItem: (key: string) => session.delete(key),
  });
});

function bottle(overrides: Partial<Bottle> = {}): Bottle {
  return {
    id: "id",
    bottleKey: "k",
    distillery: "Ardbeg",
    bottling: "10",
    age: 12,
    abv: 46,
    status: "Open",
    notes: "",
    tastingNotes: "",
    location: "",
    region: "",
    theme: "",
    flavorFamilies: [],
    subCharacteristics: [],
    atApartment: false,
    country: "",
    dateEmptied: "",
    smws: null,
    ...overrides,
  };
}

function render(bottles: Bottle[], filters: FilterState = emptyFilters(), includeClosed = false, includeOpen = true) {
  return renderToStaticMarkup(
    <DramFacets
      bottles={bottles}
      place="house"
      includeOpen={includeOpen}
      onIncludeOpen={() => {}}
      includeClosed={includeClosed}
      onIncludeClosed={() => {}}
      filters={filters}
      onChange={() => {}}
    />,
  );
}

describe("DramFacets", () => {
  const places = [
    bottle({ country: "Scotland", region: "Islay", theme: "Peated" }),
    bottle({ id: "mac", distillery: "Macallan", country: "Scotland", region: "Speyside", theme: "Sherry" }),
    bottle({ id: "yama", distillery: "Yamazaki", country: "Japan", region: "Honshu" }),
    bottle({ id: "dead", distillery: "Springbank", country: "Scotland", region: "Campbeltown", status: "Killed" }),
    bottle({ id: "sealed", distillery: "Glenlivet", country: "Scotland", region: "Speyside", theme: "Sealed", status: "Closed" }),
  ];

  it("asks for a country, then lists only regions of multi-region countries", () => {
    const idle = render(places);
    expect(idle).toContain("Select a country to narrow by region.");
    expect(idle).not.toContain(">Islay<");
    expect(idle).not.toContain(">Honshu<");

    const japan = render(places, { ...emptyFilters(), countries: ["Japan"] });
    expect(japan).not.toContain("Select a country to narrow by region.");
    expect(japan).not.toContain(">Honshu<");

    const scotland = render(places, { ...emptyFilters(), countries: ["Scotland"] });
    const group = scotland.split('option-section-toggle" aria-expanded="true">Scotland<')[1];
    const regions = group.slice(0, group.indexOf("option-section"));
    expect(regions).toContain(">Islay<");
    expect(regions).toContain(">Speyside<");
    expect(scotland).not.toContain(">Campbeltown<");
    expect(scotland).not.toContain(">Honshu<");
  });

  it("groups sub-characteristics under each picked family", () => {
    const bottles = [
      bottle({
        flavorFamilies: ["Smoke", "Sweet"],
        subCharacteristics: ["Woodsmoke & Campfire", "Honey", "Brand New Tag"],
      }),
    ];
    const idle = render(bottles);
    expect(idle).toContain("Pick a flavor family to narrow by sub-characteristic.");
    expect(idle).not.toContain("Honey");
    expect(idle).not.toContain("Brand New Tag");

    const sweet = render(bottles, { ...emptyFilters(), families: ["Sweet"] });
    const after = sweet.split('option-section-toggle" aria-expanded="true">Sweet<')[1];
    const group = after.slice(0, after.indexOf("option-section"));
    expect(group).toContain("Honey");
    expect(group).not.toContain("Brand New Tag");
    expect(sweet).not.toContain("Woodsmoke");
    expect(sweet).toContain('option-section-toggle" aria-expanded="true">Other<');
  });

  it("keeps a zero count selectable and treats closed bottles as unopened", () => {
    const narrowed = render(places, { ...emptyFilters(), regions: ["Speyside"], countries: ["Scotland"] });
    expect(narrowed).toContain('>Peated</span><span class="option-count">0<');
    expect(narrowed).not.toContain("disabled");
    const idle = render(places);
    expect(idle.indexOf(">Opened<")).toBeLessThan(idle.indexOf(">Search<"));
    expect(idle).toContain('aria-pressed="true">Opened');
    expect(idle).toContain('aria-pressed="false">Closed');
    expect(idle).not.toContain(">Sealed<");
    expect(idle).not.toContain("Include unopened bottles");
    expect(render(places, emptyFilters(), true)).toContain(">Sealed<");
    expect(render(places, emptyFilters(), true, false)).not.toContain(">Peated<");
    expect(render(places)).toContain(">Age<");
    expect(render(places)).toContain(">ABV<");
    expect(render(places)).toContain('aria-label="Flavor match"');
  });
});
