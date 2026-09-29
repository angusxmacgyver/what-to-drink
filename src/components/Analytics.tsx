import { useMemo } from "react";
import type { Catalog } from "../types";
import { cellarSummary, pct } from "../lib/analytics";
import { BarList } from "./BarList";

type Props = {
  catalog: Catalog;
};

export function Analytics({ catalog }: Props) {
  const s = useMemo(() => cellarSummary(catalog), [catalog]);
  const { totals } = s;
  const shelfTotal = totals.open + totals.closed || 1;

  const numbers = [
    { value: totals.bottles, label: "Bottles" },
    { value: totals.producers, label: "Producers" },
    { value: totals.expressions, label: "Expressions" },
    { value: pct(s.topRegion.share), label: `${s.topRegion.label || "Top region"}` },
    { value: pct(totals.smokeShare), label: "Carry smoke" },
    { value: totals.medianAbv == null ? "—" : `${totals.medianAbv}%`, label: "Median ABV" },
  ];

  return (
    <section className="panel analytics">
      <header className="panel-head">
        <div>
          <h1>Analytics</h1>
        </div>
        <p className="count">Counted by physical bottle</p>
      </header>

      <div className="stat-band">
        {numbers.map((n) => (
          <div key={n.label} className="stat">
            <strong>{n.value}</strong>
            <span>{n.label}</span>
          </div>
        ))}
      </div>

      <article className="chart-card wide">
        <h2>The shelf</h2>
        <div className="stack-bar" role="img" aria-label={s.takeaways.shelf}>
          <span className="seg open" style={{ width: `${(totals.open / shelfTotal) * 100}%` }}>
            Open {totals.open}
          </span>
          <span className="seg closed" style={{ width: `${(totals.closed / shelfTotal) * 100}%` }}>
            Closed {totals.closed}
          </span>
        </div>
        <p className="takeaway">{s.takeaways.shelf}</p>
      </article>

      <div className="chart-grid">
        <BarList title="Where it's from" entries={s.regions} takeaway={s.takeaways.regions} />
        <BarList title="Top producers" entries={s.producers} takeaway={s.takeaways.producers} />
        <BarList title="Age" entries={s.ages} takeaway={s.takeaways.ages} layout="columns" />
        <BarList title="ABV" entries={s.abvs} takeaway={s.takeaways.abv} layout="columns" />
      </div>
    </section>
  );
}
