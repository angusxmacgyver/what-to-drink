import { Fragment, useEffect, useState, type ReactNode } from "react";
import type { Bottle, FilterState } from "../types";
import { familyClass } from "../lib/colors";
import {
  detailBottle,
  groupLibrary,
  matchesFilters,
  matchesStatus,
  originLabel,
  uniqueTags,
  type LibraryRow,
} from "../lib/library";
import { loadLibraryLayout, saveLibraryLayout, type LibraryLayout } from "../lib/store";
import { BottleFields } from "./BottleFields";
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
  rolling = false,
  where,
  cardId,
}: {
  row: LibraryRow;
  expanded: boolean;
  onToggle: () => void;
  picked?: boolean;
  rolling?: boolean;
  where?: string;
  cardId?: string;
}) {
  const shown = detailBottle(row.bottles);
  const origin = originLabel(shown.region, shown.country);
  const name = `${row.distillery} ${row.bottling}`;
  const place = where || "not tagged yet";
  const classes = ["library-card", expanded ? "open" : "", picked ? "picked" : "", rolling ? "rolling" : ""]
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
      {picked ? <span className="your-dram">Your dram</span> : null}
      <strong className="card-distillery">{row.distillery}</strong>
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
        <span>{row.ageLabel}</span>
        <span>{row.abvLabel}</span>
        {row.stock > 1 ? <span className="stock">×{row.stock}</span> : null}
      </span>
    </button>
  );
}

export function ExpressionDetail({
  bottles,
  trail,
  ...actions
}: Actions & { bottles: Bottle[]; trail?: ReactNode }) {
  const shown = detailBottle(bottles);
  return (
    <div className="detail">
      <BottleFields bottle={shown} />
      <FlavorTags
        families={uniqueTags(bottles.flatMap((bottle) => bottle.flavorFamilies))}
        subs={uniqueTags(bottles.flatMap((bottle) => bottle.subCharacteristics))}
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

export function Library({ bottles, filters, onFilters, owner, onEdit, onKill, onOpen }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [layout, setLayout] = useState<LibraryLayout>(() => loadLibraryLayout());
  const filtered = bottles.filter((b) => matchesStatus(b, filters.statuses) && matchesFilters(b, filters));
  const rows = groupLibrary(filtered);
  const actions = { owner, onEdit, onKill, onOpen };

  useEffect(() => {
    saveLibraryLayout(layout);
  }, [layout]);

  useEffect(() => {
    if (!openKey) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenKey(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openKey]);

  return (
    <section className="panel">
      <header className="panel-head library-head">
        <div>
          <h1>The Library</h1>
        </div>
        <div className="panel-tools">
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
      <Filters bottles={bottles} filters={filters} onChange={onFilters} showStatus />
      {layout === "grid" ? (
        <div className="library-grid">
          {rows.map((row) => {
            const expanded = openKey === row.bottleKey;
            return (
              <Fragment key={row.bottleKey}>
                <LibraryCard
                  row={row}
                  expanded={expanded}
                  onToggle={() => setOpenKey(expanded ? null : row.bottleKey)}
                />
                {expanded ? <ExpressionDetail bottles={row.bottles} {...actions} /> : null}
              </Fragment>
            );
          })}
        </div>
      ) : null}
      {layout === "list" ? (
        <div className="list">
          {rows.map((row) => {
            const expanded = openKey === row.bottleKey;
            return (
              <article key={row.bottleKey} className={expanded ? "row open" : "row"}>
                <button
                  type="button"
                  className="row-main"
                  aria-expanded={expanded}
                  onClick={() => setOpenKey(expanded ? null : row.bottleKey)}
                >
                  <span className="who">
                    <strong>{row.distillery}</strong>
                    <em>{row.bottling}</em>
                  </span>
                  <span>{row.ageLabel}</span>
                  <span>{row.abvLabel}</span>
                  <span className="theme">{row.theme}</span>
                  {row.stock > 1 ? <span className="stock">×{row.stock}</span> : <span />}
                  <FlavorTags families={row.flavorFamilies} subs={row.subCharacteristics} />
                </button>
                {expanded ? <ExpressionDetail bottles={row.bottles} {...actions} /> : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
