import { describe, expect, it } from "vitest";
import type { Bottle, Catalog } from "../types";
import {
  abvBucket,
  ageBucket,
  cellarSummary,
  familyShares,
  parentRegion,
  subFamily,
  tally,
  topN,
} from "./analytics";

let nextId = 0;

function bottle(overrides: Partial<Bottle> = {}): Bottle {
  nextId += 1;
  return {
    id: `id-${nextId}`,
    bottleKey: `key-${nextId}`,
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

function catalog(bottles: Bottle[], graveyard: Bottle[] = []): Catalog {
  return { schemaVersion: 1, importedAt: "", bottles, graveyard };
}

describe("tally", () => {
  it("counts values, most common first, ties by name", () => {
    expect(tally(["b", "a", "b", "c", "a", "b"])).toEqual([
      { label: "b", count: 3 },
      { label: "a", count: 2 },
      { label: "c", count: 1 },
    ]);
  });

  it("labels blank values", () => {
    expect(tally(["", "x", ""], "Untagged")).toEqual([
      { label: "Untagged", count: 2 },
      { label: "x", count: 1 },
    ]);
  });
});

describe("topN", () => {
  const entries = [
    { label: "a", count: 5 },
    { label: "b", count: 3 },
    { label: "c", count: 2 },
    { label: "d", count: 1 },
  ];

  it("folds the rest into Other", () => {
    expect(topN(entries, 2)).toEqual([
      { label: "a", count: 5 },
      { label: "b", count: 3 },
      { label: "Other", count: 3 },
    ]);
  });

  it("leaves short lists alone", () => {
    expect(topN(entries, 4)).toEqual(entries);
  });
});

describe("parentRegion", () => {
  it("keeps the text before the comma", () => {
    expect(parentRegion("Speyside, Lossie")).toBe("Speyside");
    expect(parentRegion("Islay")).toBe("Islay");
    expect(parentRegion("")).toBe("");
  });
});

describe("ageBucket", () => {
  it("puts ages on the right side of each boundary", () => {
    expect(ageBucket("NAS")).toBe("NAS");
    expect(ageBucket(null)).toBe("Unknown");
    expect(ageBucket(9)).toBe("Under 10");
    expect(ageBucket(10)).toBe("10-14");
    expect(ageBucket(14)).toBe("10-14");
    expect(ageBucket(15)).toBe("15-19");
    expect(ageBucket(24)).toBe("20-24");
    expect(ageBucket(25)).toBe("25+");
  });
});

describe("abvBucket", () => {
  it("puts ABV on the right side of each boundary", () => {
    expect(abvBucket(null)).toBe("Unknown");
    expect(abvBucket(40)).toBe("40-45");
    expect(abvBucket(44.9)).toBe("40-45");
    expect(abvBucket(45)).toBe("45-50");
    expect(abvBucket(55)).toBe("55-60");
    expect(abvBucket(60)).toBe("60+");
  });
});

describe("familyShares", () => {
  const bottles = [
    bottle({ flavorFamilies: ["Smoke", "Sweet"] }),
    bottle({ flavorFamilies: ["Smoke"] }),
    bottle({ flavorFamilies: [] }),
  ];

  it("gives each family's share of tagged bottles, largest first", () => {
    expect(familyShares(bottles)).toEqual([
      { label: "Smoke", share: 1 },
      { label: "Sweet", share: 0.5 },
    ]);
  });

  it("follows a given family order, including families it lacks", () => {
    expect(familyShares(bottles, ["Sweet", "Wood"])).toEqual([
      { label: "Sweet", share: 0.5 },
      { label: "Wood", share: 0 },
    ]);
  });
});

describe("subFamily", () => {
  it("maps each sub to the family it appears with most, ties alphabetical", () => {
    const bottles = [
      bottle({ flavorFamilies: ["Smoke", "Coastal"], subCharacteristics: ["Brine"] }),
      bottle({ flavorFamilies: ["Coastal"], subCharacteristics: ["Brine"] }),
      bottle({ flavorFamilies: ["Sweet", "Fruit"], subCharacteristics: ["Honey"] }),
    ];
    expect(subFamily(bottles)).toEqual({ Brine: "Coastal", Honey: "Fruit" });
  });
});

describe("cellarSummary", () => {
  const bottles = [
    bottle({ distillery: "Ardbeg", region: "Islay", status: "Open", abv: 58, flavorFamilies: ["Smoke"] }),
    bottle({ distillery: "Ardbeg", region: "Islay", status: "Closed", abv: 46, flavorFamilies: ["Smoke", "Sweet"] }),
    bottle({ distillery: "Ardbeg", region: "Islay", status: "Closed", abv: 50, flavorFamilies: ["Sweet"] }),
    bottle({ distillery: "Glenfarclas", region: "Speyside, Spey", status: "Open", abv: 43, flavorFamilies: [] }),
  ];
  const summary = cellarSummary(catalog(bottles, [bottle()]));

  it("counts the headline numbers", () => {
    expect(summary.totals).toMatchObject({ bottles: 4, producers: 2, expressions: 4, open: 2, closed: 2, graveyard: 1 });
    expect(summary.totals.medianAbv).toBe(48);
    expect(summary.topRegion).toEqual({ label: "Islay", share: 0.75 });
  });

  it("groups sub-regions under their parent", () => {
    expect(summary.regions).toEqual([
      { label: "Islay", count: 3 },
      { label: "Speyside", count: 1 },
    ]);
  });

  it("splits smoke, no smoke, and untagged", () => {
    expect(summary.smoke).toEqual({ smoke: 2, noSmoke: 1, untagged: 1 });
  });

  it("writes plain takeaways from the numbers", () => {
    expect(summary.takeaways.producers).toBe("Ardbeg: 3 bottles, 3x the next producer (Glenfarclas, 1).");
    expect(summary.takeaways.regions).toBe("Islay: 75% of the cellar (3 bottles).");
    expect(summary.takeaways.shelf).toBe("2 open, 2 closed. 1 finished in the Graveyard.");
  });

  it("compares the open bottles to the whole cellar", () => {
    expect(summary.fingerprint.families).toEqual(["Smoke", "Sweet"]);
    expect(summary.fingerprint.cellar).toEqual([2 / 3, 2 / 3]);
    expect(summary.fingerprint.open).toEqual([1, 0]);
    expect(summary.takeaways.fingerprint).toBe("Open bottles lean Smoke: 100% vs 67% across the cellar.");
  });
});
