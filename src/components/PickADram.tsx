import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Bottle, FilterState } from "../types";
import { dramPool, groupLibrary, type LibraryRow } from "../lib/library";
import { choosePour, prefersReducedMotion, rollFrames, settlePick } from "../lib/pour";
import { mostConstraining, popHistory, pushHistory } from "../lib/recovery";
import { loadDramSelection, saveDramScope } from "../lib/store";
import { AppliedTray } from "./AppliedTray";
import { DramFacets } from "./DramFacets";
import { activeFilterCount, FilterDrawer, FiltersButton, trapTab } from "./FilterDrawer";
import { ExpressionDetail, LibraryCard } from "./Library";

type Place = "house" | "apartment";

const FOCUSABLE = "button:not([disabled]), a[href], input:not([disabled])";

function DramDetail({ row, picked, onClose }: { row: LibraryRow; picked?: Bottle; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.querySelector<HTMLElement>(".dram-dialog-close")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const next = trapTab(items, document.activeElement instanceof HTMLElement ? document.activeElement : null, event.shiftKey);
      if (!next) return;
      event.preventDefault();
      next.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      returnTo?.focus();
    };
  }, [row.bottleKey]);

  const titleId = `dram-title-${row.bottleKey}`;
  return (
    <div className="dram-dialog-root">
      <div className="dram-dialog-scrim" onClick={onClose} />
      <div ref={panelRef} className={picked ? "dram-dialog picked" : "dram-dialog"} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="dram-dialog-head">
          <div>
            {picked ? <p className="your-dram">Your dram</p> : null}
            <h2 id={titleId}>
              {row.distillery}
              <em>{row.bottling}</em>
            </h2>
            {picked ? <p className="card-where">Bottle is at: {picked.location || "not tagged yet"}</p> : null}
          </div>
          <button type="button" className="drawer-close dram-dialog-close" aria-label="Close details" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <ExpressionDetail bottles={row.bottles} owner={false} trail={picked ? <div className="just-poured" /> : undefined} />
      </div>
    </div>
  );
}

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
  const rows = groupLibrary(bottles);
  const openRow = rows.find((row) => row.bottleKey === openKey);
  return (
    <>
      <p className="live" aria-live="polite">{announce}</p>
      <div className="library-grid">
        {rows.map((row) => {
          const isPicked = picked?.bottleKey === row.bottleKey;
          return (
            <LibraryCard
              key={row.bottleKey}
              row={row}
              expanded={openKey === row.bottleKey}
              picked={isPicked}
              rolling={rollingKey === row.bottleKey}
              where={isPicked ? picked?.location : undefined}
              cardId={`dram-${row.bottleKey}`}
              onToggle={() => onToggle(row.bottleKey)}
            />
          );
        })}
      </div>
      {openRow ? (
        <DramDetail
          row={openRow}
          picked={picked?.bottleKey === openRow.bottleKey ? picked : undefined}
          onClose={() => onToggle(openRow.bottleKey)}
        />
      ) : null}
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
  onPour,
  poured = false,
  children,
}: {
  available: number;
  filters: FilterState;
  onFilters: (next: FilterState) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  flagId?: string | null;
  onPour?: () => void;
  poured?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <div className="dram-summary">
        <p className="count">{available} available</p>
        <AppliedTray filters={filters} onChange={onFilters} flagId={flagId} />
        {onPour ? (
          <button type="button" className="roll" onClick={onPour} disabled={available === 0}>
            {poured ? "Pour another" : "Pour one"}
          </button>
        ) : null}
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
    setOpenKey(null);
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
          onPour={roll}
          poured={pick != null}
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
