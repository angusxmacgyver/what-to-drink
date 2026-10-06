import type { Bottle, Catalog } from "../types";

const STORAGE_KEY = "what-to-drink-catalog";
const OWNER_KEY = "what-to-drink-owner";
const THEME_KEY = "what-to-drink-theme";

export type Theme = "dark" | "light";

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
  return localStorage.getItem(OWNER_KEY) === "1";
}

export function setOwner(on: boolean): void {
  if (on) localStorage.setItem(OWNER_KEY, "1");
  else localStorage.removeItem(OWNER_KEY);
}

export function ownerPin(): string {
  return import.meta.env.VITE_OWNER_PIN || "cellar";
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
  try {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
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
