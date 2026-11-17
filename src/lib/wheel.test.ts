import { describe, expect, it } from "vitest";
import type { WheelFamily } from "../types";
import { dropUnder, familyOptions, keptUnder, placeTerm, placeTerms, scopedOptions, subgroupClusters } from "./wheel";

const wheel: WheelFamily[] = [
  {
    name: "Fruity",
    color: "Orange",
    subgroups: [
      { name: "Citric", descriptors: ["orange", "lemon zest"] },
      { name: "Dried Fruit", descriptors: ["raisin"] },
    ],
  },
  { name: "Peaty", color: "Green", subgroups: [{ name: "Medicinal", descriptors: ["iodine", "TCP"] }] },
];

describe("placeTerm", () => {
  it("places a term at each level under its Family, displayed as the Wheel Glossary writes it", () => {
    expect(placeTerm(wheel, "family", "peaty")).toEqual({ label: "Peaty", family: "Peaty", color: "Green" });
    expect(placeTerm(wheel, "subgroup", "  dried fruit ")).toEqual({ label: "Dried Fruit", family: "Fruity", color: "Orange" });
    expect(placeTerm(wheel, "descriptor", "tcp")).toEqual({ label: "TCP", family: "Peaty", color: "Green" });
  });

  it("keeps a stray term as written, with no Family and no color", () => {
    expect(placeTerm(wheel, "descriptor", "raisins")).toEqual({ label: "raisins", family: null, color: "" });
  });

  it("matches only at the term's own level", () => {
    expect(placeTerm(wheel, "family", "Citric").family).toBeNull();
    expect(placeTerm(wheel, "subgroup", "orange").family).toBeNull();
  });

  it("places a list of terms once per Glossary spelling, in the order first written", () => {
    expect(placeTerms(wheel, "family", ["peaty", "Fruity", "PEATY", "Smoky", "smoky "]).map((t) => t.label)).toEqual([
      "Peaty",
      "Fruity",
      "Smoky",
    ]);
  });

  it("finds nothing in a wheel that has not been imported", () => {
    expect(placeTerm([], "family", "Fruity")).toEqual({ label: "Fruity", family: null, color: "" });
  });
});

describe("familyOptions", () => {
  it("lists Families the bottles carry in wheel order, then a stray Family as written", () => {
    expect(familyOptions(wheel, ["peaty", "Smoky", "Fruity", "smoky"])).toEqual(["Fruity", "Peaty", "Smoky"]);
  });
});

describe("scopedOptions", () => {
  it("lists Subgroups under the picked Families that the bottles carry, in wheel order, and none of those when no Family is picked", () => {
    expect(scopedOptions(wheel, "subgroup", ["Fruity"], ["Medicinal", "dried fruit", "Citric"])).toEqual([
      "Citric",
      "Dried Fruit",
    ]);
    expect(scopedOptions(wheel, "subgroup", [], ["Citric"])).toEqual([]);
  });

  it("keeps a stray Subgroup listed, unscoped, whether or not a Family is picked", () => {
    expect(scopedOptions(wheel, "subgroup", ["Fruity"], ["Citric", "Citrus", "citrus"])).toEqual(["Citric", "Citrus"]);
    expect(scopedOptions(wheel, "subgroup", [], ["Citric", "Citrus"])).toEqual(["Citrus"]);
  });

  it("lists Descriptors under the picked Subgroups that the bottles carry, in wheel order", () => {
    expect(scopedOptions(wheel, "descriptor", ["Citric", "Medicinal"], ["TCP", "lemon zest", "raisin"])).toEqual([
      "lemon zest",
      "TCP",
    ]);
    expect(scopedOptions(wheel, "descriptor", [], ["orange", "raisins"])).toEqual(["raisins"]);
  });
});

