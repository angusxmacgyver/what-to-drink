import { pct } from "../lib/analytics";

type Props = {
  smoke: number;
  noSmoke: number;
  untagged: number;
  takeaway: string;
};

const RADIUS = 15.9155;

export function SmokeDonut({ smoke, noSmoke, untagged, takeaway }: Props) {
  const total = smoke + noSmoke + untagged || 1;
  const segments = [
    { key: "smoke", label: "Smoke", count: smoke },
    { key: "no-smoke", label: "No smoke", count: noSmoke },
    { key: "untagged", label: "Untagged", count: untagged },
  ];
  let offset = 0;

  return (
    <article className="chart-card">
      <h2>Peat</h2>
      <div className="donut-wrap">
        <svg viewBox="0 0 42 42" className="donut" role="img" aria-label={takeaway}>
          <circle className="donut-hole" cx="21" cy="21" r={RADIUS} />
          {segments.map((seg) => {
            const length = (seg.count / total) * 100;
            const circle = (
              <circle
                key={seg.key}
                className={`donut-seg ${seg.key}`}
                cx="21"
                cy="21"
                r={RADIUS}
                strokeDasharray={`${length} ${100 - length}`}
                strokeDashoffset={25 - offset}
              />
            );
            offset += length;
            return circle;
          })}
          <text x="21" y="21" className="donut-value">
            {pct(smoke / total)}
          </text>
          <text x="21" y="26.5" className="donut-caption">
            smoke
          </text>
        </svg>
        <ul className="legend">
          {segments.map((seg) => (
            <li key={seg.key}>
              <span className={`swatch ${seg.key}`} />
              {seg.label} <em>{seg.count}</em>
            </li>
          ))}
        </ul>
      </div>
      <p className="takeaway">{takeaway}</p>
    </article>
  );
}
