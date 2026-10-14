export const FANCY_POOL_KEY = "what-to-drink-fancy-pool";

export function consumePool(storage = sessionStorage) {
  try {
    const raw = storage.getItem(FANCY_POOL_KEY);
    storage.removeItem(FANCY_POOL_KEY);
    if (!raw) return [];
    const payload = JSON.parse(raw);
    if (payload?.version !== 1 || !Array.isArray(payload.bottles)) return [];
    return payload.bottles.filter(
      (bottle) =>
        bottle &&
        typeof bottle.id === "string" &&
        typeof bottle.bottleKey === "string" &&
        (bottle.status === "Open" || bottle.status === "Closed"),
    );
  } catch {
    return [];
  }
}

export function buildEntries(bottles) {
  const groups = new Map();
  for (const bottle of bottles) {
    const group = groups.get(bottle.bottleKey);
    if (group) group.push(bottle);
    else groups.set(bottle.bottleKey, [bottle]);
  }
  return [...groups.values()].map(toEntry);
}

export function pickBottle(bottles, previousId = null) {
  if (!bottles.length) return null;
  const choices = bottles.length > 1 ? bottles.filter((bottle) => bottle.id !== previousId) : bottles;
  return choices[Math.floor(Math.random() * choices.length)];
}

export function entryForBottle(bottles, picked) {
  return toEntry(bottles.filter((bottle) => bottle.bottleKey === picked.bottleKey), picked);
}

function toEntry(bottles, preferred) {
  const primary = preferred ?? bottles.find((bottle) => bottle.status === "Open") ?? bottles[0];
  const smws = primary.smws;
  const code = smws?.fullCode || primary.bottling;
  const societyName = (smws?.nameIntl || "").replace(new RegExp(`^${escapeRegExp(code)}\\s*[-–—]\\s*`), "");
  const isSociety = Boolean(smws && !primary.distillery);
  const title = isSociety ? societyName || code : primary.distillery || primary.bottling;
  const subtitle = isSociety
    ? societyName
      ? `SMWS · ${code}`
      : "Scotch Malt Whisky Society"
    : primary.distillery
      ? primary.bottling
      : "";
  return {
    key: primary.bottleKey,
    bottles,
    primary,
    title,
    subtitle,
    wheelTitle: isSociety ? `SMWS ${code}` : title,
    wheelSub: isSociety ? societyName : subtitle,
  };
}

export function describe(entry) {
  const bottle = entry.primary;
  const age = Number(bottle.age);
  const meta = [
    (bottle.region || "").split(",")[0].trim(),
    Number.isFinite(age) && age > 0 ? `${age} years` : "No age statement",
    bottle.abv ? `${bottle.abv}% ABV` : "",
  ].filter(Boolean);
  return {
    title: entry.title,
    subtitle: entry.subtitle,
    meta,
    theme: bottle.theme || bottle.smws?.flavorProfile || "",
    notes: bottle.tastingNotes || bottle.notes || "",
    flavors: bottle.flavorFamilies || [],
    location: bottle.location || (bottle.atApartment ? "Apartment" : "not tagged yet"),
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
