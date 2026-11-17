import type { Bottle, Catalog, WheelFamily } from "../types";

export type MergeRow = {
  bottle: Bottle;
  duplicateOf: Bottle | null;
};

// Additive preview for the merge-import flow: never mutates the existing
// catalog, just flags which incoming rows share a bottleKey with something
// already live, so the owner can choose per row before anything is written.
export function planMerge(existing: Bottle[], incoming: Bottle[]): MergeRow[] {
  const byKey = new Map(existing.map((b) => [b.bottleKey, b]));
  return incoming.map((bottle) => ({
    bottle: { ...bottle, drams: [], lastThird: false },
    duplicateOf: byKey.get(bottle.bottleKey) ?? null,
  }));
}

/** A workbook's Wheel Glossary replaces the wheel; `null` (no Wheel Glossary found) keeps it. */
export function applyMerge(catalog: Catalog, selected: Bottle[], wheel: WheelFamily[] | null = null): Catalog {
  return { ...catalog, bottles: [...catalog.bottles, ...selected], wheel: wheel ?? catalog.wheel };
}
