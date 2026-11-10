import { Fragment, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Bottle, FilterState } from "../types";
import { familyClass, smwsThemeClass } from "../lib/colors";
import { FANCY_PICKER_URL, stageFancyPool, stageFancyVisit } from "../lib/fancy";
import {
  detailBottle,
  groupDistilleries,
  groupLibrary,
  matchesFilters,
  originLabel,
  uniqueTags,
  type DistilleryGroup,
  type LibraryRow,
} from "../lib/library";
import { choosePour, leadBottle, prefersReducedMotion, revealCard, settlePick } from "../lib/pour";
import { mostConstrainingChip } from "../lib/recovery";
import { loadLibraryLayout, saveLibraryLayout, type LibraryLayout } from "../lib/store";
import { AppliedTray } from "./AppliedTray";
import { BottleFields } from "./BottleFields";
import { activeFilterCount, FilterDrawer, FiltersButton } from "./FilterDrawer";
import { Filters } from "./Filters";
import { FlavorTags } from "./FlavorTags";
import { LastPouredBadge, LastPouredEyebrow, LastPouredSash, sashHostClass, usePrototypeSash } from "./LastPouredSash.prototype";

type Props = {
  bottles: Bottle[];
  filters: FilterState;
  onFilters: (next: FilterState) => void;
  onUndo: () => void;
  canUndo: boolean;
  exact: boolean;
  onExact: (next: boolean) => void;
  pick: Bottle | null;
  onPick: (next: Bottle | null) => void;
  /** A bottle the fancy wheel landed on, to reveal as the Pick. */
  landedId?: string | null;
  onLanded?: () => void;
  owner: boolean;
  onEdit?: (bottle: Bottle) => void;
  onKill?: (id: string) => void;
  onOpen?: (id: string) => void;
};

type Actions = Pick<Props, "owner" | "onEdit" | "onKill" | "onOpen">;

function BottleActions({ bottle, owner, onEdit, onKill, onOpen }: Actions & { bottle: Bottle }) {
  if (!owner) return null;
  return (
    <div className="owner-actions">
      {bottle.status === "Closed" && onOpen ? (
        <button type="button" onClick={() => onOpen(bottle.id)}>
          Mark open
        </button>
      ) : null}
      {onEdit ? (
        <button type="button" onClick={() => onEdit(bottle)}>
          Edit
        </button>
      ) : null}
      {onKill ? (
        <button type="button" className="danger" onClick={() => onKill(bottle.id)}>
          Kill → Graveyard
        </button>
      ) : null}
    </div>
  );
}

export function LibraryCard({
  row,
  expanded,
  onToggle,
  picked = false,
  pulsing = false,
  where,
  cardId,
  showDistillery = true,
  lastPoured = false,
}: {
  row: LibraryRow;
  expanded: boolean;
  onToggle: () => void;
  picked?: boolean;
  pulsing?: boolean;
  where?: string;
  cardId?: string;
  showDistillery?: boolean;
  lastPoured?: boolean;
}) {
  const sash = usePrototypeSash();
  const shown = detailBottle(row.bottles);
  const origin = originLabel(shown.region, shown.country);
  const name = `${row.distillery} ${row.bottling}`;
  const place = where || "not tagged yet";
  const classes = [
    "library-card",
    expanded ? "open" : "",
    picked ? "picked" : "",
    pulsing ? "pick-pulse" : "",
    sashHostClass(lastPoured, sash.variant),
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      id={cardId}
      className={classes}
      aria-expanded={expanded}
      aria-label={picked ? `${name}. Your dram. Bottle is at: ${place}.` : name}
      title={name}
      onClick={onToggle}
    >
      {lastPoured ? <LastPouredSash variant={sash.variant} /> : null}
      {lastPoured ? <LastPouredBadge variant={sash.variant} /> : null}
      {picked ? <span className="your-dram">Your dram</span> : null}
      {showDistillery ? <strong className="card-distillery">{row.distillery}</strong> : null}
      <em className="card-expression">{row.bottling}</em>
      {lastPoured ? <LastPouredEyebrow variant={sash.variant} /> : null}
      {picked ? <span className="card-where">Bottle is at: {place}</span> : null}
      {origin ? <span className="card-origin">{origin}</span> : null}
      {row.flavorFamilies.length ? (
        <span className="card-swatches">
          {row.flavorFamilies.map((family) => (
            <span key={family} className={`family-dot ${familyClass(family)}`} title={family} />
          ))}
        </span>
      ) : null}
      <span className="card-facts">
        <span>
          Age: {row.ageLabel} | ABV: {row.abvLabel}
        </span>
        {row.stock > 1 ? <span className="stock">×{row.stock}</span> : null}
      </span>
    </button>
  );
}

