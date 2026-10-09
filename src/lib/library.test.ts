import { describe, expect, it } from "vitest";
import { emptyFilters, type Bottle } from "../types";
import {
  detailBottle,
  distilleryCounts,
  dramCandidates,
  facetCounts,
  groupLibrary,
  matchesFilters,
  matchesStatus,
  originLabel,
  subOwnerFamily,
  subsForFamilies,
  withoutRange,
} from "./library";

let nextId = 0;

function bottle(overrides: Partial<Bottle> = {}): Bottle {
  nextId += 1;
  return {
    id: `id-${nextId}`,
    bottleKey: "ardbeg::10",
    distillery: "Ardbeg",
    bottling: "10",
    age: 10,
    abv: 46,
    status: "Open",
    notes: "",
    tastingNotes: "",
    location: "",
    region: "Islay",
    theme: "",
    flavorFamilies: [],
    subCharacteristics: [],
    atApartment: false,
    country: "Scotland",
    dateEmptied: "",
    smws: null,
    ...overrides,
  };
}

describe("subsForFamilies", () => {
  const bottles = [
    bottle({ flavorFamilies: ["Peaty", "Fruity"], subCharacteristics: ["Smoke", "Apple"] }),
    bottle({ flavorFamilies: ["Peaty"], subCharacteristics: ["Tar", "Smoke"] }),
    bottle({ flavorFamilies: ["Fruity"], subCharacteristics: ["Pear", ""] }),
  ];

  it("returns nothing when no family is picked", () => {
    expect(subsForFamilies(bottles, [])).toEqual([]);
  });

  it("lists sorted, unique subs from bottles with the family", () => {
    expect(subsForFamilies(bottles, ["Peaty"])).toEqual(["Apple", "Smoke", "Tar"]);
  });

  it("requires every picked family on the bottle", () => {
    expect(subsForFamilies(bottles, ["Peaty", "Fruity"])).toEqual(["Apple", "Smoke"]);
  });

  it("drops blank subs", () => {
    expect(subsForFamilies(bottles, ["Fruity"])).toEqual(["Apple", "Pear", "Smoke"]);
  });

  it("narrows to subs owned by the picked family, even if the bottle has other tagged subs", () => {
    const owned = [
      bottle({
        flavorFamilies: ["Wood", "Sweet"],
        subCharacteristics: ["Toasted & Charred Oak", "Honey"],
      }),
    ];
    expect(subsForFamilies(owned, ["Wood"])).toEqual(["Toasted & Charred Oak"]);
  });

  it("includes subs owned by any of several picked families", () => {
    const owned = [
      bottle({
        flavorFamilies: ["Wood", "Smoke", "Sweet"],
        subCharacteristics: ["Toasted & Charred Oak", "Woodsmoke & Campfire", "Honey"],
      }),
    ];
    expect(subsForFamilies(owned, ["Wood", "Smoke"])).toEqual(["Toasted & Charred Oak", "Woodsmoke & Campfire"]);
  });

  it("keeps a sub with no curated owner visible regardless of which family is picked", () => {
    const uncurated = [bottle({ flavorFamilies: ["Wood"], subCharacteristics: ["Brand New Tag"] })];
    expect(subsForFamilies(uncurated, ["Wood"])).toEqual(["Brand New Tag"]);
  });
});

describe("subOwnerFamily", () => {
  it("returns the curated family for a known sub-characteristic", () => {
    expect(subOwnerFamily("Woodsmoke & Campfire")).toBe("Smoke");
    expect(subOwnerFamily("Honey")).toBe("Sweet");
  });

  it("returns undefined for an uncurated sub-characteristic", () => {
    expect(subOwnerFamily("Brand New Tag")).toBeUndefined();
  });
});

describe("distilleryCounts", () => {
  it("counts physical bottles per distillery", () => {
    const bottles = [
      bottle({ distillery: "Ardbeg" }),
      bottle({ distillery: "Ardbeg" }),
      bottle({ distillery: "Lagavulin" }),
    ];
    expect(distilleryCounts(bottles)).toEqual({ Ardbeg: 2, Lagavulin: 1 });
  });
});

