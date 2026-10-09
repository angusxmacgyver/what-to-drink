import { emptyFilters, type Bottle, type Catalog, type FilterState } from "../types";

const STORAGE_KEY = "what-to-drink-catalog";
const OWNER_KEY = "what-to-drink-owner";
const PIN_KEY = "what-to-drink-owner-pin";
const THEME_KEY = "what-to-drink-theme";
const LIBRARY_LAYOUT_KEY = "what-to-drink-library-layout";
const COLLAPSED_SECTIONS_KEY = "what-to-drink-collapsed-sections";
const DRAM_SELECTION_KEY = "what-to-drink-dram-selection";

export type DramPlaceChoice = "house" | "apartment" | null;

export type DramSelection = {
  filters: FilterState;
  place: DramPlaceChoice;
  includeOpen: boolean;
  includeClosed: boolean;
};

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function sanitizeFilters(value: unknown): FilterState {
  const blank = emptyFilters();
  if (!value || typeof value !== "object") return blank;
  const raw = value as Partial<Record<keyof FilterState, unknown>>;
  const subs = stringList(raw.subs);
  const storedSubFamilies = stringRecord(raw.subFamilies);
  return {
    ...blank,
    search: typeof raw.search === "string" ? raw.search : "",
    distilleries: stringList(raw.distilleries),
    themes: stringList(raw.themes),
    statuses: stringList(raw.statuses),
    ageMin: typeof raw.ageMin === "string" ? raw.ageMin : "",
    ageMax: typeof raw.ageMax === "string" ? raw.ageMax : "",
    includeNas: raw.includeNas !== false,
    abvMin: typeof raw.abvMin === "string" ? raw.abvMin : "",
    abvMax: typeof raw.abvMax === "string" ? raw.abvMax : "",
    families: stringList(raw.families),
    subs,
    subFamilies: Object.fromEntries(subs.flatMap((sub) => storedSubFamilies[sub] ? [[sub, storedSubFamilies[sub]]] : [])),
    flavorMatch: raw.flavorMatch === "any" ? "any" : "all",
    countries: stringList(raw.countries),
    regions: stringList(raw.regions),
  };
}

export function loadDramSelection(): DramSelection | null {
  try {
    const raw = localStorage.getItem(DRAM_SELECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Partial<DramSelection>;
    return {
      filters: sanitizeFilters(record.filters),
      place: record.place === "house" || record.place === "apartment" ? record.place : null,
      includeOpen: record.includeOpen !== false,
      includeClosed: record.includeClosed === true,
    };
  } catch {
    return null;
  }
}

export function saveDramSelection(selection: DramSelection): void {
  localStorage.setItem(DRAM_SELECTION_KEY, JSON.stringify(selection));
}

export function saveDramFilters(filters: FilterState): void {
  const current = loadDramSelection();
  saveDramSelection({
    filters,
    place: current?.place ?? null,
    includeOpen: current?.includeOpen ?? true,
    includeClosed: current?.includeClosed ?? false,
  });
}

export function saveDramScope(scope: Pick<DramSelection, "place" | "includeOpen" | "includeClosed">): void {
  const current = loadDramSelection();
  saveDramSelection({ filters: current?.filters ?? emptyFilters(), ...scope });
}

export type Theme = "dark" | "light";
export type LibraryLayout = "list" | "grid";

export function loadLibraryLayout(): LibraryLayout {
  return localStorage.getItem(LIBRARY_LAYOUT_KEY) === "grid" ? "grid" : "list";
}

export function saveLibraryLayout(layout: LibraryLayout): void {
  localStorage.setItem(LIBRARY_LAYOUT_KEY, layout);
}

export function loadCollapsedSections(): string[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(COLLAPSED_SECTIONS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function setSectionCollapsed(id: string, collapsed: boolean): void {
  const ids = new Set(loadCollapsedSections());
  if (collapsed) ids.add(id);
  else ids.delete(id);
  sessionStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify([...ids]));
}

export function loadTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
}

export function loadStoredCatalog(): Catalog | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Catalog;
  } catch {
    return null;
  }
}

export function saveCatalog(catalog: Catalog): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
}

export function downloadCatalog(catalog: Catalog): void {
  const blob = new Blob([`${JSON.stringify(catalog, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bottles.json";
  a.click();
  URL.revokeObjectURL(url);
}

export function isOwner(): boolean {
  return Boolean(sessionStorage.getItem(PIN_KEY));
}

export function setOwner(on: boolean): void {
  localStorage.removeItem(OWNER_KEY);
  if (!on) sessionStorage.removeItem(PIN_KEY);
}

export async function unlockOwner(pin: string): Promise<boolean> {
  try {
    const res = await fetch("/api/owner", { method: "POST", headers: { "X-Owner-Pin": pin } });
    if (!res.ok) return false;
    sessionStorage.setItem(PIN_KEY, pin);
    localStorage.removeItem(OWNER_KEY);
    return true;
  } catch {
    return false;
  }
}

export async function fetchRemoteCatalog(): Promise<Catalog | null> {
  try {
    const res = await fetch("/api/catalog");
    if (!res.ok) return null;
    const catalog = (await res.json()) as Catalog;
    if (!catalog.bottles?.length) return null;
    saveCatalog(catalog);
    return catalog;
  } catch {
    return null;
  }
}

async function send(method: string, path: string, body: unknown): Promise<boolean> {
  const pin = sessionStorage.getItem(PIN_KEY);
  try {
    const res = await fetch(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(pin ? { "X-Owner-Pin": pin } : {}),
      },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const saveBottle = (bottle: Bottle) => send("PUT", `/api/bottles/${encodeURIComponent(bottle.id)}`, bottle);

export const addBottles = (bottles: Bottle[]) => send("POST", "/api/bottles", bottles);

export const replaceCatalog = (catalog: Catalog) => send("PUT", "/api/catalog", catalog);

export function killBottle(catalog: Catalog, id: string): Catalog {
  const bottle = catalog.bottles.find((b) => b.id === id);
  if (!bottle) return catalog;
  return {
    ...catalog,
    bottles: catalog.bottles.filter((b) => b.id !== id),
    graveyard: [
      ...catalog.graveyard,
      { ...bottle, status: "Killed", dateEmptied: new Date().toISOString().slice(0, 10) },
    ],
  };
}

export function upsertBottle(catalog: Catalog, bottle: Bottle): Catalog {
  const exists = catalog.bottles.some((b) => b.id === bottle.id);
  return {
    ...catalog,
    bottles: exists
      ? catalog.bottles.map((b) => (b.id === bottle.id ? bottle : b))
      : [...catalog.bottles, bottle],
  };
}
