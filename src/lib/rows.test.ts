import { describe, expect, it } from "vitest";
import type { Bottle, Catalog } from "../types";
import { catalogJson, chunk, seedSql, toRow } from "./rows";

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
    atApartment: false,
    country: "Scotland",
    dateEmptied: "",
    smws: null,
    ...overrides,
  };
}

describe("toRow", () => {
  it("copies the queried fields into columns and the whole bottle into data", () => {
    const b = bottle({ id: "a", bottleKey: "ardbeg::10", status: "Closed" });
    const row = toRow(b, "2026-10-05T00:00:00.000Z");
    expect(row).toEqual({
      id: "a",
      bottle_key: "ardbeg::10",
      status: "Closed",
      data: JSON.stringify(b),
      updated_at: "2026-10-05T00:00:00.000Z",
    });
  });
});

describe("catalogJson", () => {
  it("splits Killed rows into the graveyard and round-trips every field", () => {
    const live = bottle({ flavorFamilies: ["Smoke"], smws: null });
    const dead = bottle({ status: "Killed", dateEmptied: "2026-09-01" });
    const rows = [toRow(live, "t"), toRow(dead, "t")];
    const catalog = JSON.parse(catalogJson(rows, "2026-10-02T18:00:10.484Z"));
    expect(catalog).toEqual({
      schemaVersion: 1,
      importedAt: "2026-10-02T18:00:10.484Z",
      bottles: [live],
      graveyard: [dead],
    });
  });
});

describe("chunk", () => {
  it("splits into groups of the given size with a short last group", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns no groups for an empty list", () => {
    expect(chunk([], 20)).toEqual([]);
  });
});

describe("seedSql", () => {
  const catalog: Catalog = {
    schemaVersion: 1,
    importedAt: "2026-10-02T18:00:10.484Z",
    bottles: [bottle({ id: "live", bottling: "Uigeadail's Own" })],
    graveyard: [bottle({ id: "dead", status: "Killed" })],
  };
  const sql = seedSql(catalog, "2026-10-05T00:00:00.000Z");

  it("clears existing rows first so a re-seed replaces the catalog", () => {
    expect(sql.indexOf("DELETE FROM bottles;")).toBe(0);
    expect(sql).toContain("DELETE FROM meta;");
  });

  it("inserts one row per live and graveyard bottle", () => {
    expect(sql.match(/INSERT INTO bottles /g)).toHaveLength(2);
    expect(sql).toContain("'dead', 'key-");
  });

  it("escapes single quotes in the JSON", () => {
    expect(sql).toContain("Uigeadail''s Own");
    expect(sql).not.toContain("Uigeadail's Own");
  });

  it("stores importedAt in meta", () => {
    expect(sql).toContain(
      "INSERT INTO meta (key, value) VALUES ('importedAt', '2026-10-02T18:00:10.484Z');",
    );
  });
});
