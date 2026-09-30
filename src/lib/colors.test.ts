import { describe, expect, it } from "vitest";
import { familyClass } from "./colors";

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