function itemCount(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export function DistilleryHeader({
  distillery,
  expressions,
  bottles,
}: {
  distillery: string;
  expressions: number;
  bottles: number;
}) {
  return (
    <header className="distillery-head">
      <h2>{distillery}</h2>
      <span>
        {itemCount(expressions, "expression")} · {itemCount(bottles, "bottle")}
      </span>
    </header>
  );
}

export function ExpressionDetail({
  bottles,
  groupedFlavors = false,
  filters,
  landed = false,
  ...actions
}: Actions & {
  bottles: Bottle[];
  groupedFlavors?: boolean;
  filters?: FilterState;
  landed?: boolean;
}) {
  const shown = detailBottle(bottles);
  return (
    <div className={landed ? "detail landed" : "detail"}>
      <BottleFields bottle={shown} flavorText={false} />
      <FlavorTags
        families={uniqueTags(bottles.flatMap((bottle) => bottle.flavorFamilies))}
        subs={uniqueTags(bottles.flatMap((bottle) => bottle.subCharacteristics))}
        grouped={groupedFlavors}
        selectedFamilies={filters?.families}
        selectedSubs={filters?.subs}
        subFamilies={filters?.subFamilies}
      />
      {bottles.length > 1 ? (
        <ul className="bottle-splits">
          {bottles.map((bottle) => (
            <li key={bottle.id}>
              <span>
                {bottle.status}
                {bottle.location ? ` · ${bottle.location}` : ""}
              </span>
              <BottleActions bottle={bottle} {...actions} />
            </li>
          ))}
        </ul>
      ) : (
        <BottleActions bottle={shown} {...actions} />
      )}
    </div>
  );
}

const rowId = (bottleKey: string) => `library-${bottleKey}`;

function DistillerySection({
  group,
  layout,
  filters,
  openKey,
  onToggle,
  picked,
  pulseKey,
  landedKey,
  lastPouredKey,
  ...actions
}: Actions & {
  group: DistilleryGroup;
  layout: LibraryLayout;
  filters: FilterState;
  openKey: string | null;
  onToggle: (key: string) => void;
  picked: Bottle | null;
  pulseKey: string | null;
  landedKey: string | null;
  lastPouredKey: string | null;
}) {
  const sash = usePrototypeSash();
  return (
    <section className="distillery-group">
      <DistilleryHeader
        distillery={group.distillery}
        expressions={group.expressionCount}
        bottles={group.bottleCount}
      />
      <div className={layout === "grid" ? "library-grid" : "list"}>
        {group.rows.map((row) => {
          const expanded = openKey === row.bottleKey;
          const isPicked = picked?.bottleKey === row.bottleKey;
          const pulsing = pulseKey === row.bottleKey;
          const landed = isPicked && landedKey === row.bottleKey;
          const lastPoured = lastPouredKey === row.bottleKey;
          if (layout === "grid") {
            return (
              <Fragment key={row.bottleKey}>
                <LibraryCard
                  row={row}
                  expanded={expanded}
                  showDistillery={false}
                  lastPoured={lastPoured}
                  picked={isPicked}
                  pulsing={pulsing}
                  where={isPicked ? picked?.location : undefined}
                  cardId={rowId(row.bottleKey)}
                  onToggle={() => onToggle(row.bottleKey)}
                />
                {expanded ? (
                  <ExpressionDetail bottles={row.bottles} groupedFlavors filters={filters} landed={landed} {...actions} />
                ) : null}
              </Fragment>
            );
          }
          return (
            <article
              key={row.bottleKey}
              id={rowId(row.bottleKey)}
              className={["row", expanded ? "open" : "", pulsing ? "pick-pulse" : "", sashHostClass(lastPoured, sash.variant)]
                .filter(Boolean)
                .join(" ")}
            >
              {lastPoured ? <LastPouredSash variant={sash.variant} /> : null}
              <button
                type="button"
                className="row-main"
                aria-expanded={expanded}
                onClick={() => onToggle(row.bottleKey)}
              >
                <span className="who">
                  {isPicked ? (
                    <span className="your-dram">Your dram · Bottle is at: {picked?.location || "not tagged yet"}</span>
                  ) : null}
                  <strong>
                    <em>{row.bottling}</em>
                    {lastPoured ? <LastPouredBadge variant={sash.variant} /> : null}
                  </strong>
                  {lastPoured ? <LastPouredEyebrow variant={sash.variant} /> : null}
                </span>
                <span className="list-facts">Age: {row.ageLabel} | ABV: {row.abvLabel}</span>
                <span className={`theme ${smwsThemeClass(row.theme)}`}>{row.theme}</span>
                {row.stock > 1 ? <span className="stock">×{row.stock}</span> : <span />}
                <FlavorTags
                  families={row.flavorFamilies}
                  subs={row.subCharacteristics}
                  grouped
                  selectedFamilies={filters.families}
                  selectedSubs={filters.subs}
                  subFamilies={filters.subFamilies}
                />
              </button>
              {expanded ? <ExpressionDetail bottles={row.bottles} landed={landed} {...actions} /> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function Library({
  bottles,
  filters,
  onFilters,
  onUndo,
  canUndo,
  exact,
  onExact,
  pick,
  onPick,
  landedId = null,
  onLanded,
  owner,
  onEdit,
  onKill,
  onOpen,
}: Props) {
  const [openKey, setOpenKey] = useState<string | null>(() => pick?.bottleKey ?? null);
  const [layout, setLayout] = useState<LibraryLayout>(() => loadLibraryLayout());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersButton = useRef<HTMLButtonElement>(null);
  const showing = (next: FilterState) => bottles.filter((b) => matchesFilters(b, next, exact));
  const filtered = showing(filters);
  const rows = groupLibrary(filtered);
  const groups = groupDistilleries(rows);
  const sash = usePrototypeSash();
  // PROTOTYPE stand-in for the newest dram: the first expression showing.
  const lastPouredKey = sash.kill ? null : (groups[0]?.rows[0]?.bottleKey ?? null);
  const actions = { owner, onEdit, onKill, onOpen };
  const filterCount = activeFilterCount(filters);
  const nothingMatches = filtered.length === 0 && filterCount > 0;
  const flagId = nothingMatches ? mostConstrainingChip(filters, (next) => showing(next).length) : null;
  const pool = filtered.filter((b) => b.atApartment === (filters.place === "apartment"));
  const [announce, setAnnounce] = useState("");
  const settled = settlePick(pick, pool);

  useEffect(() => {
    if (pick && !settled) {
      onPick(null);
      setAnnounce("");
    }
  }, [pick, settled, onPick]);

  const [pulseKey, setPulseKey] = useState<string | null>(null);
  const [landedKey, setLandedKey] = useState<string | null>(null);
  const pickGeneration = useRef(0);
  const pulseTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (settled) document.getElementById(rowId(settled.bottleKey))?.scrollIntoView({ block: "center" });
    return () => {
      pickGeneration.current += 1;
      window.clearTimeout(pulseTimer.current);
    };
  }, []);

  const [fancyArmed, setFancyArmed] = useState(false);
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setFancyArmed(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const makePick = () => {
    if (fancyArmed) {
      stageFancyPool(pool);
      stageFancyVisit({ filters, exact });
      flushSync(() => setFancyArmed(false));
      window.location.assign(FANCY_PICKER_URL);
      return;
    }
    const next = choosePour(pool, pick?.id ?? null);
    if (next) reveal(leadBottle(pool, next));
  };

  useEffect(() => {
    if (!landedId) return;
    onLanded?.();
    const landed = pool.find((b) => b.id === landedId);
    if (landed) reveal(leadBottle(pool, landed));
  }, [landedId]);

  function reveal(lead: Bottle) {
    const generation = ++pickGeneration.current;
    const current = () => generation === pickGeneration.current;
    const target = () => document.getElementById(rowId(lead.bottleKey));
    const land = () => {
      setPulseKey(null);
      setLandedKey(lead.bottleKey);
      onPick(lead);
      setOpenKey(lead.bottleKey);
      setAnnounce(`Your dram: ${lead.distillery} ${lead.bottling}. Bottle is at: ${lead.location || "not tagged yet"}.`);
    };
    window.clearTimeout(pulseTimer.current);
    setFiltersOpen(false);
    if (prefersReducedMotion()) {
      land();
      window.requestAnimationFrame(() => {
        const el = target();
        if (current() && el) void revealCard(el);
      });
      return;
    }
    setPulseKey(null);
    onPick(null);
    setOpenKey(null);
    setAnnounce("");
    window.requestAnimationFrame(() => {
      if (!current()) return;
      const el = target();
      if (!el) return land();
      void revealCard(el).then(() => {
        if (!current()) return;
        setPulseKey(lead.bottleKey);
        pulseTimer.current = window.setTimeout(() => {
          if (current()) land();
        }, 1100);
      });
    });
  }

  useEffect(() => {
    saveLibraryLayout(layout);
  }, [layout]);

  useEffect(() => {
    if (!openKey || filtersOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenKey(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openKey, filtersOpen]);

  return (
    <section className="panel">
      <header className="panel-head library-head">
        <div>
          <h1>The Library</h1>
        </div>
        <div className="panel-tools">
          <FiltersButton
            count={filterCount}
            open={filtersOpen}
            buttonRef={filtersButton}
            onClick={() => setFiltersOpen(true)}
          />
          <div className="view-toggle" role="group" aria-label="Library layout">
            <button type="button" aria-pressed={layout === "list"} onClick={() => setLayout("list")}>
              List
            </button>
            <button type="button" aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}>
              Grid
            </button>
          </div>
          <p className="count">
            {rows.length} expressions · {filtered.length} bottles
          </p>
        </div>
      </header>
      {activeFilterCount({ ...filters, place: null }) > 0 ? (
        <div className="library-applied">
          <AppliedTray filters={filters} onChange={onFilters} flagId={flagId} hidePlace />
        </div>
      ) : null}
      {nothingMatches ? (
        <div className="recovery">
          <p className="empty">No bottles match this combination.</p>
          <button type="button" onClick={onUndo} disabled={!canUndo}>
            Undo last
          </button>
        </div>
      ) : null}
      <div className="distillery-groups">
        {groups.map((group) => (
          <DistillerySection
            key={group.distillery}
            group={group}
            layout={layout}
            filters={filters}
            openKey={openKey}
            onToggle={(key) => setOpenKey(openKey === key ? null : key)}
            picked={settled}
            pulseKey={pulseKey}
            landedKey={landedKey}
            lastPouredKey={lastPouredKey}
            {...actions}
          />
        ))}
      </div>
      <p className="live" aria-live="polite">{announce}</p>
      {filtersOpen ? (
        <FilterDrawer
          filters={filters}
          onChange={onFilters}
          available={filtered.length}
          onUndo={onUndo}
          canUndo={canUndo}
          flagId={flagId}
          trayTitle="Applied"
          foot={
            <div className="pick-foot">
              <label className="fancy-mode">
                <input
                  type="checkbox"
                  checked={fancyArmed}
                  onChange={(event) => setFancyArmed(event.currentTarget.checked)}
                />
                <span>I feel fancy</span>
              </label>
              <button type="button" className="roll" onClick={makePick} disabled={pool.length === 0}>
                {pool.length ? `Pick from ${pool.length}` : "No pours available"}
              </button>
            </div>
          }
          onClose={() => {
            setFiltersOpen(false);
            filtersButton.current?.focus();
          }}
        >
          <label className="fancy-mode">
            <input type="checkbox" checked={exact} onChange={(event) => onExact(event.currentTarget.checked)} />
            <span>Match exactly</span>
          </label>
          <Filters bottles={bottles} filters={filters} onChange={onFilters} exact={exact} showStatus showGeo />
        </FilterDrawer>
      ) : null}
    </section>
  );
}
