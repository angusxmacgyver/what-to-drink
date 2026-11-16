import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { importWorkbook } from "../src/lib/ingest.ts";
import { wheelReportSummary } from "../src/lib/wheelReport.ts";

const DEFAULT_XLSX =
  "/Users/max.krueger/Library/CloudStorage/OneDrive-WarnerBros.Discovery/Desktop/Whisky Inventory- Oct 7 .xlsx";

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
const { catalog, report } = importWorkbook(workbook);
fs.writeFileSync(dest, `${JSON.stringify(catalog, null, 2)}\n`);

const subgroups = catalog.wheel.flatMap((f) => f.subgroups);
const cs10 = catalog.bottles.filter((b) => b.bottleKey === "ardbeg::cask-strength-10").length;
const smws = catalog.bottles.filter((b) => b.bottleKey.startsWith("smws::1.246")).length;

console.log(
  JSON.stringify(
    {
      source,
      importedAt: catalog.importedAt,
      bottles: catalog.bottles.length,
      graveyard: catalog.graveyard.length,
      wheel: {
        families: catalog.wheel.length,
        subgroups: subgroups.length,
        descriptors: subgroups.flatMap((s) => s.descriptors).length,
      },
      cs10,
      smws1246: smws,
      wrote: dest,
      backup: fs.existsSync(backup) ? backup : null,
    },
    null,
    2,
  ),
);
console.log(["", wheelReportSummary(report), ...report.map((finding) => finding.text)].join("\n"));
