import type { Bottle, FilterState } from "../types";

export const FANCY_POOL_KEY = "what-to-drink-fancy-pool";
const FANCY_VISIT_KEY = "what-to-drink-fancy-visit";
// Written by the wheel in public/fancy/js/data.js.
const FANCY_RESULT_KEY = "what-to-drink-fancy-result";
// The explicit file: Vite's dev server answers a bare "/fancy/" with the SPA's index.html.
export const FANCY_PICKER_URL = "/fancy/index.html";

export type FancyPoolPayload = {
  version: 1;
  bottles: Bottle[];
};

export type FancyVisit = {
  filters: FilterState;
  exact: boolean;
};

export function stageFancyPool(bottles: Bottle[]): void {
  const payload: FancyPoolPayload = { version: 1, bottles };
  sessionStorage.setItem(FANCY_POOL_KEY, JSON.stringify(payload));
}

export function stageFancyVisit(visit: FancyVisit): void {
  sessionStorage.setItem(FANCY_VISIT_KEY, JSON.stringify({ version: 1, ...visit }));
}

/** The visit staged before the wheel and the bottle it landed on, read once. */
export function consumeFancyReturn(): { visit: FancyVisit; bottleId: string | null } | null {
  const rawVisit = sessionStorage.getItem(FANCY_VISIT_KEY);
  const rawResult = sessionStorage.getItem(FANCY_RESULT_KEY);
  sessionStorage.removeItem(FANCY_VISIT_KEY);
  sessionStorage.removeItem(FANCY_RESULT_KEY);
  try {
    const visit = rawVisit ? JSON.parse(rawVisit) : null;
    if (visit?.version !== 1 || typeof visit.filters !== "object" || typeof visit.exact !== "boolean") return null;
    const result = rawResult ? JSON.parse(rawResult) : null;
    const bottleId = result?.version === 1 && typeof result.bottleId === "string" ? result.bottleId : null;
    return { visit: { filters: visit.filters, exact: visit.exact }, bottleId };
  } catch {
    return null;
  }
}
