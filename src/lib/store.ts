import type { Bottle, Catalog } from "../types";

const STORAGE_KEY = "what-to-drink-catalog";
const OWNER_KEY = "what-to-drink-owner";
const PIN_KEY = "what-to-drink-owner-pin";
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
