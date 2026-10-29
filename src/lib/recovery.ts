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
  return mostConstrainingChip(filters, (next) => dramPool(bottles, place, includeClosed, next, includeOpen).length);
}

/** Chip whose removal brings back the most bottles by the caller's count. The earlier chip wins a tie. */
export function mostConstrainingChip(filters: FilterState, countShowing: (filters: FilterState) => number): string | null {
  let bestId: string | null = null;
  let best = -1;
  for (const chip of appliedChips(filters)) {
    const count = countShowing(removeChip(filters, chip.id));
    if (count > best) {
      best = count;
      bestId = chip.id;
    }
  }
  return bestId;
}
