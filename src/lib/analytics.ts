import type { Age, Bottle, Catalog } from "../types";

export type Entry = { label: string; count: number };
export type Share = { label: string; share: number };

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

export function familyShares(bottles: Bottle[], families?: string[]): Share[] {
  const tagged = bottles.filter((b) => b.flavorFamilies.length > 0);
  const counts = tally(tagged.flatMap((b) => b.flavorFamilies));
  const order = families ?? counts.map((e) => e.label);
  return order.map((label) => ({
    label,
    share: tagged.length ? (counts.find((e) => e.label === label)?.count ?? 0) / tagged.length : 0,
  }));
}

export function subFamily(bottles: Bottle[]): Record<string, string> {
  const pairs = new Map<string, Map<string, number>>();
  for (const b of bottles) {
    for (const sub of b.subCharacteristics) {
      const byFamily = pairs.get(sub) ?? new Map<string, number>();
      for (const family of b.flavorFamilies) byFamily.set(family, (byFamily.get(family) ?? 0) + 1);
      pairs.set(sub, byFamily);
    }
  }
  const result: Record<string, string> = {};
  for (const [sub, byFamily] of pairs) {
    const best = [...byFamily].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (best) result[sub] = best[0];
  }
  return result;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 10) / 10;
}

function fingerprintTakeaway(families: string[], cellar: number[], open: number[]): string {
  if (!open.some((s) => s > 0)) return "No open bottles have flavor tags yet.";
  let best = 0;
  for (let i = 1; i < families.length; i += 1) {
    if (open[i] - cellar[i] > open[best] - cellar[best]) best = i;
  }
  if (open[best] - cellar[best] < 0.01) return "Open bottles match the cellar's flavor profile.";
  return `Open bottles lean ${families[best]}: ${pct(open[best])} vs ${pct(cellar[best])} across the cellar.`;
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

  const cellarShares = familyShares(bottles);
  const families = cellarShares.map((s) => s.label);
  const cellar = cellarShares.map((s) => s.share);
  const open = familyShares(bottles.filter((b) => b.status === "Open"), families).map((s) => s.share);

  const subOwner = subFamily(bottles);
  const subCounts = tally(bottles.flatMap((b) => b.subCharacteristics));
  const palate = families
    .map((family) => ({ family, subs: subCounts.filter((e) => subOwner[e.label] === family) }))
    .filter((group) => group.subs.length > 0);

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
    fingerprint: fingerprintTakeaway(families, cellar, open),
  };

  return {
    totals,
    topRegion,
    regions,
    producers,
    ages,
    abvs: abvBuckets,
    smoke: { smoke, noSmoke: total - smoke - untagged, untagged },
    fingerprint: { families, cellar, open },
    palate,
    takeaways,
  };
}

export type CellarSummary = ReturnType<typeof cellarSummary>;
