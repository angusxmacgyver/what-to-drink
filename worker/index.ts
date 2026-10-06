import type { Bottle } from "../src/types";
import { catalogJson, chunk, toRow, type BottleRow } from "../src/lib/rows";

type Statement = {
  bind(...values: unknown[]): Statement;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
};

export type Db = {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown>;
};

type Env = { DB: Db; OWNER_PIN?: string };

const UPSERT = `INSERT INTO bottles (id, bottle_key, status, data, updated_at) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET bottle_key = excluded.bottle_key, status = excluded.status,
  data = excluded.data, updated_at = excluded.updated_at`;

// One bound JSON array per statement: D1 allows 100 bound parameters per statement and
// 50 queries per request on the free plan. 500 bottles is about 0.6 MB, under the 2 MB value cap.
const INSERT_MANY = `INSERT INTO bottles (id, bottle_key, status, data, updated_at)
  SELECT json_extract(value, '$.id'), json_extract(value, '$.bottleKey'), json_extract(value, '$.status'), value, ?
  FROM json_each(?)`;
const INSERT_CHUNK = 500;

const SET_IMPORTED_AT = `INSERT INTO meta (key, value) VALUES ('importedAt', ?)
  ON CONFLICT (key) DO UPDATE SET value = excluded.value`;

const respond = (body: string | null, status: number) =>
  new Response(body, { status, headers: body === null ? {} : { "Content-Type": "application/json" } });
const fail = (status: number, error: string) => respond(JSON.stringify({ error }), status);

// Fail closed: a missing secret rejects every owner request, including a blank PIN.
const ownerAuthed = (request: Request, env: Env) => {
  const expected = env.OWNER_PIN;
  return Boolean(expected) && request.headers.get("X-Owner-Pin") === expected;
};

const isBottle = (value: unknown): value is Bottle => {
  const b = value as Bottle | null;
  return typeof b === "object" && b !== null && [b.id, b.bottleKey, b.status].every((v) => typeof v === "string");
};
const isBottleList = (value: unknown): value is Bottle[] => Array.isArray(value) && value.every(isBottle);

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

const insertMany = (db: Db, bottles: Bottle[], now: string) =>
  chunk(bottles, INSERT_CHUNK).map((group) => db.prepare(INSERT_MANY).bind(now, JSON.stringify(group)));

async function getCatalog(db: Db): Promise<Response> {
  const { results } = await db
    .prepare("SELECT status, data FROM bottles ORDER BY rowid")
    .all<Pick<BottleRow, "status" | "data">>();
  const meta = await db.prepare("SELECT value FROM meta WHERE key = 'importedAt'").first<{ value: string }>();
  return respond(catalogJson(results, meta?.value ?? ""), 200);
}

async function replaceCatalog(db: Db, request: Request): Promise<Response> {
  const body = (await readBody(request)) as { importedAt?: unknown; bottles?: unknown; graveyard?: unknown } | undefined;
  if (!body || typeof body.importedAt !== "string" || !isBottleList(body.bottles) || !isBottleList(body.graveyard)) {
    return fail(400, "expected a catalog with bottles and graveyard lists");
  }
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("DELETE FROM bottles"),
    ...insertMany(db, [...body.bottles, ...body.graveyard], now),
    db.prepare(SET_IMPORTED_AT).bind(body.importedAt),
  ]);
  return respond(null, 204);
}

async function addBottles(db: Db, request: Request): Promise<Response> {
  const body = await readBody(request);
  if (!isBottleList(body)) return fail(400, "expected a list of bottles");
  await db.batch(insertMany(db, body, new Date().toISOString()));
  return respond(null, 204);
}

async function saveBottle(db: Db, request: Request, id: string): Promise<Response> {
  const body = await readBody(request);
  if (!isBottle(body) || body.id !== id) return fail(400, "expected a bottle whose id matches the path");
  const row = toRow(body, new Date().toISOString());
  await db.prepare(UPSERT).bind(row.id, row.bottle_key, row.status, row.data, row.updated_at).run();
  return respond(null, 204);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const { method } = request;
    if (pathname === "/api/catalog" && method === "GET") return getCatalog(env.DB);

    const match = pathname.match(/^\/api\/bottles\/([^/]+)$/);
    const ownerRoute =
      (pathname === "/api/owner" && method === "POST") ||
      (pathname === "/api/catalog" && method === "PUT") ||
      (pathname === "/api/bottles" && method === "POST") ||
      Boolean(match && method === "PUT");
    if (!ownerRoute) return fail(404, "not found");
    if (!ownerAuthed(request, env)) return fail(401, "owner PIN required");
    if (pathname === "/api/owner") return respond(null, 204);
    if (pathname === "/api/catalog") return replaceCatalog(env.DB, request);
    if (pathname === "/api/bottles") return addBottles(env.DB, request);
    if (match) return saveBottle(env.DB, request, decodeURIComponent(match[1]));
    return fail(404, "not found");
  },
};
