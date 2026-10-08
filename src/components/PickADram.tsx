import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Bottle, FilterState } from "../types";
import { dramPool, groupLibrary } from "../lib/library";
import { choosePour, prefersReducedMotion, rollFrames, settlePick } from "../lib/pour";
import { mostConstraining, popHistory, pushHistory } from "../lib/recovery";
import { loadDramSelection, saveDramScope } from "../lib/store";
import { AppliedTray } from "./AppliedTray";
import { DramFacets } from "./DramFacets";
import { activeFilterCount, FilterDrawer, FiltersButton } from "./FilterDrawer";
import { ExpressionDetail, LibraryCard } from "./Library";

type Place = "house" | "apartment";

export function DramResults({
  bottles,
  openKey,
  onToggle,
  pickedId = null,
  rollingKey = null,
  announce = "",
}: {
  bottles: Bottle[];
  openKey: string | null;
  onToggle: (key: string) => void;
  pickedId?: string | null;
  rollingKey?: string | null;
  announce?: string;
}) {
  const picked = pickedId ? bottles.find((bottle) => bottle.id === pickedId) : undefined;
  return (
    <>
      <p className="live" aria-live="polite">{announce}</p>
      <div className="library-grid">
        {groupLibrary(bottles).map((row) => {
          const expanded = openKey === row.bottleKey;
          const isPicked = picked?.bottleKey === row.bottleKey;
          return (
            <Fragment key={row.bottleKey}>
              <LibraryCard
                row={row}
                expanded={expanded}
                picked={isPicked}
                rolling={rollingKey === row.bottleKey}
                where={isPicked ? picked?.location : undefined}
                cardId={`dram-${row.bottleKey}`}
                onToggle={() => onToggle(row.bottleKey)}
              />
              {expanded ? (
                <ExpressionDetail
                  bottles={row.bottles}
                  owner={false}
                  trail={isPicked ? <div className="just-poured" /> : undefined}
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </>
  );
}

export function DramSummary({
  available,
  filters,
  onFilters,
  onUndo,
  canUndo = false,
  flagId = null,
  children,
}: {
  available: number;
  filters: FilterState;
  onFilters: (next: FilterState) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  flagId?: string | null;
  children: ReactNode;
}) {
  return (
    <>
      <div className="dram-summary">
        <p className="count">{available} available</p>
        <AppliedTray filters={filters} onChange={onFilters} flagId={flagId} />
      </div>
      {available === 0 ? (
        <div className="recovery">
          <p className="empty">No bottles match this combination.</p>
          <button type="button" onClick={onUndo} disabled={!canUndo}>
            Undo last
          </button>
        </div>
      ) : (
        children
      )}
    </>
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
  const [place, setPlace] = useState<Place | null>(() => loadDramSelection()?.place ?? null);
  const [includeOpen, setIncludeOpen] = useState(() => loadDramSelection()?.includeOpen ?? true);
  const [includeClosed, setIncludeClosed] = useState(() => loadDramSelection()?.includeClosed ?? false);
  const [pick, setPick] = useState<Bottle | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [rollingKey, setRollingKey] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersButton = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const pendingId = useRef<string | null>(null);
  const history = useRef<FilterState[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const pool = useMemo(() => {
    if (!place) return [];
    return dramPool(bottles, place, includeClosed, filters, includeOpen);
  }, [bottles, place, includeClosed, includeOpen, filters]);

  const flagId = useMemo(() => {
    if (!place || pool.length > 0) return null;
    return mostConstraining(bottles, place, includeClosed, filters, includeOpen);
  }, [bottles, place, includeClosed, includeOpen, filters, pool.length]);

  const changeFilters = (next: FilterState) => {
    history.current = pushHistory(history.current, filters);
    setCanUndo(true);
    onFilters(next);
  };

  const undo = () => {
    const popped = popHistory(history.current);
    history.current = popped.stack;
    setCanUndo(popped.stack.length > 0);
    if (popped.previous) onFilters(popped.previous);
  };

  useEffect(() => {
    saveDramScope({ place, includeOpen, includeClosed });
  }, [place, includeOpen, includeClosed]);

  const stopRoll = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  useEffect(() => () => stopRoll(), []);

  useEffect(() => {
    if (!openKey || filtersOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenKey(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openKey, filtersOpen]);

  useEffect(() => {
    if (pendingId.current != null && !pool.some((bottle) => bottle.id === pendingId.current)) {
      stopRoll();
      pendingId.current = null;
      setRollingKey(null);
    }
    if (settlePick(pick, pool) !== pick) {
      setPick(null);
      setAnnounce("");
    }
  }, [pool, pick]);

  useEffect(() => {
    if (!pick || rollingKey) return;
    document.getElementById(`dram-${pick.bottleKey}`)?.scrollIntoView({
      block: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [pick, rollingKey]);

  const land = (bottle: Bottle) => {
    pendingId.current = null;
    setRollingKey(null);
    setPick(bottle);
    setOpenKey(bottle.bottleKey);
    setAnnounce(`Your dram: ${bottle.distillery} ${bottle.bottling}. Bottle is at: ${bottle.location || "not tagged yet"}.`);
  };

  const roll = () => {
    if (!place) return;
    stopRoll();
    if (pool.length === 0) {
      pendingId.current = null;
      setPick(null);
      setRollingKey(null);
      return;
    }
    const next = choosePour(pool, pick?.id ?? null);
    if (!next) return;
    pendingId.current = next.id;
    setAnnounce("");
    const frames = rollFrames(
      groupLibrary(pool).map((row) => row.bottleKey),
      next.bottleKey,
      prefersReducedMotion(),
    );
    if (frames.length === 0) {
      land(next);
      return;
    }
    frames.forEach((key, index) => {
      timers.current.push(window.setTimeout(() => {
        if (index < frames.length - 1) setRollingKey(key);
        else land(next);
      }, 80 * index));
    });
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
          <button type="button" className="textish" onClick={() => {
            stopRoll();
            pendingId.current = null;
            setPlace(null);
            setPick(null);
            setOpenKey(null);
            setRollingKey(null);
            setAnnounce("");
            setFiltersOpen(false);
          }}>
            Change place
          </button>
        </div>
      </header>
      {emptyApartment ? (
        <p className="empty">No bottles are tagged for the apartment yet. The house holds the cellar.</p>
      ) : (
        <DramSummary
          available={pool.length}
          filters={filters}
          onFilters={changeFilters}
          onUndo={undo}
          canUndo={canUndo}
          flagId={flagId}
        >
          <DramResults
            bottles={pool}
            openKey={openKey}
            pickedId={pick?.id ?? null}
            rollingKey={rollingKey}
            announce={announce}
            onToggle={(key) => setOpenKey(openKey === key ? null : key)}
          />
        </DramSummary>
      )}
      {filtersOpen ? (
        <FilterDrawer
          filters={filters}
          onChange={changeFilters}
          available={pool.length}
          onPour={roll}
          onUndo={undo}
          canUndo={canUndo}
          flagId={flagId}
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
            onChange={changeFilters}
          />
        </FilterDrawer>
      ) : null}
    </section>
  );
}
