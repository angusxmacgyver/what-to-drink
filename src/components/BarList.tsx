import type { Entry } from "../lib/analytics";

type Props = {
  title: string;
  entries: Entry[];
  takeaway?: string;
  layout?: "rows" | "columns";
};

export function BarList({ title, entries, takeaway, layout = "rows" }: Props) {
  const max = Math.max(1, ...entries.map((e) => e.count));

  return (
    <article className="chart-card">
      <h2>{title}</h2>
      {layout === "rows" ? (
        <ul className="bar-rows">
          {entries.map((e) => (
            <li key={e.label}>
              <span className="bar-label">{e.label}</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${(e.count / max) * 100}%` }} />
              </span>
              <span className="bar-count">{e.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="bar-columns">
          {entries.map((e) => (
            <li key={e.label}>
              <span className="bar-count">{e.count}</span>
              <span className="bar-column">
                <span className="bar-fill" style={{ height: `${(e.count / max) * 100}%` }} />
              </span>
              <span className="bar-label">{e.label}</span>
            </li>
          ))}
        </ul>
      )}
      {takeaway ? <p className="takeaway">{takeaway}</p> : null}
    </article>
  );
}
