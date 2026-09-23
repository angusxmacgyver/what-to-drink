import { useState } from "react";
import type { Bottle, FilterState } from "../types";
import { groupLibrary, matchesFilters } from "../lib/library";
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

export function Library({ bottles, filters, onFilters, owner, onEdit, onKill, onOpen }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const filtered = bottles.filter((b) => matchesFilters(b, filters));
  const rows = groupLibrary(filtered);

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
      <Filters bottles={bottles} filters={filters} onChange={onFilters} />
      <div className="list">
        {rows.map((row) => {
          const expanded = openKey === row.bottleKey;
          return (
            <article key={row.bottleKey} className={expanded ? "row open" : "row"}>
              <button
                type="button"
                className="row-main"
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
              {expanded
                ? row.bottles.map((bottle) => (
                    <div key={bottle.id} className="detail">
                      {row.stock > 1 ? (
                        <p className="split">
                          {bottle.status}
                          {bottle.location ? ` · ${bottle.location}` : ""}
                        </p>
                      ) : null}
                      <BottleFields bottle={bottle} />
                      {owner ? (
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
                      ) : null}
                    </div>
                  ))
                : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
