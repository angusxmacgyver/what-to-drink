import { useState } from "react";
import type { Bottle } from "../types";
import { BottleFields } from "./BottleFields";
import { LastPouredBadge, LastPouredEyebrow, LastPouredSash, sashHostClass, usePrototypeSash } from "./LastPouredSash.prototype";

function formatFinished(value: string): string {
  if (!value || /unknown/i.test(value)) return "Unknown";
  return value;
}

export function Graveyard({ bottles }: { bottles: Bottle[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const sorted = [...bottles].sort((a, b) => a.distillery.localeCompare(b.distillery));
  const sash = usePrototypeSash();
  // PROTOTYPE stand-in for a kill shot as the newest dram: the first bottle listed.
  const lastPouredId = sash.kill ? (sorted[0]?.id ?? null) : null;

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
          const lastPoured = lastPouredId === bottle.id;
          return (
            <article
              key={bottle.id}
              className={["row", expanded ? "open" : "", sashHostClass(lastPoured, sash.variant)].filter(Boolean).join(" ")}
            >
              {lastPoured ? <LastPouredSash variant={sash.variant} /> : null}
              <button
                type="button"
                className="row-main grave"
                onClick={() => setOpen(expanded ? null : bottle.id)}
              >
                <span className="who">
                  <strong>
                    {bottle.distillery}
                    {lastPoured ? <LastPouredBadge variant={sash.variant} /> : null}
                  </strong>
                  <em>{bottle.bottling}</em>
                  {lastPoured ? <LastPouredEyebrow variant={sash.variant} /> : null}
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
