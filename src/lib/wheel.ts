import type { WheelFamily } from "../types";

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
