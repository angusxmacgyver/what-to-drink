const MOOD_LABELS = {
  Smoke: "Smoky",
  Sweet: "Sweet",
  "Fruit (Fresh)": "Fresh fruit",
  "Fruit (Dried & Cooked)": "Dried fruit",
  Spice: "Spiced",
  Wood: "Oaky",
  Coastal: "Coastal",
  "Roasted & Rancio": "Roasted",
  "Nutty & Cereal": "Nutty",
  "Green, Herbal & Floral": "Floral",
  "Savoury & Umami": "Savoury",
};

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
  return [...groups.values()].map((group) => toEntry(group));
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
  const isSmws = Boolean(smws && !primary.distillery);
  if (!isSmws) {
    const title = primary.distillery || primary.bottling;
    const subtitle = primary.distillery ? primary.bottling : "";
    return {
      key: primary.bottleKey,
      bottles,
      primary,
      isSmws,
      title,
      subtitle,
      wheelTitle: title,
      wheelSub: subtitle,
    };
  }

  const code = smws.fullCode || primary.bottling;
  const isCask = /^[A-Z]*\d+\.\d+$/.test(code);
  let name = (smws.nameIntl || "").replace(new RegExp(`^${escapeRegExp(code)}\\s*[-–—]\\s*`), "");
  if (name === code) name = "";
  return {
    key: primary.bottleKey,
    bottles,
    primary,
    isSmws,
    title: name || code,
    subtitle: isCask ? `SMWS Cask No. ${code}` : name ? `SMWS · ${code}` : "Scotch Malt Whisky Society",
    wheelTitle: isCask ? `SMWS ${code}` : name || code,
    wheelSub: isCask ? name : name ? `SMWS · ${code}` : "SMWS",
  };
}

export function describe(entry) {
  const bottle = entry.primary;
  const region = (bottle.region || "").split(",")[0].trim();
  const age = Number(bottle.age);
  const meta = [];
  if (region) meta.push(region);
  meta.push(Number.isFinite(age) && age > 0 ? `${age} years` : "No age statement");
  if (bottle.abv) meta.push(`${bottle.abv}% ABV`);
  if (entry.isSmws && bottle.smws?.vintage) meta.push(`Distilled ${bottle.smws.vintage}`);
  else if (bottle.country && bottle.country !== "Scotland") meta.push(bottle.country);

  const open = entry.bottles.filter((item) => item.status === "Open");
  const sealed = entry.bottles.length - open.length;
  const where = bottle.location || (bottle.atApartment ? "Apartment" : "");
  const parts = [];
  if (where) parts.push(`Find it · <strong>${escapeHtml(where)}</strong>`);
  if (!open.length) parts.push("Sealed — tonight you crack it");
  else if (sealed > 0) parts.push(`${sealed} more sealed in reserve`);

  return {
    eyebrow: entry.isSmws ? "Tonight, from the Society" : "Tonight, pour",
    about: bottle.tastingNotes && bottle.notes ? bottle.notes : "",
    title: entry.title,
    subtitle: entry.subtitle,
    meta,
    theme: bottle.theme || bottle.smws?.flavorProfile || "",
    notes: bottle.tastingNotes || bottle.notes || "",
    flavors: (bottle.flavorFamilies || []).map((family) => MOOD_LABELS[family] ?? family),
    location: bottle.location || (bottle.atApartment ? "Apartment" : "not tagged yet"),
    find: parts.join("&ensp;·&ensp;"),
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
