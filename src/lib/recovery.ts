import type { Bottle, FilterState } from "../types";
import { appliedChips, removeChip } from "./applied";
import { dramPool, type DramPlace } from "./library";

export function pushHistory(stack: FilterState[], current: FilterState): FilterState[] {
  return [...stack, current];
}

export function popHistory(stack: FilterState[]): { stack: FilterState[]; previous: FilterState | null } {
  if (stack.length === 0) return { stack, previous: null };
  return { stack: stack.slice(0, -1), previous: stack[stack.length - 1] };
}

/** Chip whose removal returns the most pourable bottles. The earlier chip wins a tie. */
export function mostConstraining(
  bottles: Bottle[],
  place: DramPlace,
  includeClosed: boolean,
  filters: FilterState,
  includeOpen = true,
): string | null {
  let bestId: string | null = null;
  let best = -1;
  for (const chip of appliedChips(filters)) {
    const count = dramPool(bottles, place, includeClosed, removeChip(filters, chip.id), includeOpen).length;
    if (count > best) {
      best = count;
      bestId = chip.id;
    }
  }
  return bestId;
}
