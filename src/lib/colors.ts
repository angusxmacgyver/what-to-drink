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

const SMWS_THEME_CLASSES: Record<string, string> = {
  "Young & Spritely": "smws-theme-young-spritely",
  "Sweet, Fruity & Mellow": "smws-theme-sweet-fruity-mellow",
  "Spicy & Sweet": "smws-theme-spicy-sweet",
  "Spicy & Dry": "smws-theme-spicy-dry",
  "Deep, Rich & Dried Fruits": "smws-theme-deep-rich-dried-fruits",
  "Old & Dignified": "smws-theme-old-dignified",
  "Light & Delicate": "smws-theme-light-delicate",
  "Juicy, Oak & Vanilla": "smws-theme-juicy-oak-vanilla",
  "Oily & Coastal": "smws-theme-oily-coastal",
  "Lightly Peated": "smws-theme-lightly-peated",
  Peated: "smws-theme-peated",
  "Heavily Peated": "smws-theme-heavily-peated",
  "Fragrant & Floral": "smws-theme-fragrant-floral",
  "Toasted Oak & Vanilla": "smws-theme-toasted-oak-vanilla",
  "Sweet & Zesty": "smws-theme-sweet-zesty",
  "Dried Fruits & Spices": "smws-theme-dried-fruits-spices",
  "Ripe Fruits & Honey": "smws-theme-ripe-fruits-honey",
  "Coastal & Maritime": "smws-theme-coastal-maritime",
  "Bold & Peaty": "smws-theme-bold-peaty",
  "Smoky & Fruity": "smws-theme-smoky-fruity",
};

export function familyClass(family: string): string {
  return FAMILY_CLASSES[family] ?? FALLBACK_CLASS;
}

export function subFamilyClass(sub: string): string {
  return familyClass(subOwnerFamily(sub) ?? "");
}

export function smwsThemeClass(theme: string): string {
  return SMWS_THEME_CLASSES[theme] ?? "smws-theme-other";
}
