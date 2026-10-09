import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import type { Bottle, FilterState } from "../types";
import { dramPool, groupLibrary, type LibraryRow } from "../lib/library";
import { cardTransitionName, choosePour, leadBottle, prefersReducedMotion, settlePick, withViewTransition } from "../lib/pour";
import { mostConstraining, popHistory, pushHistory } from "../lib/recovery";
import { loadDramSelection, saveDramScope } from "../lib/store";
import { AppliedTray } from "./AppliedTray";
import { DramFacets } from "./DramFacets";
import { activeFilterCount, FilterDrawer, FiltersButton, trapTab } from "./FilterDrawer";
import { ExpressionDetail, LibraryCard } from "./Library";

type Place = "house" | "apartment";

const FOCUSABLE = "button:not([disabled]), a[href], input:not([disabled])";

/** Resolves once the card has scrolled into view. Already-visible cards resolve immediately. */
function revealCard(card: HTMLElement): Promise<void> {
  if (prefersReducedMotion()) {
    card.scrollIntoView({ block: "center", behavior: "auto" });
    return Promise.resolve();
  }
  const rect = card.getBoundingClientRect();
  if (rect.top >= 64 && rect.bottom <= window.innerHeight - 24) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      document.removeEventListener("scrollend", finish);
      resolve();
    };
    const timer = window.setTimeout(finish, 700);
    document.addEventListener("scrollend", finish);
    card.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

function growFromCard(dialog: HTMLElement, card: HTMLElement) {
  const from = card.getBoundingClientRect();
  const to = dialog.getBoundingClientRect();
  if (!to.width || !to.height) return;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  dialog.animate(
    [
      {
        transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})`,
        borderRadius: "12px",
      },
      { transform: "none", borderRadius: "16px" },
    ],
    { duration: 480, easing: "cubic-bezier(0.32, 0.72, 0, 1)" },
  );
}

function DramDetail({
  row,
  picked,
  growFrom,
  onClose,
}: {
  row: LibraryRow;
  picked?: Bottle;
  growFrom?: string | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const dialog = panelRef.current;
    const card = growFrom ? document.getElementById(growFrom) : null;
    if (!dialog || !card || prefersReducedMotion()) return;
    growFromCard(dialog, card);
  }, [growFrom, row.bottleKey]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.querySelector<HTMLElement>(".dram-dialog-close")?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const next = trapTab(items, document.activeElement instanceof HTMLElement ? document.activeElement : null, event.shiftKey);
      if (!next) return;
      event.preventDefault();
      next.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      returnTo?.focus({ preventScroll: true });
    };
  }, [row.bottleKey]);

  const titleId = `dram-title-${row.bottleKey}`;
  return (
    <div className="dram-dialog-root">
      <div className="dram-dialog-scrim" onClick={onClose} />
      <div ref={panelRef} className={["dram-dialog", picked ? "picked" : "", growFrom ? "from-card" : ""].filter(Boolean).join(" ")} role="dialog" aria-modal="true" aria-labelledby={titleId}>
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
  growFrom = null,
  borderedKey = null,
  announce = "",
}: {
  bottles: Bottle[];
  openKey: string | null;
  onToggle: (key: string) => void;
  pickedId?: string | null;
  growFrom?: string | null;
  borderedKey?: string | null;
  announce?: string;
}) {
  const picked = pickedId ? bottles.find((bottle) => bottle.id === pickedId) : undefined;
  const lead = picked ? leadBottle(bottles, picked) : undefined;
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
              bordered={!isPicked && borderedKey === row.bottleKey}
              where={isPicked ? lead?.location : undefined}
              cardId={`dram-${row.bottleKey}`}
              transitionName={cardTransitionName(row.bottleKey)}
              onToggle={() => onToggle(row.bottleKey)}
            />
          );
        })}
      </div>
      {openRow ? (
        <DramDetail
          row={openRow}
          picked={picked?.bottleKey === openRow.bottleKey ? lead : undefined}
          growFrom={picked?.bottleKey === openRow.bottleKey ? growFrom : null}
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
  const [growFrom, setGrowFrom] = useState<string | null>(null);
  const [borderedKey, setBorderedKey] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersButton = useRef<HTMLButtonElement>(null);
  const pourGeneration = useRef(0);
  const pauseTimer = useRef<number | null>(null);
  const pendingId = useRef<string | null>(null);
  const history = useRef<FilterState[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const pool = useMemo(() => {
    if (!place) return [];
    return dramPool(bottles, place, includeClosed, filters, includeOpen);
  }, [bottles, place, includeClosed, includeOpen, filters]);

  const [shown, setShown] = useState(pool);
  const latestPool = useRef(pool);
  latestPool.current = pool;

  useEffect(() => {
    if (filtersOpen || shown === pool) return;
    withViewTransition(() => flushSync(() => setShown(latestPool.current)));
  }, [pool, filtersOpen, shown]);

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

  const cancelPour = () => {
    pourGeneration.current += 1;
    if (pauseTimer.current != null) {
      window.clearTimeout(pauseTimer.current);
      pauseTimer.current = null;
    }
  };

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
      cancelPour();
      pendingId.current = null;
      setGrowFrom(null);
      setBorderedKey(null);
    }
    if (settlePick(pick, pool) !== pick) {
      setPick(null);
      setAnnounce("");
    }
  }, [pool, pick]);

  const pour = () => {
    if (!place) return;
    cancelPour();
    if (pool.length === 0) {
      pendingId.current = null;
      setPick(null);
      setGrowFrom(null);
      setBorderedKey(null);
      return;
    }
    const next = choosePour(pool, pick?.id ?? null);
    if (!next) return;
    const lead = leadBottle(pool, next);
    const generation = pourGeneration.current;
    const cardId = `dram-${lead.bottleKey}`;
    pendingId.current = lead.id;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setPick(null);
    setBorderedKey(null);
    setOpenKey(null);
    setGrowFrom(null);
    setAnnounce("");
    const open = () => {
      if (generation !== pourGeneration.current) return;
      pendingId.current = null;
      setBorderedKey(null);
      setPick(lead);
      setGrowFrom(cardId);
      setOpenKey(lead.bottleKey);
      setAnnounce(`Your dram: ${lead.distillery} ${lead.bottling}. Bottle is at: ${lead.location || "not tagged yet"}.`);
    };
    const borderThenOpen = () => {
      if (generation !== pourGeneration.current) return;
      setBorderedKey(lead.bottleKey);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (generation !== pourGeneration.current) return;
          pauseTimer.current = window.setTimeout(() => {
            pauseTimer.current = null;
            open();
          }, 750);
        });
      });
    };
    const card = document.getElementById(cardId);
    if (!card) {
      open();
      return;
    }
    window.requestAnimationFrame(() => {
      const fresh = document.getElementById(cardId);
      if (!fresh) {
        open();
        return;
      }
      void revealCard(fresh).then(borderThenOpen);
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
            cancelPour();
            pendingId.current = null;
            setPlace(null);
            setPick(null);
            setOpenKey(null);
            setGrowFrom(null);
            setBorderedKey(null);
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
          onPour={pour}
          poured={pick != null}
        >
          <DramResults
            bottles={shown}
            openKey={openKey}
            pickedId={pick?.id ?? null}
            growFrom={growFrom}
            borderedKey={borderedKey}
            announce={announce}
            onToggle={(key) => {
              setGrowFrom(null);
              setBorderedKey(null);
              setOpenKey(openKey === key ? null : key);
            }}
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
