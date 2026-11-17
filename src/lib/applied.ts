import { type FilterState, type WheelFamily } from "../types";
import { smwsThemeClass, wheelTermClass } from "./colors";
import { LAST_THIRD } from "./library";
import { keptUnder, type WheelLevel } from "./wheel";

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

function wheelSwatch(wheel: WheelFamily[], level: WheelLevel): (term: string) => string {
  return (term) => wheelTermClass(wheel, level, term);
}

/** Keeps Subgroups under the Families still picked, then Descriptors under the Subgroups still picked. A stray pick stays. */
export function scopeWheelFilters(
  wheel: WheelFamily[],
  filters: FilterState,
  picked: Partial<Pick<FilterState, "families" | "subs" | "descriptors">>,
): FilterState {
  const families = picked.families ?? filters.families;
  const subs =
    picked.subs !== undefined
      ? picked.subs
      : picked.families !== undefined
        ? keptUnder(wheel, "subgroup", families, filters.subs)
        : filters.subs;
  const descriptors =
    picked.descriptors !== undefined
      ? picked.descriptors
      : keptUnder(wheel, "descriptor", subs, filters.descriptors ?? []);
  return { ...filters, families, subs, descriptors };
}

export function appliedChips(filters: FilterState, wheel: WheelFamily[] = []): AppliedChip[] {
  const chips: AppliedChip[] = [];
  const search = filters.search.trim();
  if (search) chips.push({ id: chipId("search"), label: `Search: ${search}` });
  if (filters.place) chips.push({ id: chipId("place"), label: filters.place === "house" ? "House" : "Apartment" });
  chips.push(
    ...listed("distillery", filters.distilleries),
    ...listed("theme", filters.themes, smwsThemeClass),
    ...listed("family", filters.families, wheelSwatch(wheel, "family")),
    ...listed("sub", filters.subs, wheelSwatch(wheel, "subgroup")),
    ...listed("descriptor", filters.descriptors ?? [], wheelSwatch(wheel, "descriptor")),
    ...listed("country", filters.countries),
    ...listed("region", filters.regions),
  );
  const age = rangeLabel("Age", filters.ageMin, filters.ageMax, " yr");
  if (age) chips.push({ id: chipId("age"), label: age });
  if (!filters.includeNas) chips.push({ id: chipId("nas"), label: "NAS off" });
  const abv = rangeLabel("ABV", filters.abvMin, filters.abvMax, "%");
  if (abv) chips.push({ id: chipId("abv"), label: abv });
  chips.push(...listed("status", filters.statuses));
  if (filters.lastThird) chips.push({ id: chipId("lastThird"), label: LAST_THIRD });
  return chips;
}

function without(values: string[], value: string): string[] {
  return values.filter((item) => item !== value);
}

export function removeChip(filters: FilterState, id: string, wheel: WheelFamily[] = []): FilterState {
  const split = id.indexOf("\n");
  const kind = split < 0 ? id : id.slice(0, split);
  const value = split < 0 ? "" : id.slice(split + 1);
  if (kind === "search") return { ...filters, search: "" };
  if (kind === "place") return { ...filters, place: null };
  if (kind === "distillery") return { ...filters, distilleries: without(filters.distilleries, value) };
  if (kind === "theme") return { ...filters, themes: without(filters.themes, value) };
  if (kind === "family") {
    const subFamilies = Object.fromEntries(Object.entries(filters.subFamilies).filter(([, family]) => family !== value));
    return scopeWheelFilters(wheel, { ...filters, subFamilies }, { families: without(filters.families, value) });
  }
  if (kind === "sub") {
    const { [value]: _removed, ...subFamilies } = filters.subFamilies;
    return scopeWheelFilters(wheel, { ...filters, subFamilies }, { subs: without(filters.subs, value) });
  }
  if (kind === "descriptor") return { ...filters, descriptors: without(filters.descriptors ?? [], value) };
  if (kind === "country") return { ...filters, countries: without(filters.countries, value) };
  if (kind === "region") return { ...filters, regions: without(filters.regions, value) };
  if (kind === "age") return { ...filters, ageMin: "", ageMax: "" };
  if (kind === "nas") return { ...filters, includeNas: true };
  if (kind === "abv") return { ...filters, abvMin: "", abvMax: "" };
  if (kind === "status") return { ...filters, statuses: without(filters.statuses, value) };
  if (kind === "lastThird") return { ...filters, lastThird: false };
  return filters;
}
