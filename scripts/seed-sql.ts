import fs from "node:fs";
import path from "node:path";
import type { Catalog } from "../src/types.ts";
import { seedSql } from "../src/lib/rows.ts";

const source = path.resolve("data/bottles.json");
const dest = path.resolve("data/seed.sql");

const catalog = JSON.parse(fs.readFileSync(source, "utf8")) as Catalog;
fs.writeFileSync(dest, seedSql(catalog, new Date().toISOString()));

console.log(
  JSON.stringify({ dest, bottles: catalog.bottles.length, graveyard: catalog.graveyard.length }, null, 2),
);
