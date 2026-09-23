import { useState } from "react";
import type { Bottle } from "../types";
import { BottleFields } from "./BottleFields";

function formatFinished(value: string): string {
  if (!value || /unknown/i.test(value)) return "Unknown";
  return value;
}

export function Graveyard({ bottles }: { bottles: Bottle[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const sorted = [...bottles].sort((a, b) => a.distillery.localeCompare(b.distillery));

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Finished bottles</p>
          <h1>Graveyard</h1>
        </div>
        <p className="count">{sorted.length} fallen</p>
      </header>
      <div className="list">
        <div className="list-head row-main grave" role="row">
          <span>Bottle</span>
          <span>Age</span>
          <span>ABV</span>
          <span>Date finished</span>
        </div>
        {sorted.map((bottle) => {
          const expanded = open === bottle.id;
          return (
            <article key={bottle.id} className={expanded ? "row open" : "row"}>
              <button
                type="button"
                className="row-main grave"
                onClick={() => setOpen(expanded ? null : bottle.id)}
              >
                <span className="who">
                  <strong>{bottle.distillery}</strong>
                  <em>{bottle.bottling}</em>
                </span>
                <span>{bottle.age == null ? "—" : bottle.age}</span>
                <span>{bottle.abv == null ? "—" : `${bottle.abv}%`}</span>
                <span>{formatFinished(bottle.dateEmptied)}</span>
              </button>
              {expanded ? (
                <div className="detail">
                  <BottleFields bottle={bottle} />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
