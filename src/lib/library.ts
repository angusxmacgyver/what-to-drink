import type { Bottle, FilterState } from "../types";

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

function uniqueTags(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
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

function matchesAge(bottle: Bottle, filters: FilterState): boolean {
  if (!filters.ageMin && !filters.ageMax) return true;
  if (bottle.age === "NAS") return filters.ageMin === "NAS";
  if (typeof bottle.age !== "number") return false;
  if (filters.ageMin === "NAS" && filters.ageMax === "NAS") return false;
  if (filters.ageMin && filters.ageMin !== "NAS" && bottle.age < Number(filters.ageMin)) return false;
  if (filters.ageMax && filters.ageMax !== "NAS" && bottle.age > Number(filters.ageMax)) return false;
  return true;
}

export function matchesFilters(bottle: Bottle, filters: FilterState): boolean {
  if (!inList(filters.distilleries, bottle.distillery)) return false;
  if (!inList(filters.themes, bottle.theme)) return false;
  if (!inList(filters.countries, bottle.country)) return false;
  if (!inList(filters.regions, bottle.region)) return false;
  if (!matchesAge(bottle, filters)) return false;

  if (filters.abvMin || filters.abvMax) {
    if (bottle.abv == null) return false;
    if (filters.abvMin && bottle.abv < Number(filters.abvMin)) return false;
    if (filters.abvMax && bottle.abv > Number(filters.abvMax)) return false;
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
