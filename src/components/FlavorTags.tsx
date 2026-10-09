import { familyClass, subFamilyClass } from "../lib/colors";
import { subOwnerFamily } from "../lib/library";

type Props = {
  families: string[];
  subs: string[];
  grouped?: boolean;
  selectedFamilies?: string[];
  selectedSubs?: string[];
  subFamilies?: Record<string, string>;
};

function FlavorTag({
  kind,
  label,
  color,
  matched,
}: {
  kind: "family" | "sub";
  label: string;
  color: string;
  matched: boolean;
}) {
  return (
    <span
      className={["tag", kind, color, matched ? "matched" : ""].filter(Boolean).join(" ")}
      aria-label={matched ? `${label}, matches selected filter` : undefined}
    >
      {matched ? <span className="match-mark" aria-hidden="true">✓</span> : null}
      {label}
    </span>
  );
}

export function FlavorTags({
  families,
  subs,
  grouped = false,
  selectedFamilies = [],
  selectedSubs = [],
  subFamilies = {},
}: Props) {
  if (!families.length && !subs.length) return null;
  if (grouped) {
    const orderedFamilies = [...families].sort(
      (a, b) => Number(!selectedFamilies.includes(a)) - Number(!selectedFamilies.includes(b)),
    );
    const groups = new Map<string, string[]>();
    for (const sub of subs) {
      const family = subFamilies[sub] || subOwnerFamily(sub) || "";
      groups.set(family, [...(groups.get(family) ?? []), sub]);
    }
    const orderedGroups = [...groups].sort(([a, aSubs], [b, bSubs]) => {
      const aSelected = selectedFamilies.includes(a) || aSubs.some((sub) => selectedSubs.includes(sub));
      const bSelected = selectedFamilies.includes(b) || bSubs.some((sub) => selectedSubs.includes(sub));
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      return a.localeCompare(b);
    });
    return (
      <div className="flavors grouped">
        {orderedFamilies.length ? (
          <div className="flavor-lane">
            <span className="flavor-lane-label">Families</span>
            <div className="flavor-lane-content">
              {orderedFamilies.map((family) => (
                <FlavorTag
                  key={`f:${family}`}
                  kind="family"
                  label={family}
                  color={familyClass(family)}
                  matched={selectedFamilies.includes(family)}
                />
              ))}
            </div>
          </div>
        ) : null}
        {orderedGroups.length ? (
          <div className="flavor-lane">
            <span className="flavor-lane-label">Characteristics</span>
            <div className="flavor-lane-content">
              {orderedGroups.map(([family, groupedSubs]) => (
                <div
                  key={family || "other"}
                  className={`flavor-cluster ${familyClass(family)}`}
                  aria-label={`${family || "Other"} characteristics`}
                >
                  <span className="flavor-cluster-label">{family || "Other"}</span>
                  {groupedSubs.map((sub) => (
                    <FlavorTag
                      key={`s:${sub}`}
                      kind="sub"
                      label={sub}
                      color={subFamilyClass(sub, subFamilies[sub])}
                      matched={selectedSubs.includes(sub)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flavors">
      {families.length ? (
        <div className="flavor-row">
          {families.map((family) => (
            <span key={`f:${family}`} className={`tag family ${familyClass(family)}`}>
              {family}
            </span>
          ))}
        </div>
      ) : null}
      {subs.length ? (
        <div className="flavor-row">
          {subs.map((sub) => (
            <span key={`s:${sub}`} className={`tag sub ${subFamilyClass(sub)}`}>
              {sub}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
