import { useMemo, useRef, useState } from "react";
import type { Bottle, FilterState } from "../types";
import { dramPool } from "../lib/library";
import { BottleFields } from "./BottleFields";
import { DramFacets } from "./DramFacets";
import { activeFilterCount, FilterDrawer, FiltersButton } from "./FilterDrawer";
import { FlavorTags } from "./FlavorTags";

type Place = "house" | "apartment";

export function PickADram({
  bottles,
  filters,
  onFilters,
}: {
  bottles: Bottle[];
  filters: FilterState;
  onFilters: (next: FilterState) => void;
}) {
  const [place, setPlace] = useState<Place | null>(null);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [pick, setPick] = useState<Bottle | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersButton = useRef<HTMLButtonElement>(null);

  const pool = useMemo(() => {
    if (!place) return [];
    return dramPool(bottles, place, includeClosed, filters);
  }, [bottles, place, includeClosed, filters]);

  const roll = () => {
    if (!place) return;
    if (pool.length === 0) {
      setPick(null);
      return;
    }
    setPick(pool[Math.floor(Math.random() * pool.length)]);
  };

  if (!place) {
    return (
      <section className="panel dram-start">
        <h1>Pick a Dram</h1>
        <p className="lede">Are you at the apartment or the house?</p>
        <div className="place">
          <button type="button" onClick={() => setPlace("house")}>
            House
          </button>
          <button type="button" onClick={() => setPlace("apartment")}>
            Apartment
          </button>
        </div>
      </section>
    );
  }

  const emptyApartment = place === "apartment" && bottles.every((b) => !b.atApartment);

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Randomizer · {place}</p>
          <h1>Pick a Dram</h1>
        </div>
        <div className="panel-actions">
          <FiltersButton
            count={activeFilterCount(filters)}
            open={filtersOpen}
            buttonRef={filtersButton}
            onClick={() => setFiltersOpen(true)}
          />
          <button type="button" className="textish" onClick={() => { setPlace(null); setPick(null); setFiltersOpen(false); }}>
            Change place
          </button>
        </div>
      </header>
      {emptyApartment ? (
        <p className="empty">No bottles are tagged for the apartment yet. The house holds the cellar.</p>
      ) : (
        <>
          <p className="count">{pool.length} available</p>
          <button type="button" className="roll" onClick={roll} disabled={pool.length === 0}>
            Pour one
          </button>
          {pool.length === 0 ? <p className="empty">Nothing matches these filters.</p> : null}
          {pick ? (
            <div className="result">
              <h2>
                {pick.distillery}{" "}
                <em>{pick.bottling}</em>
              </h2>
              <p className="walk">
                Bottle is at: {pick.location || "not tagged yet"}
              </p>
              <FlavorTags families={pick.flavorFamilies} subs={pick.subCharacteristics} />
              <BottleFields bottle={pick} />
            </div>
          ) : null}
        </>
      )}
      {filtersOpen ? (
        <FilterDrawer
          filters={filters}
          onChange={onFilters}
          available={pool.length}
          onPour={roll}
          onClose={() => {
            setFiltersOpen(false);
            filtersButton.current?.focus();
          }}
        >
          <DramFacets
            bottles={bottles}
            place={place}
            includeClosed={includeClosed}
            onIncludeClosed={setIncludeClosed}
            filters={filters}
            onChange={onFilters}
          />
        </FilterDrawer>
      ) : null}
    </section>
  );
}
