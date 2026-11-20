import type { Age, Bottle, Catalog, WheelFamily } from "../types";
import { placeTerm, sameTerm } from "./wheel";

export type Entry = { label: string; count: number };
export type RadarSpoke = { label: string; color: string; cellar: number; open: number };
export type PalateGroup = { family: string; color: string; descriptors: Entry[] };

export const AGE_BUCKETS = ["NAS", "Under 10", "10-14", "15-19", "20-24", "25+", "Unknown"];
export const ABV_BUCKETS = ["40-45", "45-50", "50-55", "55-60", "60+", "Unknown"];

export function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function tally(values: string[], blankLabel = "Unknown"): Entry[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const label = value || blankLabel;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function topN(entries: Entry[], n: number): Entry[] {
  if (entries.length <= n) return entries;
  const rest = entries.slice(n).reduce((sum, e) => sum + e.count, 0);
  return [...entries.slice(0, n), { label: "Other", count: rest }];
}

export function parentRegion(region: string): string {
  return region.split(",")[0].trim();
}

export function ageBucket(age: Age): string {
  if (age === "NAS") return "NAS";
  if (age == null) return "Unknown";
  if (age < 10) return "Under 10";
  if (age < 15) return "10-14";
  if (age < 20) return "15-19";
  if (age < 25) return "20-24";
  return "25+";
}

export function abvBucket(abv: number | null): string {
  if (abv == null) return "Unknown";
  if (abv < 45) return "40-45";
  if (abv < 50) return "45-50";
  if (abv < 55) return "50-55";
  if (abv < 60) return "55-60";
  return "60+";
}

function inOrder(labels: string[], order: string[]): Entry[] {
  const counts = new Map(tally(labels).map((e) => [e.label, e.count]));
  return order
    .map((label) => ({ label, count: counts.get(label) ?? 0 }))
    .filter((e) => e.label !== "Unknown" || e.count > 0);
}

function carriesFamily(wheel: WheelFamily[], bottle: Bottle): boolean {
  return bottle.wheelFamilies.some((term) => placeTerm(wheel, "family", term).family !== null);
}

/** One spoke per Family, in wheel order. Shares are among bottles that carry a Family. */
export function flavorRadar(wheel: WheelFamily[], bottles: Bottle[]): RadarSpoke[] {
  const tagged = bottles.filter((bottle) => carriesFamily(wheel, bottle));
  const open = tagged.filter((bottle) => bottle.status === "Open");
  const share = (list: Bottle[], family: string) => {
    if (!list.length) return 0;
    const count = list.filter((bottle) => bottle.wheelFamilies.some((term) => sameTerm(term, family))).length;
    return count / list.length;
  };
  return wheel.map((family) => ({
    label: family.name,
    color: family.color,
    cellar: share(tagged, family.name),
    open: share(open, family.name),
  }));
}

/** Descriptors on the wheel, counted once per bottle, under their Family. A Family with none is left out. */
export function palateCloud(wheel: WheelFamily[], bottles: Bottle[]): PalateGroup[] {
  const counts = new Map<string, number>();
  for (const bottle of bottles) {
    const seen = new Set<string>();
    for (const term of bottle.wheelDescriptors) {
      const placed = placeTerm(wheel, "descriptor", term);
      if (placed.family === null) continue;
      const key = placed.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return wheel.flatMap((family) => {
    const descriptors = family.subgroups
      .flatMap((subgroup) => subgroup.descriptors)
      .filter((label) => counts.has(label.toLowerCase()))
      .map((label) => ({ label, count: counts.get(label.toLowerCase()) ?? 0 }))
      .sort((a, b) => b.count - a.count);
    return descriptors.length ? [{ family: family.name, color: family.color, descriptors }] : [];
  });
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 10) / 10;
}

function fingerprintTakeaway(spokes: RadarSpoke[]): string {
  if (!spokes.some((spoke) => spoke.open > 0)) return "No open bottles carry a Family yet.";
  let best = 0;
  for (let i = 1; i < spokes.length; i += 1) {
    if (spokes[i].open - spokes[i].cellar > spokes[best].open - spokes[best].cellar) best = i;
  }
  const spoke = spokes[best];
  if (spoke.open - spoke.cellar < 0.01) return "Open bottles match the cellar's Families.";
  return `Open bottles lean ${spoke.label}: ${pct(spoke.open)} vs ${pct(spoke.cellar)} across the cellar.`;
}

export function cellarSummary(catalog: Catalog) {
  const bottles = catalog.bottles;
  const total = bottles.length;
  const abvs = bottles.map((b) => b.abv).filter((a): a is number => a != null);
  const smoke = bottles.filter((b) => b.flavorFamilies.includes("Smoke")).length;
  const untagged = bottles.filter((b) => b.flavorFamilies.length === 0).length;

  const allRegions = tally(bottles.map((b) => parentRegion(b.region)));
  const regions = topN(allRegions, 8);
  const topRegion = { label: allRegions[0]?.label ?? "", share: total ? (allRegions[0]?.count ?? 0) / total : 0 };
  const producers = topN(tally(bottles.map((b) => b.distillery)), 10).filter((e) => e.label !== "Other");
  const ages = inOrder(bottles.map((b) => ageBucket(b.age)), AGE_BUCKETS);
  const abvBuckets = inOrder(bottles.map((b) => abvBucket(b.abv)), ABV_BUCKETS);

  const spokes = flavorRadar(catalog.wheel, bottles);
  const palate = palateCloud(catalog.wheel, bottles);

  const totals = {
    bottles: total,
    producers: new Set(bottles.map((b) => b.distillery)).size,
    expressions: new Set(bottles.map((b) => b.bottleKey)).size,
    open: bottles.filter((b) => b.status === "Open").length,
    closed: bottles.filter((b) => b.status === "Closed").length,
    graveyard: catalog.graveyard.length,
    medianAbv: median(abvs),
    smokeShare: total ? smoke / total : 0,
  };

  const [first, second] = producers;
  const commonAge = [...ages].sort((a, b) => b.count - a.count)[0];
  const strong = abvs.filter((a) => a >= 50).length;

  const takeaways = {
    shelf: `${totals.open} open, ${totals.closed} closed. ${totals.graveyard} finished in the Graveyard.`,
    regions: topRegion.label
      ? `${topRegion.label}: ${pct(topRegion.share)} of the cellar (${allRegions[0].count} bottles).`
      : "",
    producers:
      first && second
        ? `${first.label}: ${first.count} bottles, ${Number((first.count / second.count).toFixed(1))}x the next producer (${second.label}, ${second.count}).`
        : "",
    ages: commonAge ? `Most common: ${commonAge.label} (${commonAge.count} bottles).` : "",
    abv: abvs.length ? `Median ${totals.medianAbv}%. ${pct(strong / abvs.length)} of bottles are 50% or stronger.` : "",
    smoke: `${smoke} of ${total} bottles carry Smoke. ${untagged} have no flavor tags.`,
    fingerprint: fingerprintTakeaway(spokes),
  };

  return {
    totals,
    topRegion,
    regions,
    producers,
    ages,
    abvs: abvBuckets,
    smoke: { smoke, noSmoke: total - smoke - untagged, untagged },
    fingerprint: spokes,
    palate,
    takeaways,
  };
}

export type CellarSummary = ReturnType<typeof cellarSummary>;
