import type { Age, Bottle, BottleStatus, Catalog, SmwsExtras } from "../types";
import { countryFromRegion, normalizeTheme } from "./normalize";
import * as XLSX from "xlsx";

const SKIP_SHEETS = new Set(["draft participants"]);

function slug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const match = Object.keys(row).find((k) => k.trim().toLowerCase() === key.trim().toLowerCase());
    if (match != null && row[match] != null && String(row[match]).trim() !== "") {
      return String(row[match]).trim();
    }
  }
  return "";
}

function splitPipes(value: string): string[] {
  if (!value) return [];
  return value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseAge(value: string): Age {
  const v = value.trim();
  if (!v) return null;
  if (/^nas$/i.test(v)) return "NAS";
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseAbv(value: string): number | null {
  const v = value.trim().replace(/%/g, "");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseStatus(value: string, killed: boolean): BottleStatus {
  const v = value.trim().toLowerCase();
  if (killed || v === "killed") return "Killed";
  if (v === "open") return "Open";
  if (v === "closed") return "Closed";
  if (v === "empty") return "empty";
  return killed ? "Killed" : v ? "Closed" : "Closed";
}

function excelDate(value: string): string {
  if (!value) return "";
  if (/[a-z]/i.test(value) && Number.isNaN(Number(value))) return value;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 20000) return value;
  const utc = Date.UTC(1899, 11, 30) + Math.round(n) * 86400000;
  return new Date(utc).toISOString().slice(0, 10);
}

function atApartment(sheetName: string, location: string): boolean {
  if (sheetName.trim().toLowerCase() === "apartment") return true;
  return /\bapartment\b/i.test(location);
}

function bottleKeyFor(distillery: string, bottling: string, smwsCode: string, usaName: string): string {
  if (smwsCode) return `smws::${smwsCode}::${slug(usaName || bottling)}`;
  return `${slug(distillery)}::${slug(bottling)}`;
}

function isEmptyRow(row: Record<string, unknown>): boolean {
  return Object.values(row).every((v) => v == null || String(v).trim() === "");
}

function sheetRows(workbook: XLSX.WorkBook, name: string): Record<string, unknown>[] {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
}

function fromOpenClosed(
  row: Record<string, unknown>,
  sheetName: string,
  id: string,
): Bottle {
  const distillery = cell(row, "Distillery / Producer", "Distillery");
  const bottling = cell(row, "Bottling");
  const location = cell(row, "Location");
  const region = cell(row, "Region");
  return {
    id,
    bottleKey: bottleKeyFor(distillery, bottling, "", ""),
    distillery,
    bottling,
    age: parseAge(cell(row, "Age")),
    abv: parseAbv(cell(row, "ABV %", "ABV")),
    status: parseStatus(cell(row, "Status"), sheetName.toLowerCase().includes("fallen")),
    notes: cell(row, "Notes"),
    tastingNotes: cell(row, "Tasting Notes"),
    location,
    region,
    theme: normalizeTheme(cell(row, "SMWS Theme", "Theme")),
    flavorFamilies: splitPipes(cell(row, "Flavor Families")),
    subCharacteristics: splitPipes(cell(row, "Sub-Characteristics")),
    atApartment: atApartment(sheetName, location),
    country: countryFromRegion(region),
    dateEmptied: excelDate(cell(row, "Date Emptied")),
    smws: null,
  };
}

function fromSmws(row: Record<string, unknown>, id: string): Bottle {
  const distillery = cell(row, "Distillery");
  const usa = cell(row, "Name (USA)");
  const asBottling = cell(row, "Name (Bottling)");
  const fullCode = cell(row, "Full Code");
  const location = cell(row, "Location");
  const region = cell(row, "Region");
  const smwsCask = cell(row, "SMWS Cask");
  const secondary = cell(row, "Secondary Maturation");
  const writtenNotes = cell(row, "Notes");
  const bottling = usa ? [fullCode, usa].filter(Boolean).join(" ") : asBottling || fullCode;
  const extras: SmwsExtras = {
    fullCode,
    distilleryNo: cell(row, "Distillery No."),
    caskNo: cell(row, "Cask No."),
    flavorProfile: cell(row, "Flavor Profile"),
    smwsCask,
    secondaryMaturation: secondary,
    nameIntl: cell(row, "Name (Intl)"),
    vintage: cell(row, "Vintage"),
    smwsUrl: cell(row, "SMWS URL"),
  };
  return {
    id,
    bottleKey: bottleKeyFor(distillery, bottling, fullCode, usa || asBottling),
    distillery,
    bottling,
    age: parseAge(cell(row, "Age")),
    abv: parseAbv(cell(row, "ABV", "ABV %")),
    status: parseStatus(cell(row, "Status"), false),
    notes: writtenNotes || [smwsCask, secondary].filter(Boolean).join(" — "),
    tastingNotes: cell(row, "Tasting Notes"),
    location,
    region,
    theme: normalizeTheme(cell(row, "SMWS Theme", "Theme", "Theme ")),
    flavorFamilies: splitPipes(cell(row, "Flavor Families")),
    subCharacteristics: splitPipes(cell(row, "Sub-Characteristics")),
    atApartment: atApartment("SMWS", location),
    country: countryFromRegion(region),
    dateEmptied: "",
    smws: extras,
  };
}

export function catalogFromWorkbook(workbook: XLSX.WorkBook, now = new Date()): Catalog {
  const bottles: Bottle[] = [];
  const graveyard: Bottle[] = [];

  for (const name of workbook.SheetNames) {
    if (SKIP_SHEETS.has(name.trim().toLowerCase())) continue;
    const rows = sheetRows(workbook, name).filter((row) => !isEmptyRow(row));
    const lower = name.trim().toLowerCase();

    for (const row of rows) {
      const id = globalThis.crypto.randomUUID();
      if (lower === "smws") {
        bottles.push(fromSmws(row, id));
      } else if (lower.includes("fallen")) {
        graveyard.push(fromOpenClosed(row, name, id));
      } else if (lower === "open bottles" || lower === "closed bottles" || lower === "apartment") {
        bottles.push(fromOpenClosed(row, name, id));
      }
    }
  }

  return {
    schemaVersion: 1,
    importedAt: now.toISOString(),
    bottles,
    graveyard,
  };
}

export function catalogFromArrayBuffer(buffer: ArrayBuffer): Catalog {
  const workbook = XLSX.read(buffer, { type: "array" });
  return catalogFromWorkbook(workbook);
}
