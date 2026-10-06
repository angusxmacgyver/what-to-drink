import fs from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import type { Bottle, Catalog } from "../src/types";
import worker, { type Db } from "./index";

type Statement = ReturnType<Db["prepare"]>;

function fakeD1(sqlite: DatabaseSync): Db {
  const statement = (sql: string, params: SQLInputValue[] = []): Statement & { sql: string; params: SQLInputValue[] } => ({
    sql,
    params,
    bind: (...values) => statement(sql, values as SQLInputValue[]),
    all: async <T,>() => ({ results: sqlite.prepare(sql).all(...params) as T[] }),
    first: async <T,>() => (sqlite.prepare(sql).get(...params) as T | undefined) ?? null,
    run: async () => sqlite.prepare(sql).run(...params),
  });
  return {
    prepare: (sql) => statement(sql),
    batch: async (statements) => {
      sqlite.exec("BEGIN");
      try {
        for (const s of statements as ReturnType<typeof statement>[]) sqlite.prepare(s.sql).run(...s.params);
        sqlite.exec("COMMIT");
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }
      return [];
    },
  };
}

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

const PIN = "cellar";

let env: { DB: Db; OWNER_PIN?: string };

const call = (method: string, path: string, body?: unknown, pin: string | null = PIN) =>
  worker.fetch(
    new Request(`https://example.test${path}`, {
      method,
      headers: pin === null ? undefined : { "X-Owner-Pin": pin },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    }),
    env,
  );

const getCatalog = async () => (await (await call("GET", "/api/catalog")).json()) as Catalog;

beforeEach(() => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(fs.readFileSync("schema.sql", "utf8"));
  env = { DB: fakeD1(sqlite), OWNER_PIN: PIN };
});

describe("GET /api/catalog", () => {
  it("returns an empty catalog before anything is imported", async () => {
    const res = await call("GET", "/api/catalog");
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(await res.json()).toEqual({ schemaVersion: 1, importedAt: "", bottles: [], graveyard: [] });
  });
});

describe("PUT /api/catalog", () => {
  it("replaces every bottle and the import time", async () => {
    await call("PUT", "/api/catalog", { schemaVersion: 1, importedAt: "old", bottles: [bottle()], graveyard: [] });
    const next: Catalog = {
      schemaVersion: 1,
      importedAt: "2026-10-02T18:00:10.484Z",
      bottles: [bottle(), bottle({ status: "Closed" })],
      graveyard: [bottle({ status: "Killed" })],
    };
    expect((await call("PUT", "/api/catalog", next)).status).toBe(204);
    expect(await getCatalog()).toEqual(next);
  });

  it("round-trips the real cellar unchanged", async () => {
    const real = JSON.parse(fs.readFileSync("data/bottles.json", "utf8")) as Catalog;
    await call("PUT", "/api/catalog", real);
    expect(await getCatalog()).toEqual(real);
  });

  it("rejects a body without bottle lists and leaves the data alone", async () => {
    const kept = bottle();
    await call("PUT", "/api/catalog", { schemaVersion: 1, importedAt: "t", bottles: [kept], graveyard: [] });
    expect((await call("PUT", "/api/catalog", { bottles: "nope" })).status).toBe(400);
    expect((await getCatalog()).bottles).toEqual([kept]);
  });
});

describe("PUT /api/bottles/:id", () => {
  it("adds a new bottle, then updates it in place", async () => {
    const b = bottle();
    expect((await call("PUT", `/api/bottles/${b.id}`, b)).status).toBe(204);
    const edited = { ...b, location: "Shelf 2" };
    await call("PUT", `/api/bottles/${b.id}`, edited);
    expect((await getCatalog()).bottles).toEqual([edited]);
  });

  it("moves a bottle to the graveyard when it is saved as Killed", async () => {
    const b = bottle();
    await call("PUT", `/api/bottles/${b.id}`, b);
    const killed = { ...b, status: "Killed" as const, dateEmptied: "2026-10-05" };
    await call("PUT", `/api/bottles/${b.id}`, killed);
    const catalog = await getCatalog();
    expect(catalog.bottles).toEqual([]);
    expect(catalog.graveyard).toEqual([killed]);
  });

  it("rejects a body whose id does not match the path", async () => {
    expect((await call("PUT", "/api/bottles/other", bottle())).status).toBe(400);
  });
});

describe("POST /api/bottles", () => {
  it("adds bottles without touching existing ones", async () => {
    const existing = bottle();
    await call("PUT", `/api/bottles/${existing.id}`, existing);
    const added = [bottle(), bottle()];
    expect((await call("POST", "/api/bottles", added)).status).toBe(204);
    expect((await getCatalog()).bottles).toEqual([existing, ...added]);
  });

  it("rejects anything that is not a list of bottles", async () => {
    expect((await call("POST", "/api/bottles", [{ id: 1 }])).status).toBe(400);
    expect((await call("POST", "/api/bottles", "not json{")).status).toBe(400);
  });
});

it("returns 404 for unknown API routes", async () => {
  expect((await call("GET", "/api/nope")).status).toBe(404);
  expect((await call("DELETE", "/api/catalog")).status).toBe(404);
});

describe("owner PIN", () => {
  it("checks the PIN without writing", async () => {
    expect((await call("POST", "/api/owner")).status).toBe(204);
    expect((await call("POST", "/api/owner", undefined, null)).status).toBe(401);
    expect((await call("POST", "/api/owner", undefined, "wrong")).status).toBe(401);
    expect(await getCatalog()).toEqual({ schemaVersion: 1, importedAt: "", bottles: [], graveyard: [] });
  });

  it("rejects owner writes that omit or miss the PIN and leaves the catalog unchanged", async () => {
    const kept = bottle();
    await call("PUT", `/api/bottles/${kept.id}`, kept);
    const edited = { ...kept, location: "nope" };
    expect((await call("PUT", `/api/bottles/${kept.id}`, edited, null)).status).toBe(401);
    expect((await call("PUT", `/api/bottles/${kept.id}`, edited, "wrong")).status).toBe(401);
    expect((await call("POST", "/api/bottles", [bottle()], null)).status).toBe(401);
    expect(
      (await call("PUT", "/api/catalog", { schemaVersion: 1, importedAt: "x", bottles: [], graveyard: [] }, null))
        .status,
    ).toBe(401);
    expect((await getCatalog()).bottles).toEqual([kept]);
  });

  it("rejects owner requests when the server has no PIN configured", async () => {
    env = { ...env, OWNER_PIN: undefined };
    expect((await call("POST", "/api/owner")).status).toBe(401);
    expect((await call("POST", "/api/bottles", [bottle()])).status).toBe(401);
  });

  it("still serves the catalog to guests who send no PIN", async () => {
    expect((await call("GET", "/api/catalog", undefined, null)).status).toBe(200);
  });
});