describe("matchesStatus", () => {
  it("keeps every bottle when no status is picked", () => {
    expect(matchesStatus(bottle({ status: "Closed" }), [])).toBe(true);
  });

  it("keeps only bottles with a picked status", () => {
    expect(matchesStatus(bottle({ status: "Open" }), ["Open"])).toBe(true);
    expect(matchesStatus(bottle({ status: "Closed" }), ["Open"])).toBe(false);
    expect(matchesStatus(bottle({ status: "Closed" }), ["Open", "Closed"])).toBe(true);
  });
});

describe("matchesFilters ABV", () => {
  const filters = { ...emptyFilters(), abvMin: "40", abvMax: "50" };

  it("keeps a blank ABV and the bottles on the ends of the range", () => {
    expect(matchesFilters(bottle({ abv: null }), filters)).toBe(true);
    expect(matchesFilters(bottle({ abv: 40 }), filters)).toBe(true);
    expect(matchesFilters(bottle({ abv: 50 }), filters)).toBe(true);
    expect(matchesFilters(bottle({ abv: 55.3 }), filters)).toBe(false);
  });
});

describe("matchesFilters age", () => {
  it("keeps every age when the range is unset and NAS is on", () => {
    const filters = emptyFilters();
    expect(matchesFilters(bottle({ age: "NAS" }), filters)).toBe(true);
    expect(matchesFilters(bottle({ age: null }), filters)).toBe(true);
    expect(matchesFilters(bottle({ age: 12 }), filters)).toBe(true);
  });

  it("keeps NAS and blank ages inside a narrowed range while NAS stays on", () => {
    const filters = { ...emptyFilters(), ageMin: "12", ageMax: "18" };
    expect(matchesFilters(bottle({ age: "NAS" }), filters)).toBe(true);
    expect(matchesFilters(bottle({ age: null }), filters)).toBe(true);
    expect(matchesFilters(bottle({ age: 12 }), filters)).toBe(true);
    expect(matchesFilters(bottle({ age: 18 }), filters)).toBe(true);
    expect(matchesFilters(bottle({ age: 10 }), filters)).toBe(false);
  });

  it("drops NAS and blank ages when the toggle is off, and still keeps numeric ages in range", () => {
    const narrowed = { ...emptyFilters(), ageMin: "12", ageMax: "18", includeNas: false };
    expect(matchesFilters(bottle({ age: "NAS" }), narrowed)).toBe(false);
    expect(matchesFilters(bottle({ age: null }), narrowed)).toBe(false);
    expect(matchesFilters(bottle({ age: 12 }), narrowed)).toBe(true);
    expect(matchesFilters(bottle({ age: 21 }), narrowed)).toBe(false);

    const nasOff = { ...emptyFilters(), includeNas: false };
    expect(matchesFilters(bottle({ age: "NAS" }), nasOff)).toBe(false);
    expect(matchesFilters(bottle({ age: null }), nasOff)).toBe(false);
    expect(matchesFilters(bottle({ age: 12 }), nasOff)).toBe(true);
  });
});

describe("groupLibrary", () => {
  it("groups bottles sharing a bottleKey into one row with stock", () => {
    const bottles = Array.from({ length: 5 }, () => bottle({ bottleKey: "ardbeg::cask-strength-10" }));
    const rows = groupLibrary(bottles);
    expect(rows).toHaveLength(1);
    expect(rows[0].stock).toBe(5);
  });

  it("sorts rows by distillery, then bottling", () => {
    const rows = groupLibrary([
      bottle({ bottleKey: "lagavulin::16", distillery: "Lagavulin", bottling: "16" }),
      bottle({ bottleKey: "ardbeg::uigeadail", distillery: "Ardbeg", bottling: "Uigeadail" }),
      bottle({ bottleKey: "ardbeg::10", distillery: "Ardbeg", bottling: "10" }),
    ]);
    expect(rows.map((r) => r.bottleKey)).toEqual(["ardbeg::10", "ardbeg::uigeadail", "lagavulin::16"]);
  });

  it("labels age and ABV as mixed when bottles in a row differ", () => {
    const [row] = groupLibrary([bottle({ age: 10, abv: 46 }), bottle({ age: 12, abv: 57.1 })]);
    expect(row.ageLabel).toBe("mixed");
    expect(row.abvLabel).toBe("mixed");
  });
});

