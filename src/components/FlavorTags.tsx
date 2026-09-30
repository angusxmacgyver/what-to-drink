import { familyClass, subFamilyClass } from "../lib/colors";

export function FlavorTags({
  families,
  subs,
}: {
  families: string[];
  subs: string[];
}) {
  if (!families.length && !subs.length) return null;
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
