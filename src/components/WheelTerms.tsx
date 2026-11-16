import type { Bottle, WheelFamily } from "../types";
import { wheelColorClass } from "../lib/colors";
import { placeTerms, subgroupClusters } from "../lib/wheel";

export function WheelClusters({ wheel, bottles }: { wheel: WheelFamily[]; bottles: Bottle[] }) {
  const clusters = subgroupClusters(wheel, bottles);
  if (!clusters.length) return null;
  return (
    <div className="flavors grouped">
      <div className="flavor-lane">
        <span className="flavor-lane-label">Characteristics</span>
        <div className="flavor-lane-content">
          {clusters.map(({ subgroup, color, descriptors }) => (
            <div
              key={subgroup}
              className={`flavor-cluster ${wheelColorClass(color)}`}
              aria-label={`${subgroup} characteristics`}
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

export function WheelFamilies({ wheel, bottles }: { wheel: WheelFamily[]; bottles: Bottle[] }) {
  const families = placeTerms(wheel, "family", bottles.flatMap((b) => b.wheelFamilies));
  if (!families.length) return null;
  return (
    <div className="flavors wheel-terms">
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
