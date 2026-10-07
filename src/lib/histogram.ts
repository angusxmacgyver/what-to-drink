import type { Age } from "../types";

export type Bin = { from: number; to: number; count: number };

export type Histogram = {
  min: number;
  max: number;
  binWidth: number;
  bins: Bin[];
};

export function histogramDomain(values: number[], binWidth: number): { min: number; max: number } | null {
  if (values.length === 0 || binWidth <= 0) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const min = Math.floor(lo / binWidth) * binWidth;
  let max = Math.ceil(hi / binWidth) * binWidth;
  if (max === min) max = min + binWidth;
  return { min, max };
}

export function buildHistogram(values: number[], binWidth: number): Histogram | null {
  const domain = histogramDomain(values, binWidth);
  if (!domain) return null;
  const bins: Bin[] = [];
  for (let from = domain.min; from < domain.max; from += binWidth) {
    const to = from + binWidth;
    const last = to === domain.max;
    const count = values.filter((value) => value >= from && (last ? value <= to : value < to)).length;
    bins.push({ from, to, count });
  }
  return { min: domain.min, max: domain.max, binWidth, bins };
}

export function clampSelection(
  from: number,
  to: number,
  domainMin: number,
  domainMax: number,
  binWidth: number,
): { from: number; to: number } {
  const snap = (n: number) => Math.min(domainMax, Math.max(domainMin, Math.round(n)));
  let lo = snap(from);
  let hi = snap(to);
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi - lo < binWidth) {
    if (lo + binWidth <= domainMax) hi = lo + binWidth;
    else {
      hi = domainMax;
      lo = domainMax - binWidth;
    }
  }
  return { from: lo, to: hi };
}

export function matchesAbvRange(abv: number | null, from: number, to: number): boolean {
  if (abv == null) return true;
  return abv >= from && abv <= to;
}

export function matchesAgeRange(age: Age, from: number, to: number, includeNas: boolean): boolean {
  if (age == null || age === "NAS") return includeNas;
  return age >= from && age <= to;
}

export function nasCount(ages: Age[]): number {
  return ages.filter((age) => age == null || age === "NAS").length;
}

export function binFullyInside(bin: Bin, from: number, to: number): boolean {
  return bin.from >= from && bin.to <= to;
}
