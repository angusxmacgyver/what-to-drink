import type { Bottle, Catalog } from "../types";

export type BottleRow = {
  id: string;
  bottle_key: string;
  status: string;
  data: string;
  updated_at: string;
};

export function toRow(bottle: Bottle, updatedAt: string): BottleRow {
  return {
    id: bottle.id,
    bottle_key: bottle.bottleKey,
    status: bottle.status,
    data: JSON.stringify(bottle),
    updated_at: updatedAt,
  };
}

export function rowsToCatalog(rows: Pick<BottleRow, "status" | "data">[], importedAt: string): Catalog {
  const bottles: Bottle[] = [];
  const graveyard: Bottle[] = [];
  for (const row of rows) {
    const bottle = JSON.parse(row.data) as Bottle;
    (row.status === "Killed" ? graveyard : bottles).push(bottle);
  }
  return { schemaVersion: 1, importedAt, bottles, graveyard };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

// Literal SQL for `wrangler d1 execute --file`, which takes no bound parameters.
export function seedSql(catalog: Catalog, updatedAt: string): string {
  const lines = ["DELETE FROM bottles;", "DELETE FROM meta;"];
  for (const bottle of [...catalog.bottles, ...catalog.graveyard]) {
    const row = toRow(bottle, updatedAt);
    const values = [row.id, row.bottle_key, row.status, row.data, row.updated_at].map(quote).join(", ");
    lines.push(`INSERT INTO bottles (id, bottle_key, status, data, updated_at) VALUES (${values});`);
  }
  lines.push(`INSERT INTO meta (key, value) VALUES ('importedAt', ${quote(catalog.importedAt)});`);
  return `${lines.join("\n")}\n`;
}
