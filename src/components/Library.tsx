import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import type { Bottle, FilterState } from "../types";
import { familyClass, smwsThemeClass } from "../lib/colors";
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

type Props = {
  bottles: Bottle[];
  filters: FilterState;
  onFilters: (next: FilterState) => void;
  onUndo: () => void;
  canUndo: boolean;
  exact: boolean;
  onExact: (next: boolean) => void;
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
  bordered = false,
  pulsing = false,
  where,
  cardId,
  transitionName,
  showDistillery = true,
}: {
  row: LibraryRow;
  expanded: boolean;
  onToggle: () => void;
  picked?: boolean;
  bordered?: boolean;
  pulsing?: boolean;
  where?: string;
  cardId?: string;
  transitionName?: string;
  showDistillery?: boolean;
}) {
  const shown = detailBottle(row.bottles);
  const origin = originLabel(shown.region, shown.country);
  const name = `${row.distillery} ${row.bottling}`;
  const place = where || "not tagged yet";
  const classes = ["library-card", expanded ? "open" : "", picked || bordered ? "picked" : "", pulsing ? "pick-pulse" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      id={cardId}
      className={classes}
      style={transitionName ? { viewTransitionName: transitionName, viewTransitionClass: "dram-card" } : undefined}
      aria-expanded={expanded}
      aria-label={picked ? `${name}. Your dram. Bottle is at: ${place}.` : name}
      title={name}
      onClick={onToggle}
    >
      {picked ? <span className="your-dram">Your dram</span> : null}
      {showDistillery ? <strong className="card-distillery">{row.distillery}</strong> : null}
      <em className="card-expression">{row.bottling}</em>
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
  trail,
  factsFirst = false,
  groupedFlavors = false,
  filters,
  ...actions
}: Actions & { bottles: Bottle[]; trail?: ReactNode; factsFirst?: boolean; groupedFlavors?: boolean; filters?: FilterState }) {
  const shown = detailBottle(bottles);
  return (
    <div className="detail">
      <BottleFields bottle={shown} flavorText={false} factsFirst={factsFirst} />
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
      {trail}
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
  ...actions
}: Actions & {
  group: DistilleryGroup;
  layout: LibraryLayout;
  filters: FilterState;
  openKey: string | null;
  onToggle: (key: string) => void;
  picked: Bottle | null;
  pulseKey: string | null;
}) {
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
          if (layout === "grid") {
            return (
              <Fragment key={row.bottleKey}>
                <LibraryCard
                  row={row}
                  expanded={expanded}
                  showDistillery={false}
                  picked={isPicked}
                  pulsing={pulsing}
                  where={isPicked ? picked?.location : undefined}
                  cardId={rowId(row.bottleKey)}
                  onToggle={() => onToggle(row.bottleKey)}
                />
                {expanded ? <ExpressionDetail bottles={row.bottles} groupedFlavors filters={filters} {...actions} /> : null}
              </Fragment>
            );
          }
          return (
            <article
              key={row.bottleKey}
              id={rowId(row.bottleKey)}
              className={["row", expanded ? "open" : "", isPicked ? "picked" : "", pulsing ? "pick-pulse" : ""]
                .filter(Boolean)
                .join(" ")}
            >
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
                  <strong><em>{row.bottling}</em></strong>
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
              {expanded ? <ExpressionDetail bottles={row.bottles} {...actions} /> : null}
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
  owner,
  onEdit,
  onKill,
  onOpen,
}: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [layout, setLayout] = useState<LibraryLayout>(() => loadLibraryLayout());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersButton = useRef<HTMLButtonElement>(null);
  const showing = (next: FilterState) => bottles.filter((b) => matchesFilters(b, next, exact));
  const filtered = showing(filters);
  const rows = groupLibrary(filtered);
  const groups = groupDistilleries(rows);
  const actions = { owner, onEdit, onKill, onOpen };
  const filterCount = activeFilterCount(filters);
  const nothingMatches = filtered.length === 0 && filterCount > 0;
  const flagId = nothingMatches ? mostConstrainingChip(filters, (next) => showing(next).length) : null;
  const pool = filtered.filter((b) => b.atApartment === (filters.place === "apartment"));
  const [pick, setPick] = useState<Bottle | null>(null);
  const [announce, setAnnounce] = useState("");
  const settled = settlePick(pick, pool);

  useEffect(() => {
    if (pick && !settled) {
      setPick(null);
      setAnnounce("");
    }
  }, [pick, settled]);

  const [pulseKey, setPulseKey] = useState<string | null>(null);
  const pickGeneration = useRef(0);
  const pulseTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      pickGeneration.current += 1;
      window.clearTimeout(pulseTimer.current);
    },
    [],
  );

  const makePick = () => {
    const next = choosePour(pool, pick?.id ?? null);
    if (!next) return;
    const lead = leadBottle(pool, next);
    const generation = ++pickGeneration.current;
    const current = () => generation === pickGeneration.current;
    const target = () => document.getElementById(rowId(lead.bottleKey));
    const land = () => {
      setPulseKey(null);
      setPick(lead);
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
    setPick(null);
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
  };

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
            <button type="button" className="roll" onClick={makePick} disabled={pool.length === 0}>
              {pool.length ? `Pick from ${pool.length}` : "No pours available"}
            </button>
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
