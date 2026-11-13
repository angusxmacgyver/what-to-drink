import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Bottle, Catalog } from "../types";
import {
  addBottles,
  carriesDramHistory,
  catalogDocument,
  catalogFromDocument,
  fetchRemoteCatalog,
  isOwner,
  killBottle,
  loadLibraryLayout,
  loadStoredCatalog,
  replaceCatalog,
  saveBottle,
  saveLibraryLayout,
  setOwner,
  unlockOwner,
} from "./store";

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
  primaryCask: [],
  secondaryCask: [],
  atApartment: false,
  country: "Scotland",
  dateEmptied: "",
  smws: null,
  drams: [],
  lastThird: false,
  killShot: false,
});

const catalog = (bottles: Bottle[]): Catalog => ({
  schemaVersion: 1,
  importedAt: "t",
  bottles,
  graveyard: [],
  recentlyPoured: [],
});

let fetchMock: ReturnType<typeof vi.fn>;
const respondWith = (status: number, body: unknown = null) =>
  fetchMock.mockResolvedValue(new Response(body === null ? null : JSON.stringify(body), { status }));
const lastRequest = () => {
  const [path, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { path, method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body as string) : undefined };
};

beforeEach(() => {
  const store = new Map<string, string>();
  const session = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => session.get(k) ?? null,
    setItem: (k: string, v: string) => session.set(k, v),
    removeItem: (k: string) => session.delete(k),
  });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("library layout", () => {
  it("defaults to the list", () => {
    expect(loadLibraryLayout()).toBe("list");
  });

  it("remembers a grid choice and ignores anything else", () => {
    saveLibraryLayout("grid");
    expect(loadLibraryLayout()).toBe("grid");
    localStorage.setItem("what-to-drink-library-layout", "cards");
    expect(loadLibraryLayout()).toBe("list");
  });
});

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

describe("bottles saved before casks", () => {
  const { primaryCask: _p, secondaryCask: _s, ...older } = bottle("old");
  const olderCatalog = { schemaVersion: 1, importedAt: "t", bottles: [older], graveyard: [{ ...older, id: "dead", status: "Killed" }] };
  const casksOf = (b: Bottle) => ({ primaryCask: b.primaryCask, secondaryCask: b.secondaryCask });

  it("read as having no casks when they come from the server", async () => {
    respondWith(200, olderCatalog);
    const remote = await fetchRemoteCatalog();
    expect([...remote!.bottles, ...remote!.graveyard].map(casksOf)).toEqual([
      { primaryCask: [], secondaryCask: [] },
      { primaryCask: [], secondaryCask: [] },
    ]);
  });

  it("read as having no casks when they come from this device", () => {
    localStorage.setItem("what-to-drink-catalog", JSON.stringify(olderCatalog));
    const local = loadStoredCatalog();
    expect([...local!.bottles, ...local!.graveyard].map(casksOf)).toEqual([
      { primaryCask: [], secondaryCask: [] },
      { primaryCask: [], secondaryCask: [] },
    ]);
  });

  it("keep casks they already have", async () => {
    const tagged = { ...bottle("tagged"), primaryCask: ["Ex-bourbon"], secondaryCask: ["Rum"] };
    respondWith(200, catalog([tagged]));
    expect((await fetchRemoteCatalog())!.bottles).toEqual([tagged]);
  });
});

