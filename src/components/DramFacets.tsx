import type { Bottle, FilterState } from "../types";
import type { CountFacet, DramPlace } from "../lib/library";
import { dramCandidates, facetCounts, subOwnerFamily, uniqueTags } from "../lib/library";
import { familyClass, subFamilyClass } from "../lib/colors";
import { abvHistogramValues, buildHistogram, nasCount } from "../lib/histogram";
import { DistilleryCombobox } from "./DistilleryCombobox";
import { OptionGrid } from "./OptionGrid";
import { RangeHistogram } from "./RangeHistogram";

type Props = {
  bottles: Bottle[];
  place: DramPlace;
  includeOpen?: boolean;
  onIncludeOpen: (next: boolean) => void;
  includeClosed: boolean;
  onIncludeClosed: (next: boolean) => void;
  filters: FilterState;
  onChange: (next: FilterState) => void;
};

function sorted(values: string[]): string[] {
  return uniqueTags(values).sort((a, b) => a.localeCompare(b));
}

function kept(current: string[], group: string[], next: string[]): string[] {
  const hide = new Set(group);
  return [...current.filter((item) => !hide.has(item)), ...next];
}

/** One region is already chosen by the country, so it gets no sub-list. */
function multiRegions(bottles: Bottle[], country: string): string[] {
  const regions = sorted(bottles.filter((bottle) => bottle.country === country).map((bottle) => bottle.region));
  return regions.length > 1 ? regions : [];
}

function ownedSubs(bottles: Bottle[], family: string): string[] {
  return sorted(bottles.flatMap((bottle) => bottle.subCharacteristics).filter((sub) => subOwnerFamily(sub) === family));
}

function unownedSubs(bottles: Bottle[]): string[] {
  return sorted(bottles.flatMap((bottle) => bottle.subCharacteristics).filter((sub) => subOwnerFamily(sub) === undefined));
}

