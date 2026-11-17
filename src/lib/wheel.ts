import type { Bottle, WheelFamily } from "../types";

export type WheelLevel = "family" | "subgroup" | "descriptor";

/** A bottle's term placed on the Flavor Wheel. A stray term keeps its own spelling and has no Family. */
export type PlacedTerm = { label: string; family: string | null; color: string };

export const sameTerm = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A picked wheel term matches a bottle term ignoring letter case and surrounding spaces. */
export function matchesWheelTerms(selected: string[], tags: string[], exact: boolean): boolean {
  if (selected.length === 0) return true;
  const has = (term: string) => tags.some((tag) => sameTerm(tag, term));
  return exact ? selected.every(has) : selected.some(has);
}

/** The option list's spelling for a bottle term, when they are the same term. */
export function optionSpelling(options: readonly string[], value: string): string | undefined {
  return options.find((option) => sameTerm(option, value));
}

function termsAt(family: WheelFamily, level: WheelLevel): string[] {
  if (level === "family") return [family.name];
  if (level === "subgroup") return family.subgroups.map((s) => s.name);
  return family.subgroups.flatMap((s) => s.descriptors);
}

export function placeTerm(wheel: WheelFamily[], level: WheelLevel, term: string): PlacedTerm {
  for (const family of wheel) {
    const label = termsAt(family, level).find((name) => sameTerm(name, term));
    if (label !== undefined) return { label, family: family.name, color: family.color };
  }
  return { label: term, family: null, color: "" };
}

export function parentsOf(wheel: WheelFamily[], level: WheelLevel, term: string): string[] {
  if (level === "subgroup") {
    return wheel.filter((family) => family.subgroups.some((s) => sameTerm(s.name, term))).map((family) => family.name);
  }
  if (level === "descriptor") {
    const subgroups = wheel.flatMap((family) => family.subgroups);
    return subgroups.filter((s) => s.descriptors.some((d) => sameTerm(d, term))).map((s) => s.name);
  }
  return [];
}

export type SubgroupCluster = { subgroup: string; color: string; descriptors: string[] };

type WheelTerms = Pick<Bottle, "wheelFamilies" | "wheelSubgroups" | "wheelDescriptors">;

export function bottleFamilies(wheel: WheelFamily[], bottles: Pick<Bottle, "wheelFamilies">[]): PlacedTerm[] {
  return placeTerms(wheel, "family", bottles.flatMap((b) => b.wheelFamilies));
}

const OTHER = "Other";

/** A Descriptor shows under its wheel Subgroup even when the bottle does not list that Subgroup. */
export function subgroupClusters(wheel: WheelFamily[], bottles: WheelTerms[]): SubgroupCluster[] {
  const subgroups = bottles.flatMap((b) => b.wheelSubgroups);
  const descriptors = placeTerms(wheel, "descriptor", bottles.flatMap((b) => b.wheelDescriptors));
  const clusters: SubgroupCluster[] = [];
  for (const family of wheel) {
    for (const subgroup of family.subgroups) {
      const found = descriptors.filter((d) => subgroup.descriptors.includes(d.label)).map((d) => d.label);
      if (found.length || subgroups.some((term) => sameTerm(term, subgroup.name))) {
        clusters.push({ subgroup: subgroup.name, color: family.color, descriptors: found });
      }
    }
  }
  const straySubgroups = placeTerms(wheel, "subgroup", subgroups).filter((term) => term.family === null);
  for (const { label } of straySubgroups) {
    if (!sameTerm(label, OTHER)) clusters.push({ subgroup: label, color: "", descriptors: [] });
  }
  const strayDescriptors = descriptors.filter((d) => d.family === null).map((d) => d.label);
  if (strayDescriptors.length || straySubgroups.some(({ label }) => sameTerm(label, OTHER))) {
    clusters.push({ subgroup: OTHER, color: "", descriptors: strayDescriptors });
  }
  return clusters;
}

function childrenUnder(wheel: WheelFamily[], level: "subgroup" | "descriptor", parents: string[]): string[] {
  if (parents.length === 0) return [];
  const names: string[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(name);
  };
  for (const family of wheel) {
    for (const subgroup of family.subgroups) {
      const parent = level === "subgroup" ? family.name : subgroup.name;
      if (!parents.some((picked) => sameTerm(picked, parent))) continue;
      if (level === "subgroup") add(subgroup.name);
      else for (const descriptor of subgroup.descriptors) add(descriptor);
    }
  }
  return names;
}

/** Families these bottles carry, in wheel order, then a stray Family as written. */
export function familyOptions(wheel: WheelFamily[], bottleTerms: string[]): string[] {
  const placed = placeTerms(wheel, "family", bottleTerms);
  const onWheel = wheel.filter((family) => placed.some((term) => sameTerm(term.label, family.name))).map((family) => family.name);
  const stray = placed.filter((term) => term.family === null).map((term) => term.label);
  return [...onWheel, ...stray];
}

/**
 * Wheel terms at this level that sit under a picked parent and that these bottles carry,
 * then stray terms, which stay listed whatever is picked. Glossary spelling, wheel order.
 * A picked parent of none leaves only the stray terms.
 */
export function scopedOptions(
  wheel: WheelFamily[],
  level: "subgroup" | "descriptor",
  parents: string[],
  bottleTerms: string[],
): string[] {
  const placed = placeTerms(wheel, level, bottleTerms);
  const stray = placed.filter((term) => term.family === null).map((term) => term.label);
  const present = new Set(placed.map((term) => term.label.toLowerCase()));
  const under = childrenUnder(wheel, level, parents).filter((name) => present.has(name.toLowerCase()));
  return [...under, ...stray];
}

/** Picks still under a remaining parent. A stray pick has no parent, so it stays. */
export function keptUnder(
  wheel: WheelFamily[],
  level: "subgroup" | "descriptor",
  parents: string[],
  picked: string[],
): string[] {
  const allowed = new Set(childrenUnder(wheel, level, parents).map((name) => name.toLowerCase()));
  return picked.filter((term) => {
    const placed = placeTerm(wheel, level, term);
    return placed.family === null || allowed.has(placed.label.toLowerCase());
  });
}

export function placeTerms(wheel: WheelFamily[], level: WheelLevel, terms: string[]): PlacedTerm[] {
  const placed = new Map<string, PlacedTerm>();
  for (const term of terms) {
    const place = placeTerm(wheel, level, term);
    const key = place.label.trim().toLowerCase();
    if (!placed.has(key)) placed.set(key, place);
  }
  return [...placed.values()];
}
