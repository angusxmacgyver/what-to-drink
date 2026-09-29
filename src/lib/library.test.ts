import { describe, expect, it } from "vitest";
import type { Bottle } from "../types";
import { distilleryCounts, groupLibrary, subsForFamilies } from "./library";

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
