import { describe, expect, it } from "vitest";
import type { WheelFamily } from "../types";
import { placeTerm, placeTerms, subgroupClusters } from "./wheel";

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
