import type { Bottle, WheelFamily } from "../types";
import { wheelColorClass } from "../lib/colors";
import { bottleFamilies, subgroupClusters } from "../lib/wheel";

type Terms = { wheel: WheelFamily[]; bottles: Bottle[] };

export function WheelClusters({ wheel, bottles, onClick }: Terms & { onClick?: () => void }) {
  const clusters = subgroupClusters(wheel, bottles);
  if (!clusters.length) return null;
  return (
    <div className={onClick ? "flavors grouped toggles" : "flavors grouped"} onClick={onClick}>
      <div className="flavor-lane">
        <span className="flavor-lane-label">Characteristics</span>
        <div className="flavor-lane-content">
          {clusters.map(({ subgroup, color, descriptors }) => (
            <div
              key={`${color}|${subgroup}`}
              className={`flavor-cluster ${wheelColorClass(color)}`}
              role="group"
              aria-label={subgroup}
            >
              <span className="flavor-cluster-label">{subgroup}</span>
              {descriptors.map((descriptor) => (
                <span key={descriptor} className={`tag wheel-term term-descriptor ${wheelColorClass(color)}`}>
                  {descriptor}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WheelFamilies({ wheel, bottles }: Terms) {
  const families = bottleFamilies(wheel, bottles);
  if (!families.length) return null;
  return (
    <div className="flavors">
      <div className="flavor-lane">
        <span className="flavor-lane-label">Families</span>
        <div className="flavor-lane-content">
          {families.map((family) => (
            <span key={family.label} className={`tag wheel-term term-family ${wheelColorClass(family.color)}`}>
              {family.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
