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

// Curated, not computed: co-occurrence data has no real signal here (every
// sub-characteristic appears across all 11 families at a near-uniform rate,
// since most bottles carry 5+ family tags). Add new sub-characteristics here
// as ingest introduces them; anything missing falls back to family-other.
const SUB_FAMILY: Record<string, string> = {
  "Brine & Sea Air": "Coastal",
  "Seaweed & Shellfish": "Coastal",
  "Dried & Dark": "Fruit (Dried & Cooked)",
  "Stewed & Preserved": "Fruit (Dried & Cooked)",
  "Berry & Red": "Fruit (Fresh)",
  Citrus: "Fruit (Fresh)",
  Orchard: "Fruit (Fresh)",
  Stone: "Fruit (Fresh)",
  Tropical: "Fruit (Fresh)",
  "Anise & Herbal Spice": "Green, Herbal & Floral",
  Floral: "Green, Herbal & Floral",
  "Grassy & Vegetal": "Green, Herbal & Floral",
  "Mint & Menthol": "Green, Herbal & Floral",
  "Malt & Grain": "Nutty & Cereal",
  "Nuts & Marzipan": "Nutty & Cereal",
  "Coffee & Cocoa": "Roasted & Rancio",
  "Leather & Tobacco": "Roasted & Rancio",
  "Savoury & Umami": "Savoury & Umami",
  "Ashy & Mineral": "Smoke",
  "Earthy & Bog": "Smoke",
  "Medicinal & Phenolic": "Smoke",
  "Smoked Meats": "Smoke",
  "Tarry & Industrial": "Smoke",
  "Woodsmoke & Campfire": "Smoke",
  "Baking Spice": "Spice",
  "Hot & Pungent": "Spice",
  "Bakery & Dessert": "Sweet",
  "Candy & Liquorice": "Sweet",
  "Caramel & Toffee": "Sweet",
  Honey: "Sweet",
  "Vanilla & Cream": "Sweet",
  "Dry & Tannic": "Wood",
  "Resinous & Aromatic Wood": "Wood",
  "Toasted & Charred Oak": "Wood",
};

export function subFamilyClass(sub: string): string {
  return familyClass(SUB_FAMILY[sub] ?? "");
}
