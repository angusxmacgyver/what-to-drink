import type { RadarSpoke } from "../lib/analytics";
import { wheelColorClass } from "../lib/colors";

type Props = {
  spokes: RadarSpoke[];
  takeaway: string;
};

const W = 580;
const H = 360;
const CX = W / 2;
const CY = H / 2;
const R = 120;
const RINGS = [0.25, 0.5, 0.75, 1];

function point(i: number, n: number, value: number): [number, number] {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [CX + Math.cos(angle) * R * value, CY + Math.sin(angle) * R * value];
}

function polygon(values: number[]): string {
  return values.map((v, i) => point(i, values.length, v).join(",")).join(" ");
}

export function FlavorRadar({ spokes, takeaway }: Props) {
  const n = spokes.length;

  return (
    <article className="chart-card">
      <h2>Flavor fingerprint</h2>
      {n < 3 ? (
        <p className="takeaway">Not enough Families to draw a fingerprint.</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="radar" role="img" aria-label={takeaway}>
            {RINGS.map((ring) => (
              <polygon key={ring} className="radar-ring" points={polygon(spokes.map(() => ring))} />
            ))}
            {spokes.map((spoke, i) => {
              const [x, y] = point(i, n, 1);
              const [lx, ly] = point(i, n, 1.12);
              const anchor = Math.abs(lx - CX) < 8 ? "middle" : lx > CX ? "start" : "end";
              const color = wheelColorClass(spoke.color);
              return (
                <g key={spoke.label}>
                  <line className={`radar-spoke ${color}`} x1={CX} y1={CY} x2={x} y2={y} />
                  <text className={`radar-label ${color}`} x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle">
                    {spoke.label}
                  </text>
                </g>
              );
            })}
            <polygon className="radar-cellar" points={polygon(spokes.map((spoke) => spoke.cellar))} />
            <polygon className="radar-open" points={polygon(spokes.map((spoke) => spoke.open))} />
          </svg>
          <ul className="legend inline">
            <li>
              <span className="swatch cellar" />
              Whole cellar
            </li>
            <li>
              <span className="swatch open-line" />
              Open bottles
            </li>
          </ul>
        </>
      )}
      <p className="takeaway">{takeaway} Each spoke is the share of bottles that carry that Family, among bottles with a Family.</p>
    </article>
  );
}
