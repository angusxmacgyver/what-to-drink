import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Bottle, FilterState } from "../types";
import { dramPool, groupLibrary } from "../lib/library";
import { BottleFields } from "./BottleFields";
import { DramFacets } from "./DramFacets";
import { activeFilterCount, FilterDrawer, FiltersButton } from "./FilterDrawer";
import { FlavorTags } from "./FlavorTags";
import { ExpressionDetail, LibraryCard } from "./Library";

type Place = "house" | "apartment";

export function DramResults({
  bottles,
  openKey,
  onToggle,
}: {
  bottles: Bottle[];
  openKey: string | null;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="library-grid">
      {groupLibrary(bottles).map((row) => {
        const expanded = openKey === row.bottleKey;
        return (
          <Fragment key={row.bottleKey}>
            <LibraryCard row={row} expanded={expanded} onToggle={() => onToggle(row.bottleKey)} />
            {expanded ? <ExpressionDetail bottles={row.bottles} owner={false} /> : null}
          </Fragment>
        );
      })}
    </div>
  );
}

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
  const [includeOpen, setIncludeOpen] = useState(true);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [pick, setPick] = useState<Bottle | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersButton = useRef<HTMLButtonElement>(null);

  const pool = useMemo(() => {
    if (!place) return [];
    return dramPool(bottles, place, includeClosed, filters, includeOpen);
  }, [bottles, place, includeClosed, includeOpen, filters]);

  useEffect(() => {
    if (!openKey || filtersOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenKey(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openKey, filtersOpen]);

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
          <button type="button" className="textish" onClick={() => { setPlace(null); setPick(null); setOpenKey(null); setFiltersOpen(false); }}>
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
          {pool.length === 0 ? (
            <p className="empty">Nothing matches these filters.</p>
          ) : (
            <DramResults
              bottles={pool}
              openKey={openKey}
              onToggle={(key) => setOpenKey(openKey === key ? null : key)}
            />
          )}
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
            includeOpen={includeOpen}
            onIncludeOpen={setIncludeOpen}
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
