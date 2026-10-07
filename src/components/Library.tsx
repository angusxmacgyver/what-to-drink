import { useEffect, useState } from "react";
import type { Bottle, FilterState } from "../types";
import { detailBottle, groupLibrary, matchesFilters, matchesStatus } from "../lib/library";
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

function ExpressionDetail({ bottles, ...actions }: Actions & { bottles: Bottle[] }) {
  const shown = detailBottle(bottles);
  return (
    <div className="detail">
      <BottleFields bottle={shown} />
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

export function Library({ bottles, filters, onFilters, owner, onEdit, onKill, onOpen }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const filtered = bottles.filter((b) => matchesStatus(b, filters.statuses) && matchesFilters(b, filters));
  const rows = groupLibrary(filtered);
  const actions = { owner, onEdit, onKill, onOpen };

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
      <header className="panel-head">
        <div>
          <h1>The Library</h1>
        </div>
        <p className="count">
          {rows.length} expressions · {filtered.length} bottles
        </p>
      </header>
      <Filters bottles={bottles} filters={filters} onChange={onFilters} showStatus />
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
    </section>
  );
}
