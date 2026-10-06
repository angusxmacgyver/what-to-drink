import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Bottle, Catalog } from "../types";
import { addBottles, fetchRemoteCatalog, loadStoredCatalog, replaceCatalog, saveBottle } from "./store";

const bottle = (id: string): Bottle => ({
  id,
  bottleKey: `key-${id}`,
  distillery: "Ardbeg",
  bottling: "10",
  age: 10,
  abv: 46,
  status: "Open",
  notes: "",
  tastingNotes: "",
  location: "",
  region: "Islay",
  theme: "",
  flavorFamilies: [],
  subCharacteristics: [],
  atApartment: false,
  country: "Scotland",
  dateEmptied: "",
  smws: null,
});

const catalog = (bottles: Bottle[]): Catalog => ({ schemaVersion: 1, importedAt: "t", bottles, graveyard: [] });

let fetchMock: ReturnType<typeof vi.fn>;
const respondWith = (status: number, body: unknown = null) =>
  fetchMock.mockResolvedValue(new Response(body === null ? null : JSON.stringify(body), { status }));
const lastRequest = () => {
  const [path, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { path, method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body as string) : undefined };
};

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("fetchRemoteCatalog", () => {
  it("returns the server catalog and caches it on this device", async () => {
    const remote = catalog([bottle("a")]);
    respondWith(200, remote);
    expect(await fetchRemoteCatalog()).toEqual(remote);
    expect(loadStoredCatalog()).toEqual(remote);
  });

  it("returns null and keeps the cache when the server has no bottles", async () => {
    respondWith(200, catalog([]));
    expect(await fetchRemoteCatalog()).toBeNull();
    expect(loadStoredCatalog()).toBeNull();
  });

  it("returns null when the server errors or is unreachable", async () => {
    respondWith(500);
    expect(await fetchRemoteCatalog()).toBeNull();
    fetchMock.mockRejectedValue(new TypeError("offline"));
    expect(await fetchRemoteCatalog()).toBeNull();
  });
});

describe("writes", () => {
  it("saveBottle PUTs one bottle to its own path", async () => {
    respondWith(204);
    const b = bottle("smws/1.246");
    expect(await saveBottle(b)).toBe(true);
    expect(lastRequest()).toEqual({ path: "/api/bottles/smws%2F1.246", method: "PUT", body: b });
  });

  it("addBottles POSTs the list", async () => {
    respondWith(204);
    const list = [bottle("a"), bottle("b")];
    expect(await addBottles(list)).toBe(true);
    expect(lastRequest()).toEqual({ path: "/api/bottles", method: "POST", body: list });
  });

  it("replaceCatalog PUTs the whole catalog", async () => {
    respondWith(204);
    const next = catalog([bottle("a")]);
    expect(await replaceCatalog(next)).toBe(true);
    expect(lastRequest()).toEqual({ path: "/api/catalog", method: "PUT", body: next });
  });

  it("report false when the server rejects or is unreachable", async () => {
    respondWith(400);
    expect(await saveBottle(bottle("a"))).toBe(false);
    fetchMock.mockRejectedValue(new TypeError("offline"));
    expect(await addBottles([bottle("a")])).toBe(false);
  });
});
