type Props = {
  families: string[];
  cellar: number[];
  open: number[];
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

export function FlavorRadar({ families, cellar, open, takeaway }: Props) {
  const n = families.length;

  return (
    <article className="chart-card">
      <h2>Flavor fingerprint</h2>
      {n < 3 ? (
        <p className="takeaway">Not enough flavor tags to draw a fingerprint.</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="radar" role="img" aria-label={takeaway}>
            {RINGS.map((ring) => (
              <polygon key={ring} className="radar-ring" points={polygon(families.map(() => ring))} />
            ))}
            {families.map((family, i) => {
              const [x, y] = point(i, n, 1);
              const [lx, ly] = point(i, n, 1.12);
              const anchor = Math.abs(lx - CX) < 8 ? "middle" : lx > CX ? "start" : "end";
              return (
                <g key={family}>
                  <line className="radar-spoke" x1={CX} y1={CY} x2={x} y2={y} />
                  <text className="radar-label" x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle">
                    {family}
                  </text>
                </g>
              );
            })}
            <polygon className="radar-cellar" points={polygon(cellar)} />
            <polygon className="radar-open" points={polygon(open)} />
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
      <p className="takeaway">{takeaway} Each spoke is the share of tagged bottles with that family.</p>
    </article>
  );
}
