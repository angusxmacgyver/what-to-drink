import { type FilterState } from "../types";
import { familyClass, smwsThemeClass, subFamilyClass } from "./colors";

export type AppliedChip = {
  id: string;
  label: string;
  swatch?: string;
};

function chipId(kind: string, value = ""): string {
  return value ? `${kind}\n${value}` : kind;
}

function rangeLabel(name: string, min: string, max: string, unit: string): string | null {
  if (!min && !max) return null;
  if (min && max) return `${name} ${min}–${max}${unit}`;
  if (min) return `${name} from ${min}${unit}`;
  return `${name} to ${max}${unit}`;
}

function listed(kind: string, values: string[], swatchFor?: (value: string) => string): AppliedChip[] {
  return values.map((value) => ({ id: chipId(kind, value), label: value, swatch: swatchFor?.(value) }));
}

export function appliedChips(filters: FilterState): AppliedChip[] {
  const chips: AppliedChip[] = [];
  const search = filters.search.trim();
  if (search) chips.push({ id: chipId("search"), label: `Search: ${search}` });
  chips.push(
    ...listed("distillery", filters.distilleries),
    ...listed("theme", filters.themes, smwsThemeClass),
    ...listed("family", filters.families, familyClass),
    ...listed("sub", filters.subs, (sub) => subFamilyClass(sub, filters.subFamilies[sub])),
    ...listed("country", filters.countries),
    ...listed("region", filters.regions),
  );
  const age = rangeLabel("Age", filters.ageMin, filters.ageMax, " yr");
  if (age) chips.push({ id: chipId("age"), label: age });
  if (!filters.includeNas) chips.push({ id: chipId("nas"), label: "NAS off" });
  const abv = rangeLabel("ABV", filters.abvMin, filters.abvMax, "%");
  if (abv) chips.push({ id: chipId("abv"), label: abv });
  chips.push(...listed("status", filters.statuses));
  return chips;
}

function without(values: string[], value: string): string[] {
  return values.filter((item) => item !== value);
}

export function removeChip(filters: FilterState, id: string): FilterState {
  const split = id.indexOf("\n");
  const kind = split < 0 ? id : id.slice(0, split);
  const value = split < 0 ? "" : id.slice(split + 1);
  if (kind === "search") return { ...filters, search: "" };
  if (kind === "distillery") return { ...filters, distilleries: without(filters.distilleries, value) };
  if (kind === "theme") return { ...filters, themes: without(filters.themes, value) };
  if (kind === "family") {
    return {
      ...filters,
      families: without(filters.families, value),
      subFamilies: Object.fromEntries(Object.entries(filters.subFamilies).filter(([, family]) => family !== value)),
    };
  }
  if (kind === "sub") {
    const { [value]: _removed, ...subFamilies } = filters.subFamilies;
    return { ...filters, subs: without(filters.subs, value), subFamilies };
  }
  if (kind === "country") return { ...filters, countries: without(filters.countries, value) };
  if (kind === "region") return { ...filters, regions: without(filters.regions, value) };
  if (kind === "age") return { ...filters, ageMin: "", ageMax: "" };
  if (kind === "nas") return { ...filters, includeNas: true };
  if (kind === "abv") return { ...filters, abvMin: "", abvMax: "" };
  if (kind === "status") return { ...filters, statuses: without(filters.statuses, value) };
  return filters;
}
