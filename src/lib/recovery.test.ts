import { describe, expect, it } from "vitest";
import { emptyFilters, type Bottle } from "../types";
import { mostConstraining, popHistory, pushHistory } from "./recovery";

function bottle(overrides: Partial<Bottle> = {}): Bottle {
  return {
    id: "id",
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

describe("mostConstraining", () => {
  it("flags the removal that brings back the most bottles", () => {
    const filters = { ...emptyFilters(), distilleries: ["Ardbeg"], families: ["Smoke"] };
    const bottles = [
      bottle({ id: "smoke", flavorFamilies: ["Smoke"] }),
      bottle({ id: "sweet", flavorFamilies: ["Sweet"] }),
      ...Array.from({ length: 5 }, (_, index) =>
        bottle({ id: `lag-${index}`, distillery: "Lagavulin", flavorFamilies: ["Smoke"] }),
      ),
    ];
    expect(mostConstraining(bottles, "house", false, filters)).toBe("distillery\nArdbeg");
  });

  it("keeps the earlier chip when two removals tie, and returns nothing with no chips", () => {
    const filters = { ...emptyFilters(), distilleries: ["Ardbeg"], families: ["Smoke"] };
    const bottles = [bottle({ flavorFamilies: ["Smoke"] })];
    expect(mostConstraining(bottles, "house", false, filters)).toBe("distillery\nArdbeg");
    expect(mostConstraining(bottles, "house", false, emptyFilters())).toBeNull();
  });
});

describe("selection history", () => {
  it("restores the previous selection and stops when the stack is empty", () => {
    const first = emptyFilters();
    const second = { ...first, families: ["Smoke"] };
    const stack = pushHistory(pushHistory([], first), second);
    const once = popHistory(stack);
    expect(once.previous).toEqual(second);
    const twice = popHistory(once.stack);
    expect(twice.previous).toEqual(first);
    expect(popHistory(twice.stack).previous).toBeNull();
  });
});
