import type { Entry } from "../lib/analytics";

type Props = {
  groups: { family: string; subs: Entry[] }[];
};

export function PalateCloud({ groups }: Props) {
  const max = Math.max(1, ...groups.flatMap((g) => g.subs.map((s) => s.count)));
  const top = groups.flatMap((g) => g.subs).sort((a, b) => b.count - a.count)[0];

  return (
    <article className="chart-card">
      <h2>Palate</h2>
      <div className="palate">
        {groups.map((group) => (
          <section key={group.family} className="palate-group">
            <h3>{group.family}</h3>
            <div className="palate-words">
              {group.subs.map((sub) => (
                <span
                  key={sub.label}
                  className="palate-word"
                  style={{ fontSize: `${12 + (sub.count / max) * 14}px`, opacity: 0.55 + (sub.count / max) * 0.45 }}
                  title={`${sub.count} bottles`}
                >
                  {sub.label}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="takeaway">
        {top ? `Most common: ${top.label} (${top.count} bottles). ` : ""}
        Sub-characteristics sit under the family they appear with most; size follows bottle count.
      </p>
    </article>
  );
}
