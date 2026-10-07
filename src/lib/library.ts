import type { Bottle, FilterState } from "../types";
import { matchesAbvRange, matchesAgeRange } from "./histogram";

export type LibraryRow = {
  bottleKey: string;
  bottles: Bottle[];
  distillery: string;
  bottling: string;
  ageLabel: string;
  abvLabel: string;
  theme: string;
  flavorFamilies: string[];
  subCharacteristics: string[];
  stock: number;
};

function ageLabel(bottles: Bottle[]): string {
  const values = [...new Set(bottles.map((b) => (b.age == null ? "" : String(b.age))))];
  if (values.length === 1) return values[0] || "—";
  return "mixed";
}

export function uniqueTags(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function distilleryCounts(bottles: Bottle[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const bottle of bottles) {
    counts[bottle.distillery] = (counts[bottle.distillery] ?? 0) + 1;
  }
  return counts;
}

// Curated, not computed: co-occurrence data has no real signal here (every
// sub-characteristic appears across all 11 families at a near-uniform rate,
// since most bottles carry 5+ family tags). Add new sub-characteristics here
// as ingest introduces them; anything missing is treated as unowned and
// stays visible regardless of which family is picked.
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

export function subOwnerFamily(sub: string): string | undefined {
  return SUB_FAMILY[sub];
}

export function subsForFamilies(bottles: Bottle[], families: string[]): string[] {
  if (families.length === 0) return [];
  const pool = bottles.filter((b) => families.every((f) => b.flavorFamilies.includes(f)));
  const available = uniqueTags(pool.flatMap((b) => b.subCharacteristics));
  return available
    .filter((sub) => {
      const owner = subOwnerFamily(sub);
      return owner === undefined || families.includes(owner);
    })
    .sort((a, b) => a.localeCompare(b));
}

function abvLabel(bottles: Bottle[]): string {
  const values = [...new Set(bottles.map((b) => (b.abv == null ? "" : `${b.abv}%`)))];
  if (values.length === 1) return values[0] || "—";
  return "mixed";
}

export function groupLibrary(bottles: Bottle[]): LibraryRow[] {
  const map = new Map<string, Bottle[]>();
  for (const bottle of bottles) {
    const list = map.get(bottle.bottleKey) ?? [];
    list.push(bottle);
    map.set(bottle.bottleKey, list);
  }
  const rows: LibraryRow[] = [];
  for (const [bottleKey, group] of map) {
    const first = group[0];
    rows.push({
      bottleKey,
      bottles: group,
      distillery: first.distillery,
      bottling: first.bottling,
      ageLabel: ageLabel(group),
      abvLabel: abvLabel(group),
      theme: group.find((b) => b.theme)?.theme || first.theme || "—",
      flavorFamilies: uniqueTags(group.flatMap((b) => b.flavorFamilies)),
      subCharacteristics: uniqueTags(group.flatMap((b) => b.subCharacteristics)),
      stock: group.length,
    });
  }
  rows.sort((a, b) => {
    const d = a.distillery.localeCompare(b.distillery);
    return d !== 0 ? d : a.bottling.localeCompare(b.bottling);
  });
  return rows;
}

function inList(selected: string[], value: string): boolean {
  return selected.length === 0 || selected.includes(value);
}

export function matchesStatus(bottle: Bottle, statuses: string[]): boolean {
  return inList(statuses, bottle.status);
}

function matchesAge(bottle: Bottle, filters: FilterState): boolean {
  const from = filters.ageMin === "" ? Number.NEGATIVE_INFINITY : Number(filters.ageMin);
  const to = filters.ageMax === "" ? Number.POSITIVE_INFINITY : Number(filters.ageMax);
  return matchesAgeRange(bottle.age, from, to, filters.includeNas);
}

export function matchesFilters(bottle: Bottle, filters: FilterState): boolean {
  if (!inList(filters.distilleries, bottle.distillery)) return false;
  if (!inList(filters.themes, bottle.theme)) return false;
  if (!inList(filters.countries, bottle.country)) return false;
  if (!inList(filters.regions, bottle.region)) return false;
  if (!matchesAge(bottle, filters)) return false;

  if (filters.abvMin || filters.abvMax) {
    const from = filters.abvMin === "" ? Number.NEGATIVE_INFINITY : Number(filters.abvMin);
    const to = filters.abvMax === "" ? Number.POSITIVE_INFINITY : Number(filters.abvMax);
    if (!matchesAbvRange(bottle.abv, from, to)) return false;
  }

  if (filters.families.length > 0) {
    const has = filters.families.every((f) => bottle.flavorFamilies.includes(f));
    if (!has) return false;
  }
  if (filters.subs.length > 0) {
    const has = filters.subs.every((s) => bottle.subCharacteristics.includes(s));
    if (!has) return false;
  }

  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    const hay = [
      bottle.distillery,
      bottle.bottling,
      bottle.smws?.fullCode ?? "",
      bottle.smws?.nameIntl ?? "",
    ]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }

  return true;
}

export function dramPool(
  bottles: Bottle[],
  place: "house" | "apartment",
  includeClosed: boolean,
  filters: FilterState,
): Bottle[] {
  return bottles.filter((bottle) => {
    if (place === "apartment" && !bottle.atApartment) return false;
    if (place === "house" && bottle.atApartment) return false;
    if (!includeClosed && bottle.status !== "Open") return false;
    if (bottle.status === "Killed" || bottle.status === "empty") return false;
    return matchesFilters(bottle, filters);
  });
}
