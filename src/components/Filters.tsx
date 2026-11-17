import type { Bottle, FilterState, WheelFamily } from "../types";
import { ChipSelect } from "./ChipSelect";
import { RangeHistogram } from "./RangeHistogram";
import { LAST_THIRD, matchesFilters, optionCounts, withoutRange, type CountFacet } from "../lib/library";
import { abvHistogramValues, buildHistogram, nasCount } from "../lib/histogram";
import { scopeWheelFilters } from "../lib/applied";
import { compareSmwsThemes, smwsThemeClass, wheelTermClass } from "../lib/colors";
import { familyOptions, scopedOptions, type WheelLevel } from "../lib/wheel";

type Props = {
  bottles: Bottle[];
  wheel: WheelFamily[];
  filters: FilterState;
  onChange: (next: FilterState) => void;
  exact: boolean;
  showGeo?: boolean;
  showSearch?: boolean;
  showStatus?: boolean;
};

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function Filters({
  bottles,
  wheel,
  filters,
  onChange,
  exact,
  showGeo = false,
  showSearch = true,
  showStatus = false,
}: Props) {
  const statuses = uniq(bottles.map((b) => b.status));
  const themes = uniq(bottles.map((b) => b.theme)).sort(compareSmwsThemes);
  const families = familyOptions(wheel, bottles.flatMap((b) => b.wheelFamilies));
  const subs = scopedOptions(wheel, "subgroup", filters.families, bottles.flatMap((b) => b.wheelSubgroups));
  const descriptors = scopedOptions(
    wheel,
    "descriptor",
    filters.subs,
    bottles.flatMap((b) => b.wheelDescriptors),
  );
  const countries = uniq(bottles.map((b) => b.country));
  const regions = uniq(bottles.map((b) => b.region));

  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });
  const colorFor = (level: WheelLevel) => (term: string) => wheelTermClass(wheel, level, term);

  const counts = (facet: CountFacet, options: string[]) => optionCounts(bottles, filters, facet, options, exact);
  const placeCounts = counts("place", ["house", "apartment"]);

  const others = (axis: "age" | "abv") => bottles.filter((b) => matchesFilters(b, withoutRange(filters, axis), exact));
  const ageSource = others("age");
  const ages = ageSource.map((b) => b.age).filter((a): a is number => typeof a === "number");
  const abvs = abvHistogramValues(others("abv").map((b) => b.abv));
  const ageHistogram = buildHistogram(ages, 2);
  const abvHistogram = buildHistogram(abvs, 2);
  const nas = nasCount(ageSource.map((b) => b.age));

  const setAge = (low: number, high: number) => {
    if (!ageHistogram || (low <= ageHistogram.min && high >= ageHistogram.max)) set({ ageMin: "", ageMax: "" });
    else set({ ageMin: String(low), ageMax: String(high) });
  };
  const setAbv = (low: number, high: number) => {
    if (!abvHistogram || (low <= abvHistogram.min && high >= abvHistogram.max)) set({ abvMin: "", abvMax: "" });
    else set({ abvMin: String(low), abvMax: String(high) });
  };

  return (
    <div className="filters">
      {showSearch ? (
        <label className="grow">
          Search
          <input
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Distillery, expression, code…"
          />
        </label>
      ) : null}
      <ChipSelect
        label="Place"
        options={["House", "Apartment"]}
        value={filters.place === "house" ? ["House"] : filters.place === "apartment" ? ["Apartment"] : []}
        onChange={(places) => {
          const last = places.at(-1);
          set({ place: last === "House" ? "house" : last === "Apartment" ? "apartment" : null });
        }}
        counts={{ House: placeCounts.house, Apartment: placeCounts.apartment }}
      />
      {showStatus ? (
        <ChipSelect
          label="Status"
          options={[...statuses, LAST_THIRD]}
          value={filters.lastThird ? [...filters.statuses, LAST_THIRD] : filters.statuses}
          onChange={(picked) =>
            set({ statuses: picked.filter((option) => option !== LAST_THIRD), lastThird: picked.includes(LAST_THIRD) })
          }
          counts={{ ...counts("status", statuses), ...counts("lastThird", [LAST_THIRD]) }}
        />
      ) : null}
      <ChipSelect
        label="SMWS Theme"
        options={themes}
        value={filters.themes}
        onChange={(themes) => set({ themes })}
        colorFor={smwsThemeClass}
        counts={counts("theme", themes)}
      />
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
              nas={{ included: filters.includeNas, count: nas, onToggle: () => set({ includeNas: !filters.includeNas }) }}
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
      {showGeo ? (
        <>
          <ChipSelect
            label="Country"
            options={countries}
            value={filters.countries}
            onChange={(countries) => set({ countries })}
            counts={counts("country", countries)}
          />
          <ChipSelect
            label="Region"
            options={regions}
            value={filters.regions}
            onChange={(regions) => set({ regions })}
            counts={counts("region", regions)}
          />
        </>
      ) : null}
      <ChipSelect
        label="Family"
        options={families}
        value={filters.families}
        onChange={(nextFamilies) => onChange(scopeWheelFilters(wheel, filters, { families: nextFamilies }))}
        colorFor={colorFor("family")}
        counts={counts("family", families)}
      />
      <ChipSelect
        label="Subgroup"
        options={subs}
        value={filters.subs}
        onChange={(nextSubs) => onChange(scopeWheelFilters(wheel, filters, { subs: nextSubs }))}
        emptyHint="Pick a Family to narrow by Subgroup."
        colorFor={colorFor("subgroup")}
        counts={counts("sub", subs)}
      />
      <ChipSelect
        label="Descriptor"
        options={descriptors}
        value={filters.descriptors}
        onChange={(nextDescriptors) => onChange(scopeWheelFilters(wheel, filters, { descriptors: nextDescriptors }))}
        emptyHint="Pick a Subgroup to narrow by Descriptor."
        colorFor={colorFor("descriptor")}
        counts={counts("descriptor", descriptors)}
      />
    </div>
  );
}
