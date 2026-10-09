import { describe, expect, it } from "vitest";
import { familyClass, smwsThemeClass, subFamilyClass } from "./colors";

describe("familyClass", () => {
  it("maps every known flavor family to its own class", () => {
    expect(familyClass("Coastal")).toBe("family-coastal");
    expect(familyClass("Fruit (Dried & Cooked)")).toBe("family-fruit-dried");
    expect(familyClass("Fruit (Fresh)")).toBe("family-fruit-fresh");
    expect(familyClass("Green, Herbal & Floral")).toBe("family-herbal");
    expect(familyClass("Nutty & Cereal")).toBe("family-nutty");
    expect(familyClass("Roasted & Rancio")).toBe("family-roasted");
    expect(familyClass("Savoury & Umami")).toBe("family-savoury");
    expect(familyClass("Smoke")).toBe("family-smoke");
    expect(familyClass("Spice")).toBe("family-spice");
    expect(familyClass("Sweet")).toBe("family-sweet");
    expect(familyClass("Wood")).toBe("family-wood");
  });

  it("falls back to a neutral class for an unrecognized family", () => {
    expect(familyClass("Apartment")).toBe("family-other");
    expect(familyClass("")).toBe("family-other");
  });
});

describe("subFamilyClass", () => {
  it("maps a curated sub-characteristic to its family's class", () => {
    expect(subFamilyClass("Woodsmoke & Campfire")).toBe("family-smoke");
    expect(subFamilyClass("Honey")).toBe("family-sweet");
    expect(subFamilyClass("Citrus")).toBe("family-fruit-fresh");
    expect(subFamilyClass("Anise & Herbal Spice")).toBe("family-herbal");
  });

  it("prefers the family context used to select the sub-characteristic", () => {
    expect(subFamilyClass("Honey", "Smoke")).toBe("family-smoke");
  });

  it("falls back to a neutral class for an uncurated sub-characteristic", () => {
    expect(subFamilyClass("Not Yet Catalogued")).toBe("family-other");
    expect(subFamilyClass("")).toBe("family-other");
  });
});

describe("smwsThemeClass", () => {
  it("keeps legacy and refined profile names on distinct palette classes", () => {
    expect(smwsThemeClass("Juicy, Oak & Vanilla")).toBe("smws-theme-juicy-oak-vanilla");
    expect(smwsThemeClass("Toasted Oak & Vanilla")).toBe("smws-theme-toasted-oak-vanilla");
    expect(smwsThemeClass("Heavily Peated")).toBe("smws-theme-heavily-peated");
    expect(smwsThemeClass("Bold & Peaty")).toBe("smws-theme-bold-peaty");
  });

  it("falls back to a neutral profile class", () => {
    expect(smwsThemeClass("House style")).toBe("smws-theme-other");
    expect(smwsThemeClass("")).toBe("smws-theme-other");
  });
});