describe("keptUnder", () => {
  it("drops a Subgroup or Descriptor whose parent was unpicked, and keeps a stray pick", () => {
    expect(keptUnder(wheel, "subgroup", ["Peaty"], ["Citric", "Medicinal", "Citrus"])).toEqual(["Medicinal", "Citrus"]);
    expect(keptUnder(wheel, "subgroup", [], ["Citric", "Citrus"])).toEqual(["Citrus"]);
    expect(keptUnder(wheel, "descriptor", ["Citric"], ["orange", "TCP", "raisins"])).toEqual(["orange", "raisins"]);
  });
});

describe("dropUnder", () => {
  const shared: WheelFamily[] = [
    { name: "Fruity", color: "Orange", subgroups: [{ name: "Citric", descriptors: ["orange"] }] },
    { name: "Peaty", color: "Green", subgroups: [{ name: "Citric", descriptors: ["orange"] }] },
  ];

  it("drops a pick only when every parent it sits under was removed, and keeps a stray pick", () => {
    expect(dropUnder(wheel, "subgroup", ["Peaty"], ["Citric", "Medicinal", "Citrus"])).toEqual(["Citric", "Citrus"]);
    expect(dropUnder(shared, "subgroup", ["Fruity"], ["Citric"])).toEqual(["Citric"]);
    expect(dropUnder(shared, "subgroup", ["Fruity", "Peaty"], ["Citric"])).toEqual([]);
  });
});

describe("subgroupClusters", () => {
  const terms = (subgroups: string[], descriptors: string[]) => ({
    wheelFamilies: [],
    wheelSubgroups: subgroups,
    wheelDescriptors: descriptors,
  });

  it("gathers each Subgroup's Descriptors under it in its Family's color, Subgroups in wheel order", () => {
    expect(subgroupClusters(wheel, [terms(["medicinal", "Citric"], ["iodine", "LEMON ZEST", "orange"])])).toEqual([
      { subgroup: "Citric", color: "Orange", descriptors: ["lemon zest", "orange"] },
      { subgroup: "Medicinal", color: "Green", descriptors: ["iodine"] },
    ]);
  });

  it("shows a Subgroup with no Descriptors, and a Descriptor under its wheel Subgroup when the bottle lacks it", () => {
    expect(subgroupClusters(wheel, [terms(["Dried Fruit"], ["TCP"])])).toEqual([
      { subgroup: "Dried Fruit", color: "Orange", descriptors: [] },
      { subgroup: "Medicinal", color: "Green", descriptors: ["TCP"] },
    ]);
  });

  it("gathers the terms of every bottle given, once each", () => {
    expect(subgroupClusters(wheel, [terms(["Citric"], ["orange"]), terms([], ["Orange", "raisin"])])).toEqual([
      { subgroup: "Citric", color: "Orange", descriptors: ["orange"] },
      { subgroup: "Dried Fruit", color: "Orange", descriptors: ["raisin"] },
    ]);
  });

  it("keeps stray Subgroups as typed, and stray Descriptors in a neutral Other cluster, last", () => {
    expect(subgroupClusters(wheel, [terms(["Citrus", "Citric"], ["orange", "raisins", "Raisins"])])).toEqual([
      { subgroup: "Citric", color: "Orange", descriptors: ["orange"] },
      { subgroup: "Citrus", color: "", descriptors: [] },
      { subgroup: "Other", color: "", descriptors: ["raisins"] },
    ]);
  });

  it("folds a stray Subgroup typed as Other into the Other cluster", () => {
    expect(subgroupClusters(wheel, [terms(["other"], [])])).toEqual([{ subgroup: "Other", color: "", descriptors: [] }]);
    expect(subgroupClusters(wheel, [terms(["Other"], ["raisins"])])).toEqual([
      { subgroup: "Other", color: "", descriptors: ["raisins"] },
    ]);
  });

  it("gives a bottle with only Families, or no terms, no clusters", () => {
    expect(subgroupClusters(wheel, [{ ...terms([], []), wheelFamilies: ["Fruity"] }])).toEqual([]);
  });
});