export function DramFacets({
  bottles,
  place,
  includeOpen = true,
  onIncludeOpen,
  includeClosed,
  onIncludeClosed,
  filters,
  onChange,
}: Props) {
  const candidates = dramCandidates(bottles, place, includeClosed, includeOpen);
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });
  const tiles = (facet: CountFacet, options: string[], swatch?: (label: string) => string) => {
    const tally = facetCounts(bottles, place, includeClosed, filters, facet, options, includeOpen);
    return options.map((label) => ({ label, count: tally[label] ?? 0, swatch: swatch?.(label) }));
  };
  const scoped = (
    id: string,
    label: string,
    field: "subs" | "regions",
    facet: CountFacet,
    options: string[],
    swatch?: (label: string) => string,
  ) => {
    if (options.length === 0) return null;
    const selected = filters[field];
    return (
      <OptionGrid
        key={id}
        id={id}
        label={label}
        options={tiles(facet, options, swatch)}
        value={selected.filter((item) => options.includes(item))}
        onChange={(next) => set({ [field]: kept(selected, options, next) })}
      />
    );
  };

  const distilleries = sorted(candidates.map((bottle) => bottle.distillery));
  const themes = sorted(candidates.map((bottle) => bottle.theme));
  const families = sorted(candidates.flatMap((bottle) => bottle.flavorFamilies));
  const countries = sorted(candidates.map((bottle) => bottle.country));
  const loose = unownedSubs(candidates);
  const ages = candidates.map((bottle) => bottle.age).filter((age): age is number => typeof age === "number");
  const ageHistogram = buildHistogram(ages, 2);
  const abvHistogram = buildHistogram(abvHistogramValues(candidates.map((bottle) => bottle.abv)), 2);

  const pickFamilies = (next: string[]) => {
    const allowed = new Set(next.flatMap((family) => ownedSubs(candidates, family)));
    if (next.length) for (const sub of loose) allowed.add(sub);
    set({ families: next, subs: filters.subs.filter((sub) => allowed.has(sub)) });
  };
  const pickCountries = (next: string[]) => {
    const allowed = new Set(next.flatMap((country) => multiRegions(candidates, country)));
    set({ countries: next, regions: filters.regions.filter((region) => allowed.has(region)) });
  };
  const setAge = (low: number, high: number) => {
    if (!ageHistogram || (low <= ageHistogram.min && high >= ageHistogram.max)) set({ ageMin: "", ageMax: "" });
    else set({ ageMin: String(low), ageMax: String(high) });
  };
  const setAbv = (low: number, high: number) => {
    if (!abvHistogram || (low <= abvHistogram.min && high >= abvHistogram.max)) set({ abvMin: "", abvMax: "" });
    else set({ abvMin: String(low), abvMax: String(high) });
  };

  const availability = (on: boolean) => (on ? "chip on" : "chip");

  return (
    <>
      <div className="match-row" role="group" aria-label="Opened or closed">
        <button type="button" className={availability(includeOpen)} aria-pressed={includeOpen} onClick={() => onIncludeOpen(!includeOpen)}>
          Opened
        </button>
        <button type="button" className={availability(includeClosed)} aria-pressed={includeClosed} onClick={() => onIncludeClosed(!includeClosed)}>
          Closed
        </button>
      </div>
      <div className="filters">
        <label className="grow">
          Search
          <input
            value={filters.search}
            onChange={(event) => set({ search: event.target.value })}
            placeholder="Distillery, expression, code…"
          />
        </label>
        <DistilleryCombobox
          options={distilleries}
          counts={facetCounts(bottles, place, includeClosed, filters, "distillery", distilleries, includeOpen)}
          value={filters.distilleries}
          onChange={(next) => set({ distilleries: next })}
        />
        <OptionGrid id="theme" label="Theme" options={tiles("theme", themes)} value={filters.themes} onChange={(next) => set({ themes: next })} />
        <div className="match-row" role="group" aria-label="Flavor match">
          <span className="chipset-label">Match</span>
          <button type="button" className={filters.flavorMatch === "any" ? "chip on" : "chip"} aria-pressed={filters.flavorMatch === "any"} onClick={() => set({ flavorMatch: "any" })}>
            Any
          </button>
          <button type="button" className={filters.flavorMatch === "all" ? "chip on" : "chip"} aria-pressed={filters.flavorMatch === "all"} onClick={() => set({ flavorMatch: "all" })}>
            All
          </button>
        </div>
        <OptionGrid
          id="family"
          label="Flavor families"
          options={tiles("family", families, familyClass)}
          value={filters.families}
          onChange={pickFamilies}
        />
        {filters.families.length === 0 ? (
          <p className="chipset-hint">Pick a flavor family to narrow by sub-characteristic.</p>
        ) : (
          <>
            {filters.families.map((family) => scoped(`sub-${family}`, family, "subs", "sub", ownedSubs(candidates, family), subFamilyClass))}
            {scoped("sub-other", "Other", "subs", "sub", loose, subFamilyClass)}
          </>
        )}
        {ageHistogram || abvHistogram ? (
          <div className="hist-pair">
            {ageHistogram ? (
              <RangeHistogram
                label="Age"
                histogram={ageHistogram}
                unit="yr"
                from={filters.ageMin === "" ? ageHistogram.min : Number(filters.ageMin)}
                to={filters.ageMax === "" ? ageHistogram.max : Number(filters.ageMax)}
                onChange={setAge}
                nas={{ included: filters.includeNas, count: nasCount(candidates.map((bottle) => bottle.age)), onToggle: () => set({ includeNas: !filters.includeNas }) }}
              />
            ) : null}
            {abvHistogram ? (
              <RangeHistogram
                label="ABV"
                histogram={abvHistogram}
                unit="%"
                from={filters.abvMin === "" ? abvHistogram.min : Number(filters.abvMin)}
                to={filters.abvMax === "" ? abvHistogram.max : Number(filters.abvMax)}
                onChange={setAbv}
              />
            ) : null}
          </div>
        ) : null}
        <OptionGrid id="country" label="Country" options={tiles("country", countries)} value={filters.countries} onChange={pickCountries} />
        {filters.countries.length === 0 ? (
          <p className="chipset-hint">Select a country to narrow by region.</p>
        ) : (
          filters.countries.map((country) => scoped(`region-${country}`, country, "regions", "region", multiRegions(candidates, country)))
        )}
      </div>
    </>
  );
}
