import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import type { Bottle, FilterState } from "../types";
import { familyClass, smwsThemeClass } from "../lib/colors";
import {
  detailBottle,
  groupDistilleries,
  groupLibrary,
  matchesFilters,
  matchesStatus,
  originLabel,
  uniqueTags,
  type DistilleryGroup,
  type LibraryRow,
} from "../lib/library";
import { popHistory, pushHistory } from "../lib/recovery";
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
  where?: string;
  cardId?: string;
  transitionName?: string;
  showDistillery?: boolean;
}) {
  const shown = detailBottle(row.bottles);
  const origin = originLabel(shown.region, shown.country);
  const name = `${row.distillery} ${row.bottling}`;
  const place = where || "not tagged yet";
  const classes = ["library-card", expanded ? "open" : "", picked || bordered ? "picked" : ""]
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

function DistilleryHeader({
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

function DistillerySection({
  group,
  layout,
  filters,
  openKey,
  onToggle,
  ...actions
}: Actions & {
  group: DistilleryGroup;
  layout: LibraryLayout;
  filters: FilterState;
  openKey: string | null;
  onToggle: (key: string) => void;
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
          if (layout === "grid") {
            return (
              <Fragment key={row.bottleKey}>
                <LibraryCard
                  row={row}
                  expanded={expanded}
                  showDistillery={false}
                  onToggle={() => onToggle(row.bottleKey)}
                />
                {expanded ? <ExpressionDetail bottles={row.bottles} groupedFlavors filters={filters} {...actions} /> : null}
              </Fragment>
            );
          }
          return (
            <article key={row.bottleKey} className={expanded ? "row open" : "row"}>
              <button
                type="button"
                className="row-main"
                aria-expanded={expanded}
                onClick={() => onToggle(row.bottleKey)}
              >
                <span className="who">
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

export function Library({ bottles, filters, onFilters, owner, onEdit, onKill, onOpen }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [layout, setLayout] = useState<LibraryLayout>(() => loadLibraryLayout());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersButton = useRef<HTMLButtonElement>(null);
  const history = useRef<FilterState[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const filtered = bottles.filter((b) => matchesStatus(b, filters.statuses) && matchesFilters(b, filters));
  const rows = groupLibrary(filtered);
  const groups = groupDistilleries(rows);
  const actions = { owner, onEdit, onKill, onOpen };
  const filterCount = activeFilterCount(filters);

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
      {filterCount > 0 ? (
        <div className="library-applied">
          <AppliedTray filters={filters} onChange={changeFilters} />
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
            {...actions}
          />
        ))}
      </div>
      {filtersOpen ? (
        <FilterDrawer
          filters={filters}
          onChange={changeFilters}
          available={filtered.length}
          onUndo={undo}
          canUndo={canUndo}
          trayTitle="Applied"
          onClose={() => {
            setFiltersOpen(false);
            filtersButton.current?.focus();
          }}
        >
          <Filters bottles={bottles} filters={filters} onChange={changeFilters} showStatus showGeo />
        </FilterDrawer>
      ) : null}
    </section>
  );
}
