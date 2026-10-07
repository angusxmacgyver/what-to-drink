import { describe, expect, it } from "vitest";
import { emptyFilters, type Bottle } from "../types";
import { distilleryCounts, groupLibrary, matchesFilters, matchesStatus, subOwnerFamily, subsForFamilies } from "./library";

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
