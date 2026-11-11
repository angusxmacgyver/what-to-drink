import { describe, expect, it } from "vitest";
import type { Bottle, Catalog } from "../types";
import { applyMerge, planMerge } from "./merge";

let nextId = 0;

function bottle(overrides: Partial<Bottle> = {}): Bottle {
  nextId += 1;
  return {
    id: `id-${nextId}`,
    bottleKey: `key-${nextId}`,
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
    ...overrides,
  };
}

describe("planMerge", () => {
  it("flags an incoming bottle as new when no existing bottle shares its bottleKey", () => {
    const existing = [bottle({ bottleKey: "ardbeg::10" })];
    const incoming = [bottle({ bottleKey: "lagavulin::16" })];
    const rows = planMerge(existing, incoming);
    expect(rows).toHaveLength(1);
    expect(rows[0].duplicateOf).toBeNull();
  });

  it("flags an incoming bottle as a duplicate when an existing bottle shares its bottleKey", () => {
    const existing = [bottle({ bottleKey: "ardbeg::10", id: "existing-1" })];
    const incoming = [bottle({ bottleKey: "ardbeg::10" })];
    const rows = planMerge(existing, incoming);
    expect(rows[0].duplicateOf?.id).toBe("existing-1");
  });

  it("starts each incoming bottle at no drams with last third off", () => {
    const incoming = [bottle({ drams: ["2026-11-01T20:00:00.000Z"], lastThird: true })];
    const [row] = planMerge([], incoming);
    expect(row.bottle).toEqual({ ...incoming[0], drams: [], lastThird: false });
  });

  it("handles an empty incoming list", () => {
    expect(planMerge([bottle()], [])).toEqual([]);
  });
});

describe("applyMerge", () => {
  it("appends only the selected bottles, leaving existing bottles untouched", () => {
    const existing = bottle({ bottleKey: "ardbeg::10" });
    const catalog: Catalog = {
      schemaVersion: 1,
      importedAt: "2026-01-01",
      bottles: [existing],
      graveyard: [],
      recentlyPoured: [],
    };
    const added = bottle({ bottleKey: "lagavulin::16" });
    const next = applyMerge(catalog, [added]);
    expect(next.bottles).toEqual([existing, added]);
    expect(next.bottles).not.toBe(catalog.bottles);
  });

  it("leaves existing drams, last third, and Recently poured alone", () => {
    const poured = bottle({ drams: ["2026-11-01T20:00:00.000Z"], lastThird: true });
    const catalog: Catalog = {
      schemaVersion: 1,
      importedAt: "2026-01-01",
      bottles: [poured],
      graveyard: [],
      recentlyPoured: [{ bottleId: poured.id, at: "2026-11-01T20:00:00.000Z", killShot: false }],
    };
    const [row] = planMerge(catalog.bottles, [bottle()]);
    const next = applyMerge(catalog, [row.bottle]);
    expect(next.bottles[0]).toBe(poured);
    expect(next.recentlyPoured).toBe(catalog.recentlyPoured);
  });

  it("never touches the graveyard", () => {
    const killed = bottle({ status: "Killed" });
    const catalog: Catalog = {
      schemaVersion: 1,
      importedAt: "2026-01-01",
      bottles: [],
      graveyard: [killed],
      recentlyPoured: [],
    };
    const next = applyMerge(catalog, [bottle()]);
    expect(next.graveyard).toBe(catalog.graveyard);
  });

  it("adds nothing when no bottles are selected", () => {
    const catalog: Catalog = { schemaVersion: 1, importedAt: "", bottles: [], graveyard: [], recentlyPoured: [] };
    expect(applyMerge(catalog, []).bottles).toEqual([]);
  });
});
