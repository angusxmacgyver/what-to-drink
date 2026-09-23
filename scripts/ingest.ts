import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { catalogFromWorkbook } from "../src/lib/ingest.ts";

const DEFAULT_XLSX =
  "/Users/max.krueger/Downloads/Whisky Inventory_Sept_22_1623.xlsx";

const source = path.resolve(process.argv[2] ?? DEFAULT_XLSX);
const dataDir = path.resolve("data");
const dest = path.join(dataDir, "bottles.json");
const backup = path.join(dataDir, "bottles.backup.json");

if (!fs.existsSync(source)) {
  console.error(`Workbook not found: ${source}`);
  process.exit(1);
}

fs.mkdirSync(dataDir, { recursive: true });

if (fs.existsSync(dest)) {
  fs.copyFileSync(dest, backup);
}

const workbook = XLSX.read(fs.readFileSync(source), { type: "buffer" });
const catalog = catalogFromWorkbook(workbook);
fs.writeFileSync(dest, `${JSON.stringify(catalog, null, 2)}\n`);

const cs10 = catalog.bottles.filter((b) => b.bottleKey === "ardbeg::cask-strength-10").length;
const smws = catalog.bottles.filter((b) => b.bottleKey.startsWith("smws::1.246")).length;

console.log(
  JSON.stringify(
    {
      source,
      importedAt: catalog.importedAt,
      bottles: catalog.bottles.length,
      graveyard: catalog.graveyard.length,
      cs10,
      smws1246: smws,
      wrote: dest,
      backup: fs.existsSync(backup) ? backup : null,
    },
    null,
    2,
  ),
);
