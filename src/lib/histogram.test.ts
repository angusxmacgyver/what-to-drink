import { describe, expect, it } from "vitest";
import {
  binFullyInside,
  buildHistogram,
  clampSelection,
  histogramDomain,
  matchesAgeRange,
  matchesAbvRange,
  nasCount,
} from "./histogram";

describe("histogramDomain", () => {
  it("floors the minimum and ceils the maximum to the bin width", () => {
    expect(histogramDomain([40.2, 63.1], 2)).toEqual({ min: 40, max: 64 });
  });

  it("expands a single boundary value into one bin", () => {
    expect(histogramDomain([46], 2)).toEqual({ min: 46, max: 48 });
  });

  it("returns nothing when there are no values", () => {
    expect(histogramDomain([], 2)).toBeNull();
  });
});

describe("buildHistogram", () => {
  it("counts each value into the bin that starts at its edge, and keeps the maximum in the last bin", () => {
    const histogram = buildHistogram([40, 42, 43.5, 46], 2);
    expect(histogram).toEqual({
      min: 40,
      max: 46,
      binWidth: 2,
      bins: [
        { from: 40, to: 42, count: 1 },
        { from: 42, to: 44, count: 2 },
        { from: 44, to: 46, count: 1 },
      ],
    });
  });
});

describe("clampSelection", () => {
  it("snaps both ends to whole numbers inside the domain", () => {
    expect(clampSelection(39.6, 60.4, 40, 64, 2)).toEqual({ from: 40, to: 60 });
  });

  it("keeps the selection at least one bin wide", () => {
    expect(clampSelection(40, 41, 40, 64, 2)).toEqual({ from: 40, to: 42 });
  });

  it("pulls the start back when the end is already at the domain max", () => {
    expect(clampSelection(63, 64, 40, 64, 2)).toEqual({ from: 62, to: 64 });
  });

  it("uncrosses ends that were entered backwards", () => {
    expect(clampSelection(50, 40, 40, 64, 2)).toEqual({ from: 40, to: 50 });
  });
});

describe("range matching", () => {
  it("lets a blank ABV through and includes the ends of the range", () => {
    expect(matchesAbvRange(null, 40, 50)).toBe(true);
    expect(matchesAbvRange(40, 40, 50)).toBe(true);
    expect(matchesAbvRange(50, 40, 50)).toBe(true);
    expect(matchesAbvRange(39.9, 40, 50)).toBe(false);
  });

  it("treats a blank age like NAS and leaves numeric ages on the range", () => {
    expect(matchesAgeRange("NAS", 10, 20, true)).toBe(true);
    expect(matchesAgeRange(null, 10, 20, true)).toBe(true);
    expect(matchesAgeRange("NAS", 10, 20, false)).toBe(false);
    expect(matchesAgeRange(null, 10, 20, false)).toBe(false);
    expect(matchesAgeRange(10, 10, 20, false)).toBe(true);
    expect(matchesAgeRange(9, 10, 20, true)).toBe(false);
  });

  it("counts NAS and blank ages together", () => {
    expect(nasCount(["NAS", null, 12, 18])).toBe(2);
  });
});

describe("binFullyInside", () => {
  const bin = { from: 40, to: 42, count: 1 };

  it("paints a bin only when the whole bin sits inside the selection", () => {
    expect(binFullyInside(bin, 40, 50)).toBe(true);
    expect(binFullyInside(bin, 41, 50)).toBe(false);
  });
});