describe("the catalog document", () => {
  const history: Catalog = {
    schemaVersion: 1,
    importedAt: "t",
    bottles: [
      { ...bottle("poured"), drams: ["2026-11-01T20:00:00.000Z", "2026-11-02T21:30:00.000Z"], lastThird: true },
      bottle("untouched"),
    ],
    graveyard: [
      {
        ...bottle("finished"),
        status: "Killed",
        dateEmptied: "2026-11-03",
        drams: ["2026-10-30T19:00:00.000Z", "2026-11-03T22:00:00.000Z"],
        lastThird: true,
        killShot: true,
      },
    ],
    recentlyPoured: [
      { bottleId: "finished", at: "2026-11-03T22:00:00.000Z", killShot: true },
      { bottleId: "poured", at: "2026-11-02T21:30:00.000Z", killShot: false },
      { bottleId: "poured", at: "2026-11-01T20:00:00.000Z", killShot: false },
    ],
  };

  it("restores drams, last third, kill shot, graveyard drams, and Recently poured onto the same bottle ids", () => {
    expect(catalogFromDocument(catalogDocument(history))).toEqual(history);
  });

  it("reads a document that omits them as no drams, no last third, no kill shots, and nothing Recently poured", () => {
    const { primaryCask: _p, secondaryCask: _s, drams: _d, lastThird: _l, killShot: _k, ...older } = bottle("old");
    const document = JSON.stringify({
      schemaVersion: 1,
      importedAt: "t",
      bottles: [older],
      graveyard: [{ ...older, id: "dead", status: "Killed" }],
    });
    const read = catalogFromDocument(document);
    expect(read.recentlyPoured).toEqual([]);
    expect([...read.bottles, ...read.graveyard].map((b) => [b.id, b.drams, b.lastThird, b.killShot])).toEqual([
      ["old", [], false, false],
      ["dead", [], false, false],
    ]);
    expect(catalogFromDocument(catalogDocument(read))).toEqual(read);
  });

  it("keeps at most 25 Recently poured lines, newest first", () => {
    const lines = Array.from({ length: 30 }, (_, i) => ({ bottleId: "poured", at: `line-${i}`, killShot: false }));
    const read = catalogFromDocument(JSON.stringify({ ...history, recentlyPoured: lines }));
    expect(read.recentlyPoured.map((line) => line.at)).toEqual(lines.slice(0, 25).map((line) => line.at));
  });

  it("reads a graveyard bottle without drams as having none, and round-trips it", () => {
    const { drams: _d, ...noDrams } = history.graveyard[0];
    const read = catalogFromDocument(JSON.stringify({ ...history, graveyard: [noDrams] }));
    expect(read.graveyard[0].drams).toEqual([]);
    expect(catalogFromDocument(catalogDocument(read))).toEqual(read);
  });

  it("still carries the dram history when graveyard bottles have no drams", () => {
    const { drams: _d, ...noDrams } = history.graveyard[0];
    expect(carriesDramHistory(JSON.stringify({ ...history, graveyard: [noDrams] }))).toBe(true);
  });

  it("carries the dram history when every bottle has its drams and last third, every graveyard bottle its kill shot, and Recently poured is present", () => {
    expect(carriesDramHistory(catalogDocument(history))).toBe(true);
    expect(carriesDramHistory(catalogDocument({ ...history, recentlyPoured: [] }))).toBe(true);
  });

  it("does not carry the dram history when any of those facts is missing", () => {
    const { recentlyPoured: _r, ...noLines } = history;
    const { drams: _d, ...noDrams } = history.bottles[0];
    const { lastThird: _l, ...noLastThird } = history.bottles[0];
    const { killShot: _k, ...noKillShot } = history.graveyard[0];
    expect(carriesDramHistory(JSON.stringify(noLines))).toBe(false);
    expect(carriesDramHistory(JSON.stringify({ ...history, bottles: [noDrams] }))).toBe(false);
    expect(carriesDramHistory(JSON.stringify({ ...history, bottles: [noLastThird] }))).toBe(false);
    expect(carriesDramHistory(JSON.stringify({ ...history, graveyard: [noKillShot] }))).toBe(false);
    expect(carriesDramHistory("not json{")).toBe(false);
  });

  it("refuses a file that is not a catalog", () => {
    expect(() => catalogFromDocument("not json{")).toThrow();
    expect(() => catalogFromDocument(JSON.stringify({ bottles: "nope" }))).toThrow();
  });
});

describe("killBottle", () => {
  it("keeps the bottle's drams on its graveyard entry", () => {
    const poured = { ...bottle("poured"), drams: ["2026-11-01T20:00:00.000Z", "2026-11-02T21:30:00.000Z"] };
    const next = killBottle(catalog([poured, bottle("other")]), "poured");
    expect(next.bottles.map((b) => b.id)).toEqual(["other"]);
    expect(next.graveyard).toEqual([expect.objectContaining({ id: "poured", status: "Killed", drams: poured.drams })]);
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

  it("sends the PIN on later writes after the server accepts it", async () => {
    respondWith(204);
    expect(await unlockOwner("cellar")).toBe(true);
    expect(isOwner()).toBe(true);
    respondWith(204);
    expect(await saveBottle(bottle("a"))).toBe(true);
    const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(new Headers(init.headers).get("X-Owner-Pin")).toBe("cellar");
  });
});

describe("unlockOwner", () => {
  it("forgets the PIN on logout", async () => {
    respondWith(204);
    expect(await unlockOwner("cellar")).toBe(true);
    setOwner(false);
    expect(isOwner()).toBe(false);
  });

  it("stays locked when the server rejects the PIN or cannot be reached", async () => {
    respondWith(401);
    expect(await unlockOwner("nope")).toBe(false);
    expect(isOwner()).toBe(false);
    fetchMock.mockRejectedValue(new TypeError("offline"));
    expect(await unlockOwner("cellar")).toBe(false);
    expect(isOwner()).toBe(false);
  });
});