describe("originLabel", () => {
  it("shows region and country once when they are the same", () => {
    expect(originLabel("Japan", "Japan")).toBe("Japan");
  });

  it("shows both when they differ", () => {
    expect(originLabel("Islay", "Scotland")).toBe("Islay · Scotland");
  });

  it("shows whichever side is present", () => {
    expect(originLabel("Islay", " ")).toBe("Islay");
    expect(originLabel("", "USA")).toBe("USA");
  });
});

describe("matchesFilters flavor match", () => {
  const peat = bottle({ flavorFamilies: ["Smoke"], subCharacteristics: ["Woodsmoke & Campfire"] });
  const sweet = bottle({ flavorFamilies: ["Sweet"], subCharacteristics: ["Honey"] });
  const both = bottle({
    flavorFamilies: ["Smoke", "Sweet"],
    subCharacteristics: ["Woodsmoke & Campfire", "Honey"],
  });

  it("keeps a bottle that has every picked family and sub when the mode is all", () => {
    const filters = {
      ...emptyFilters(),
      flavorMatch: "all" as const,
      families: ["Smoke", "Sweet"],
      subs: ["Woodsmoke & Campfire", "Honey"],
    };
    expect(matchesFilters(both, filters)).toBe(true);
    expect(matchesFilters(peat, filters)).toBe(false);
    expect(matchesFilters(sweet, filters)).toBe(false);
  });

  it("keeps a bottle that has any picked family and any picked sub when the mode is any", () => {
    const filters = {
      ...emptyFilters(),
      flavorMatch: "any" as const,
      families: ["Smoke", "Sweet"],
      subs: ["Honey"],
    };
    expect(matchesFilters(peat, filters)).toBe(false);
    expect(matchesFilters(sweet, filters)).toBe(true);
    expect(matchesFilters(both, filters)).toBe(true);
  });
});

describe("dramCandidates", () => {
  const open = bottle({ id: "open", status: "Open", atApartment: false });
  const closed = bottle({ id: "closed", status: "Closed", atApartment: false });
  const killed = bottle({ id: "killed", status: "Killed", atApartment: false });
  const emptied = bottle({ id: "emptied", status: "empty", atApartment: false });
  const apartment = bottle({ id: "apartment", status: "Open", atApartment: true });

  it("keeps open house bottles and drops the apartment, killed, and empty bottles", () => {
    expect(dramCandidates([open, closed, killed, emptied, apartment], "house", false).map((b) => b.id)).toEqual([
      "open",
    ]);
  });

  it("adds closed bottles only when asked, and open bottles only while opened is on", () => {
    expect(dramCandidates([open, closed, killed, emptied], "house", true).map((b) => b.id)).toEqual([
      "open",
      "closed",
    ]);
    expect(dramCandidates([open, closed], "house", true, false).map((b) => b.id)).toEqual(["closed"]);
    expect(dramCandidates([open, closed], "house", false, false)).toEqual([]);
  });

  it("keeps the apartment pool on its own", () => {
    expect(dramCandidates([open, apartment], "apartment", false).map((b) => b.id)).toEqual(["apartment"]);
  });
});

