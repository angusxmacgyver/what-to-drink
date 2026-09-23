import type { Bottle, Catalog } from "../types";

const STORAGE_KEY = "what-to-drink-catalog";
const OWNER_KEY = "what-to-drink-owner";

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
    return (await res.json()) as Catalog;
  } catch {
    return null;
  }
}

export async function pushRemoteCatalog(catalog: Catalog): Promise<boolean> {
  try {
    const res = await fetch("/api/catalog", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(catalog),
    });
    return res.ok;
  } catch {
    return false;
  }
}

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
