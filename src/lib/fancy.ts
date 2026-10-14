import type { Bottle } from "../types";

export const FANCY_POOL_KEY = "what-to-drink-fancy-pool";
// The explicit file: Vite's dev server answers a bare "/fancy/" with the SPA's index.html.
export const FANCY_PICKER_URL = "/fancy/index.html";

export type FancyPoolPayload = {
  version: 1;
  bottles: Bottle[];
};

export function stageFancyPool(bottles: Bottle[]): void {
  const payload: FancyPoolPayload = { version: 1, bottles };
  sessionStorage.setItem(FANCY_POOL_KEY, JSON.stringify(payload));
}
