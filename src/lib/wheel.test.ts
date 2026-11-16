import { describe, expect, it } from "vitest";
import type { WheelFamily } from "../types";
import { placeTerm } from "./wheel";

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

  it("finds nothing in a wheel that has not been imported", () => {
    expect(placeTerm([], "family", "Fruity")).toEqual({ label: "Fruity", family: null, color: "" });
  });
});
