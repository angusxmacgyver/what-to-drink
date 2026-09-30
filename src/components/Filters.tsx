import type { Bottle, FilterState } from "../types";
import { ChipSelect } from "./ChipSelect";
import { DistilleryCombobox } from "./DistilleryCombobox";
import { RangeSlider } from "./RangeSlider";
import { distilleryCounts, subsForFamilies } from "../lib/library";
import { familyClass } from "../lib/colors";

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
  const distilleries = uniq(bottles.map((b) => b.distillery));
  const statuses = uniq(bottles.map((b) => b.status));
  const distilleryTally = distilleryCounts(bottles);
  const themes = uniq(bottles.map((b) => b.theme));
  const families = uniq(bottles.flatMap((b) => b.flavorFamilies));
  const subs = subsForFamilies(bottles, filters.families);
  const countries = uniq(bottles.map((b) => b.country));
  const regions = uniq(bottles.map((b) => b.region));

  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  const hasNas = bottles.some((b) => b.age === "NAS");
  const ages = bottles.map((b) => b.age).filter((a): a is number => typeof a === "number");
  const abvs = bottles.map((b) => b.abv).filter((a): a is number => a != null);
  const ageMinBound = ages.length ? Math.min(...ages) : 0;
  const ageMaxBound = ages.length ? Math.max(...ages) : 1;
  const ageSliderMin = hasNas && ages.length ? ageMinBound - 1 : ageMinBound;
  const abvMinBound = abvs.length ? Math.floor(Math.min(...abvs) * 10) / 10 : 0;
  const abvMaxBound = abvs.length ? Math.ceil(Math.max(...abvs) * 10) / 10 : 1;

  const encodeAge = (n: number) => (hasNas && n <= ageSliderMin ? "NAS" : String(n));
  const decodeAge = (s: string, fallback: number) => {
    if (s === "") return fallback;
    if (s === "NAS") return ageSliderMin;
    return Number(s);
  };

  const setAge = (low: number, high: number) => {
    if (low <= ageSliderMin && high >= ageMaxBound) set({ ageMin: "", ageMax: "" });
    else set({ ageMin: encodeAge(low), ageMax: encodeAge(high) });
  };
  const setAbv = (low: number, high: number) => {
    if (low <= abvMinBound && high >= abvMaxBound) set({ abvMin: "", abvMax: "" });
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
      <DistilleryCombobox
        options={distilleries}
        counts={distilleryTally}
        value={filters.distilleries}
        onChange={(distilleries) => set({ distilleries })}
      />
      {showStatus ? (
        <ChipSelect
          label="Status"
          options={statuses}
          value={filters.statuses}
          onChange={(statuses) => set({ statuses })}
        />
      ) : null}
      <ChipSelect
        label="Theme"
        options={themes}
        value={filters.themes}
        onChange={(themes) => set({ themes })}
      />
      {ages.length ? (
        <RangeSlider
          label="Age"
          min={ageSliderMin}
          max={ageMaxBound}
          step={1}
          low={decodeAge(filters.ageMin, ageSliderMin)}
          high={decodeAge(filters.ageMax, ageMaxBound)}
          format={(n) => (hasNas && n <= ageSliderMin ? "NAS" : `${n} yr`)}
          onChange={setAge}
        />
      ) : null}
      {abvs.length ? (
        <RangeSlider
          label="ABV"
          min={abvMinBound}
          max={abvMaxBound}
          step={0.1}
          low={filters.abvMin === "" ? abvMinBound : Number(filters.abvMin)}
          high={filters.abvMax === "" ? abvMaxBound : Number(filters.abvMax)}
          format={(n) => `${n.toFixed(1)}%`}
          onChange={setAbv}
        />
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
      />
    </div>
  );
}
