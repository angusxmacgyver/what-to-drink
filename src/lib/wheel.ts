import type { Bottle, WheelFamily } from "../types";

export type WheelLevel = "family" | "subgroup" | "descriptor";

/** A bottle's term placed on the Flavor Wheel. A stray term keeps its own spelling and has no Family. */
export type PlacedTerm = { label: string; family: string | null; color: string };

export const sameTerm = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

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

export function placeTerms(wheel: WheelFamily[], level: WheelLevel, terms: string[]): PlacedTerm[] {
  const placed = new Map<string, PlacedTerm>();
  for (const term of terms) {
    const place = placeTerm(wheel, level, term);
    const key = place.label.trim().toLowerCase();
    if (!placed.has(key)) placed.set(key, place);
  }
  return [...placed.values()];
}
