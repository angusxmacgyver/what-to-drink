import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyFilters, type Bottle } from "../types";
import { consumeFancyReturn, FANCY_POOL_KEY, stageFancyPool, stageFancyVisit } from "./fancy";

describe("stageFancyPool", () => {
  const setItem = vi.fn();

  beforeEach(() => {
    setItem.mockReset();
    vi.stubGlobal("sessionStorage", { setItem });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("stages exactly the filtered physical bottles for the fancy picker", () => {
    const bottles = [
      { id: "open", bottleKey: "ardbeg::10", status: "Open" },
      { id: "closed", bottleKey: "ardbeg::10", status: "Closed" },
    ] as Bottle[];

    stageFancyPool(bottles);

    expect(setItem).toHaveBeenCalledWith(
      FANCY_POOL_KEY,
      JSON.stringify({ version: 1, bottles }),
    );
  });
});

describe("the fancy round trip", () => {
  let stored: Map<string, string>;

  beforeEach(() => {
    stored = new Map();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  const visit = { filters: { ...emptyFilters(), place: "apartment" as const, families: ["Smoke"] }, exact: true };

  it("returns the staged visit and the landed bottle once", () => {
    stageFancyVisit(visit);
    stored.set("what-to-drink-fancy-result", JSON.stringify({ version: 1, bottleId: "ardbeg-10" }));

    expect(consumeFancyReturn()).toEqual({ visit, bottleId: "ardbeg-10" });
    expect(consumeFancyReturn()).toBeNull();
  });

  it("returns the visit with no bottle when the wheel was left before it landed", () => {
    stageFancyVisit(visit);

    expect(consumeFancyReturn()).toEqual({ visit, bottleId: null });
  });

  it("ignores a result that no staged visit asked for, and discards it", () => {
    stored.set("what-to-drink-fancy-result", JSON.stringify({ version: 1, bottleId: "ardbeg-10" }));

    expect(consumeFancyReturn()).toBeNull();
    expect(stored.size).toBe(0);
  });

  it("treats unreadable data as no trip", () => {
    stored.set("what-to-drink-fancy-visit", "{not json");

    expect(consumeFancyReturn()).toBeNull();
    expect(stored.size).toBe(0);
  });
});
