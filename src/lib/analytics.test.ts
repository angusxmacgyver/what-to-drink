import { describe, expect, it } from "vitest";
import type { Bottle, Catalog, WheelFamily } from "../types";
import { abvBucket, ageBucket, cellarSummary, flavorRadar, palateCloud, parentRegion, tally, topN } from "./analytics";

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

function catalog(bottles: Bottle[], graveyard: Bottle[] = [], wheel: WheelFamily[] = []): Catalog {
  return { schemaVersion: 1, importedAt: "", bottles, graveyard, recentlyPoured: [], wheel };
}

const wheel: WheelFamily[] = [
  {
    name: "Fruity",
    color: "Orange",
    subgroups: [
      { name: "Citric", descriptors: ["orange", "pear"] },
      { name: "Dried Fruit", descriptors: ["apple"] },
    ],
  },
  { name: "Peaty", color: "Green", subgroups: [{ name: "Medicinal", descriptors: ["iodine"] }] },
  { name: "Sweet", color: "Yellow", subgroups: [{ name: "Honeyed", descriptors: ["honey"] }] },
];

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

describe("flavorRadar", () => {
  const bottles = [
    bottle({ status: "Open", wheelFamilies: ["fruity"] }),
    bottle({ status: "Closed", wheelFamilies: ["Fruity", "peaty"] }),
    bottle({ status: "Open", wheelFamilies: [] }),
    bottle({ status: "Open", wheelFamilies: ["Smoky"], flavorFamilies: ["Smoke"] }),
  ];

  it("uses each Family on the wheel as an axis, in wheel order and in its color", () => {
    expect(flavorRadar(wheel, bottles).map(({ label, color }) => ({ label, color }))).toEqual([
      { label: "Fruity", color: "Orange" },
      { label: "Peaty", color: "Green" },
      { label: "Sweet", color: "Yellow" },
    ]);
  });

  it("shares are among bottles that carry a Family, so an untasted bottle or a stray Family does not shrink them", () => {
    expect(flavorRadar(wheel, bottles).map(({ cellar, open }) => ({ cellar, open }))).toEqual([
      { cellar: 1, open: 1 },
      { cellar: 0.5, open: 0 },
      { cellar: 0, open: 0 },
    ]);
  });

  it("draws no axes from Flavor Families when the wheel has not been imported", () => {
    expect(flavorRadar([], [bottle({ flavorFamilies: ["Smoke"], wheelFamilies: ["Smoke"] })])).toEqual([]);
  });
});

describe("palateCloud", () => {
  const bottles = [
    bottle({ wheelDescriptors: ["orange", "pear", "orange"] }),
    bottle({ wheelDescriptors: ["ORANGE", "apple", "iodine"] }),
    bottle({ wheelDescriptors: [] }),
    bottle({ wheelDescriptors: ["raisins"], subCharacteristics: ["Honey"] }),
  ];

  it("counts Descriptors under their Family, in the Wheel Glossary's spelling, and ignores a bottle with none", () => {
    expect(palateCloud(wheel, bottles)).toEqual([
      {
        family: "Fruity",
        color: "Orange",
        descriptors: [
          { label: "orange", count: 2 },
          { label: "pear", count: 1 },
          { label: "apple", count: 1 },
        ],
      },
      { family: "Peaty", color: "Green", descriptors: [{ label: "iodine", count: 1 }] },
    ]);
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

  it("leaves the radar and the palate empty when no bottle carries a wheel term", () => {
    expect(summary.fingerprint).toEqual([]);
    expect(summary.palate).toEqual([]);
    expect(summary.takeaways.fingerprint).toBe("No open bottles carry a Family yet.");
  });

  it("compares open bottles to the cellar by Family, and builds the palate from Descriptors", () => {
    const tasted = cellarSummary(
      catalog(
        [
          bottle({ status: "Open", wheelFamilies: ["Fruity"], wheelDescriptors: ["orange"] }),
          bottle({ status: "Closed", wheelFamilies: ["Fruity", "Peaty"], wheelDescriptors: ["pear", "iodine"] }),
          bottle({ status: "Closed", wheelFamilies: ["Peaty"], wheelDescriptors: [] }),
          bottle({ status: "Open", wheelFamilies: [], wheelDescriptors: [], flavorFamilies: ["Smoke"] }),
        ],
        [],
        wheel,
      ),
    );
    expect(tasted.fingerprint).toEqual([
      { label: "Fruity", color: "Orange", cellar: 2 / 3, open: 1 },
      { label: "Peaty", color: "Green", cellar: 2 / 3, open: 0 },
      { label: "Sweet", color: "Yellow", cellar: 0, open: 0 },
    ]);
    expect(tasted.takeaways.fingerprint).toBe("Open bottles lean Fruity: 100% vs 67% across the cellar.");
    expect(tasted.palate).toEqual([
      {
        family: "Fruity",
        color: "Orange",
        descriptors: [
          { label: "orange", count: 1 },
          { label: "pear", count: 1 },
        ],
      },
      { family: "Peaty", color: "Green", descriptors: [{ label: "iodine", count: 1 }] },
    ]);
  });
});
