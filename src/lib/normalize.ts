const SCOTLAND = new Set([
  "islay",
  "highland",
  "speyside",
  "island",
  "campbeltown",
  "lowland",
  "blended scotch",
  "blended malt",
  "speyside, spey",
]);

export function countryFromRegion(region: string): string {
  const r = region.trim().toLowerCase();
  if (!r) return "";
  if (SCOTLAND.has(r) || r.startsWith("speyside") || r.startsWith("highland")) {
    return "Scotland";
  }
  if (r.includes("japan")) return "Japan";
  if (r.includes("ireland") || r.includes("irish")) return "Ireland";
  if (r.includes("canada")) return "Canada";
  if (r.includes("american") || r === "usa" || r.includes("united states") || r.includes("(ny)")) {
    return "USA";
  }
  return "";
}

const THEME_ALIASES: Record<string, string> = {
  "deep rich & dried fruits": "Deep, Rich & Dried Fruits",
  "sweet fruity & mellow": "Sweet, Fruity & Mellow",
  "juicy oak & vanilla": "Juicy, Oak & Vanilla",
  "bold & peaty": "Heavily Peated",
};

export function normalizeTheme(theme: string): string {
  const t = theme.trim();
  if (!t) return "";
  const aliased = THEME_ALIASES[t.toLowerCase()];
  return aliased ?? t;
}
