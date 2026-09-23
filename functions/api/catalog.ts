type Env = {
  DB?: {
    exec: (q: string) => Promise<unknown>;
    prepare: (q: string) => {
      first: <T>() => Promise<T | null>;
      bind: (...args: unknown[]) => { run: () => Promise<unknown> };
    };
  };
};

type Ctx = { request: Request; env: Env };

const SCHEMA = `CREATE TABLE IF NOT EXISTS snapshot (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`;

async function read(db: NonNullable<Env["DB"]>) {
  await db.exec(SCHEMA);
  const row = await db.prepare("SELECT json FROM snapshot WHERE id = 1").first<{ json: string }>();
  return row?.json ?? null;
}

export async function onRequestGet({ env }: Ctx) {
  if (!env.DB) return new Response(JSON.stringify({ error: "no db" }), { status: 404 });
  const json = await read(env.DB);
  if (!json) return new Response("empty", { status: 404 });
  return new Response(json, { headers: { "Content-Type": "application/json" } });
}

export async function onRequestPut({ request, env }: Ctx) {
  if (!env.DB) return new Response(JSON.stringify({ error: "no db" }), { status: 404 });
  const body = await request.text();
  JSON.parse(body);
  await env.DB.exec(SCHEMA);
  await env.DB.prepare(
    "INSERT INTO snapshot (id, json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at",
  )
    .bind(body, new Date().toISOString())
    .run();
  return new Response(body, { headers: { "Content-Type": "application/json" } });
}
