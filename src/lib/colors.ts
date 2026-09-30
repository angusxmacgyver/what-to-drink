import { subOwnerFamily } from "./library";

const FAMILY_CLASSES: Record<string, string> = {
  Coastal: "family-coastal",
  "Fruit (Dried & Cooked)": "family-fruit-dried",
  "Fruit (Fresh)": "family-fruit-fresh",
  "Green, Herbal & Floral": "family-herbal",
  "Nutty & Cereal": "family-nutty",
  "Roasted & Rancio": "family-roasted",
  "Savoury & Umami": "family-savoury",
  Smoke: "family-smoke",
  Spice: "family-spice",
  Sweet: "family-sweet",
  Wood: "family-wood",
};

const FALLBACK_CLASS = "family-other";

export function familyClass(family: string): string {
  return FAMILY_CLASSES[family] ?? FALLBACK_CLASS;
}

export function subFamilyClass(sub: string): string {
  return familyClass(subOwnerFamily(sub) ?? "");
}