describe("facetCounts", () => {
  const islay = bottle({ id: "islay", distillery: "Ardbeg", region: "Islay", theme: "Peated" });
  const speyside = bottle({ id: "speyside", distillery: "Glenfiddich", region: "Speyside", theme: "Sweet" });
  const secondIslay = bottle({ id: "second-islay", distillery: "Lagavulin", region: "Islay", theme: "Peated" });

  it("counts an option from the other active facets, ignoring picks in its own facet", () => {
    const filters = { ...emptyFilters(), regions: ["Speyside"], themes: ["Peated"] };
    expect(facetCounts([islay, speyside, secondIslay], "house", false, filters, "region", ["Islay", "Speyside"])).toEqual(
      { Islay: 2, Speyside: 0 },
    );
  });

  it("drops bottles outside the candidate set", () => {
    const killed = bottle({ id: "killed", status: "Killed", region: "Islay", theme: "Peated" });
    const closed = bottle({ id: "closed", status: "Closed", region: "Islay", theme: "Peated" });
    const away = bottle({ id: "away", atApartment: true, region: "Islay", theme: "Peated" });
    const filters = { ...emptyFilters(), themes: ["Peated"] };
    expect(
      facetCounts([islay, killed, closed, away], "house", false, filters, "region", ["Islay"]).Islay,
    ).toBe(1);
    expect(
      facetCounts([islay, closed], "house", true, filters, "region", ["Islay"]).Islay,
    ).toBe(2);
  });

  it("applies flavor any or all on the facets that stay active", () => {
    const peat = bottle({ region: "Islay", flavorFamilies: ["Smoke"] });
    const sweet = bottle({ region: "Islay", flavorFamilies: ["Sweet"] });
    const both = bottle({ region: "Speyside", flavorFamilies: ["Smoke", "Sweet"] });
    const families = ["Smoke", "Sweet"];
    const options = ["Islay", "Speyside"];
    expect(
      facetCounts([peat, sweet, both], "house", false, { ...emptyFilters(), flavorMatch: "all", families }, "region", options),
    ).toEqual({ Islay: 0, Speyside: 1 });
    expect(
      facetCounts([peat, sweet, both], "house", false, { ...emptyFilters(), flavorMatch: "any", families }, "region", options),
    ).toEqual({ Islay: 2, Speyside: 1 });
  });

  it("returns zero for an option no candidate has", () => {
    expect(facetCounts([islay], "house", false, emptyFilters(), "distillery", ["Bowmore"])).toEqual({ Bowmore: 0 });
  });

  it("counts a few thousand bottles inside the time budget", () => {
    const bottles = Array.from({ length: 2000 }, (_, index) =>
      bottle({
        distillery: index % 2 === 0 ? "Ardbeg" : "Lagavulin",
        region: "Islay",
      }),
    );
    const started = performance.now();
    const counts = facetCounts(bottles, "house", false, emptyFilters(), "distillery", [
      "Ardbeg",
      "Lagavulin",
      "Bowmore",
    ]);
    expect(performance.now() - started).toBeLessThan(100);
    expect(counts).toEqual({ Ardbeg: 1000, Lagavulin: 1000, Bowmore: 0 });
  });
});

describe("withoutRange", () => {
  const smoky12 = bottle({ age: 12, abv: 46, flavorFamilies: ["Smoke"] });
  const smoky25 = bottle({ age: 25, abv: 58, flavorFamilies: ["Smoke"] });
  const smokyNas = bottle({ age: "NAS", abv: 50, flavorFamilies: ["Smoke"] });
  const sweet18 = bottle({ age: 18, abv: 43, flavorFamilies: ["Sweet"] });
  const all = [smoky12, smoky25, smokyNas, sweet18];
  const filters = {
    ...emptyFilters(),
    families: ["Smoke"],
    ageMin: "10",
    ageMax: "14",
    includeNas: false,
    abvMin: "44",
    abvMax: "48",
  };

  it("keeps bottles outside the age brush and NAS, and drops what another facet excludes", () => {
    const pool = all.filter((b) => matchesFilters(b, withoutRange(filters, "age")));
    expect(pool).toEqual([smoky12]);
    const loose = { ...filters, abvMin: "", abvMax: "" };
    expect(all.filter((b) => matchesFilters(b, withoutRange(loose, "age")))).toEqual([smoky12, smoky25, smokyNas]);
  });

  it("lifts only the ABV range for the ABV histogram", () => {
    const pool = all.filter((b) => matchesFilters(b, withoutRange(filters, "abv")));
    expect(pool).toEqual([smoky12]);
    const anyAge = { ...filters, ageMin: "", ageMax: "", includeNas: true };
    expect(all.filter((b) => matchesFilters(b, withoutRange(anyAge, "abv")))).toEqual([smoky12, smoky25, smokyNas]);
  });
});

describe("detailBottle", () => {
  it("uses the first Open bottle when one exists", () => {
    const closed = bottle({ id: "closed", status: "Closed" });
    const open = bottle({ id: "open", status: "Open" });
    const later = bottle({ id: "later", status: "Open" });
    expect(detailBottle([closed, open, later]).id).toBe("open");
  });

  it("uses the first bottle when none are Open", () => {
    const first = bottle({ id: "first", status: "Closed" });
    const second = bottle({ id: "second", status: "Closed" });
    expect(detailBottle([first, second]).id).toBe("first");
  });
});
