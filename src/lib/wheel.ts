import type { Bottle, WheelFamily } from "../types";

export type WheelLevel = "family" | "subgroup" | "descriptor";

/** A bottle's term placed on the Flavor Wheel. A stray term keeps its own spelling and has no Family. */
export type PlacedTerm = { label: string; family: string | null; color: string };

const sameTerm = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

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

export type SubgroupCluster = { subgroup: string; color: string; descriptors: string[] };

type WheelTerms = Pick<Bottle, "wheelFamilies" | "wheelSubgroups" | "wheelDescriptors">;

/**
 * The Subgroups of the given bottles, each with their Descriptors, in wheel order. A Descriptor shows under its
 * wheel Subgroup even when the bottle does not list that Subgroup. Stray Subgroups follow, then stray Descriptors.
 */
export function subgroupClusters(wheel: WheelFamily[], bottles: WheelTerms[]): SubgroupCluster[] {
  const subgroups = bottles.flatMap((b) => b.wheelSubgroups);
  const descriptors = bottles.flatMap((b) => b.wheelDescriptors);
  const listed = (terms: string[], name: string) => terms.some((term) => sameTerm(term, name));
  const clusters: SubgroupCluster[] = [];
  for (const family of wheel) {
    for (const subgroup of family.subgroups) {
      const found = subgroup.descriptors.filter((name) => listed(descriptors, name));
      if (found.length || listed(subgroups, subgroup.name)) {
        clusters.push({ subgroup: subgroup.name, color: family.color, descriptors: found });
      }
    }
  }
  const stray = (level: WheelLevel, terms: string[]) =>
    placeTerms(wheel, level, terms).filter((term) => term.family === null).map((term) => term.label);
  for (const subgroup of stray("subgroup", subgroups)) clusters.push({ subgroup, color: "", descriptors: [] });
  const strayDescriptors = stray("descriptor", descriptors);
  if (strayDescriptors.length) clusters.push({ subgroup: "Other", color: "", descriptors: strayDescriptors });
  return clusters;
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
