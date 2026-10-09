import { describe, expect, it } from "vitest";
import { emptyFilters } from "../types";
import { appliedChips, removeChip } from "./applied";

describe("appliedChips", () => {
  it("returns nothing when every filter is idle", () => {
    expect(appliedChips(emptyFilters())).toEqual([]);
  });

  it("lists each active pick, with a swatch on flavor tags", () => {
    const chips = appliedChips({
      ...emptyFilters(),
      search: " lag ",
      distilleries: ["Ardbeg"],
      themes: ["Sweet & Zesty"],
      families: ["Smoke"],
      subs: ["Honey"],
      subFamilies: { Honey: "Smoke" },
      ageMin: "12",
      ageMax: "18",
      includeNas: false,
      abvMin: "46",
      flavorMatch: "any",
    });
    expect(chips.map((chip) => chip.label)).toEqual([
      "Search: lag",
      "Ardbeg",
      "Sweet & Zesty",
      "Smoke",
      "Honey",
      "Age 12–18 yr",
      "NAS off",
      "ABV from 46%",
    ]);
    expect(chips.find((chip) => chip.label === "Sweet & Zesty")?.swatch).toBe("smws-theme-sweet-zesty");
    expect(chips.find((chip) => chip.label === "Smoke")?.swatch).toBe("family-smoke");
    expect(chips.find((chip) => chip.label === "Honey")?.swatch).toBe("family-smoke");
  });

  it("names a one-sided age range from its open end", () => {
    expect(appliedChips({ ...emptyFilters(), ageMax: "18" })[0].label).toBe("Age to 18 yr");
  });

  it("removes one pick and leaves the rest", () => {
    const filters = { ...emptyFilters(), distilleries: ["Ardbeg", "Lagavulin"], ageMin: "12", includeNas: false };
    const chips = appliedChips(filters);
    const ardbeg = chips.find((chip) => chip.label === "Ardbeg")!;
    const age = chips.find((chip) => chip.label.startsWith("Age"))!;
    const nas = chips.find((chip) => chip.label === "NAS off")!;
    expect(removeChip(filters, ardbeg.id).distilleries).toEqual(["Lagavulin"]);
    expect(removeChip(filters, age.id)).toMatchObject({ ageMin: "", ageMax: "" });
    expect(removeChip(filters, nas.id).includeNas).toBe(true);
    expect(removeChip(filters, "missing")).toBe(filters);
  });

  it("removes a sub-characteristic and its selected family context together", () => {
    const filters = {
      ...emptyFilters(),
      subs: ["Brine & Sea Air"],
      subFamilies: { "Brine & Sea Air": "Smoke" },
    };
    const chip = appliedChips(filters)[0];
    expect(removeChip(filters, chip.id)).toMatchObject({ subs: [], subFamilies: {} });
  });
});
