import type { Entry } from "../lib/analytics";
import { wheelColorClass } from "../lib/colors";

type Props = {
  groups: { family: string; color: string; descriptors: Entry[] }[];
};

export function PalateCloud({ groups }: Props) {
  const max = Math.max(1, ...groups.flatMap((g) => g.descriptors.map((d) => d.count)));
  const top = groups.flatMap((g) => g.descriptors).sort((a, b) => b.count - a.count)[0];

  return (
    <article className="chart-card">
      <h2>Palate</h2>
      <div className="palate">
        {groups.map((group) => (
          <section key={group.family} className={`palate-group ${wheelColorClass(group.color)}`}>
            <h3>{group.family}</h3>
            <div className="palate-words">
              {group.descriptors.map((descriptor) => (
                <span
                  key={descriptor.label}
                  className="palate-word"
                  style={{ fontSize: `${12 + (descriptor.count / max) * 14}px`, opacity: 0.55 + (descriptor.count / max) * 0.45 }}
                  title={`${descriptor.count} bottles`}
                >
                  {descriptor.label}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="takeaway">
        {top ? `Most common: ${top.label} (${top.count} bottles). ` : ""}
        Descriptors sit under their Family; size follows how many bottles carry each one.
      </p>
    </article>
  );
}
