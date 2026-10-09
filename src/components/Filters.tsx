import type { Bottle, FilterState } from "../types";
import { ChipSelect } from "./ChipSelect";
import { RangeHistogram } from "./RangeHistogram";
import { matchesFilters, matchesStatus, subsForFamilies, withoutRange } from "../lib/library";
import { abvHistogramValues, buildHistogram, nasCount } from "../lib/histogram";
import { familyClass, smwsThemeClass, subFamilyClass } from "../lib/colors";

type Props = {
  bottles: Bottle[];
  filters: FilterState;
  onChange: (next: FilterState) => void;
  showGeo?: boolean;
  showSearch?: boolean;
  showStatus?: boolean;
};

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function Filters({
  bottles,
  filters,
  onChange,
  showGeo = false,
  showSearch = true,
  showStatus = false,
}: Props) {
  const statuses = uniq(bottles.map((b) => b.status));
  const themes = uniq(bottles.map((b) => b.theme));
  const families = uniq(bottles.flatMap((b) => b.flavorFamilies));
  const subs = subsForFamilies(bottles, filters.families);
  const countries = uniq(bottles.map((b) => b.country));
  const regions = uniq(bottles.map((b) => b.region));

  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  const others = (axis: "age" | "abv") =>
    bottles.filter((b) => matchesStatus(b, filters.statuses) && matchesFilters(b, withoutRange(filters, axis)));
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
      {showStatus ? (
        <ChipSelect
          label="Status"
          options={statuses}
          value={filters.statuses}
          onChange={(statuses) => set({ statuses })}
        />
      ) : null}
      <ChipSelect
        label="SMWS Theme"
        options={themes}
        value={filters.themes}
        onChange={(themes) => set({ themes })}
        colorFor={smwsThemeClass}
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
          />
          <ChipSelect
            label="Region"
            options={regions}
            value={filters.regions}
            onChange={(regions) => set({ regions })}
          />
        </>
      ) : null}
      <ChipSelect
        label="Flavor families"
        options={families}
        value={filters.families}
        onChange={(nextFamilies) => {
          const keptSubs = filters.subs.filter((s) => subsForFamilies(bottles, nextFamilies).includes(s));
          set({ families: nextFamilies, subs: keptSubs });
        }}
        colorFor={familyClass}
      />
      <ChipSelect
        label="Sub-characteristics"
        options={subs}
        value={filters.subs}
        onChange={(subs) => set({ subs })}
        emptyHint="Pick a flavor family to narrow by sub-characteristic."
        colorFor={subFamilyClass}
      />
    </div>
  );
}
