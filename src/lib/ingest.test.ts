import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { catalogFromWorkbook } from "./ingest";

function sheet(name: string, rows: Record<string, string>[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
  return workbook;
}

describe("Society import", () => {
  it("accepts the SMWS Theme header while retaining the legacy Theme header", () => {
    const modern = catalogFromWorkbook(
      sheet("SMWS", [{ Distillery: "Ardbeg", "Full Code": "33.1", "SMWS Theme": "Bold & Peaty" }]),
    );
    const legacy = catalogFromWorkbook(
      sheet("Open Bottles", [{ Distillery: "Ardbeg", Bottling: "10", Theme: "Heavily Peated" }]),
    );

    expect(modern.bottles[0].theme).toBe("Bold & Peaty");
    expect(legacy.bottles[0].theme).toBe("Heavily Peated");
  });

  it("uses Name (Bottling) as the expression, including the written notes", () => {
    const catalog = catalogFromWorkbook(
      sheet("SMWS", [
        {
          Distillery: "Glenfarclas",
          "Name (Bottling)": "1.246 - A one like no other",
          "Full Code": "1.246",
          Age: "8",
          ABV: "64",
          Status: "open",
          Notes: "Matured full-term in a second-fill barrel.",
          "SMWS Cask": "Second-fill barrel",
          Region: "Speyside, Spey",
        },
      ]),
      new Date("2026-10-07T00:00:00Z"),
    );
    const [bottle] = catalog.bottles;
    expect(bottle.bottling).toBe("1.246 - A one like no other");
    expect(bottle.bottleKey).toBe("smws::1.246::1-246-a-one-like-no-other");
    expect(bottle.notes).toBe("Matured full-term in a second-fill barrel.");
    expect(bottle.distillery).toBe("Glenfarclas");
  });

  it("still joins Full Code and Name (USA) on the older column", () => {
    const catalog = catalogFromWorkbook(
      sheet("SMWS", [
        {
          Distillery: "Glenfarclas",
          "Name (USA)": "A one like no other",
          "Full Code": "1.246",
          Status: "Open",
          "SMWS Cask": "Second-fill barrel",
          "Secondary Maturation": "Single cask",
        },
      ]),
    );
    const [bottle] = catalog.bottles;
    expect(bottle.bottling).toBe("1.246 A one like no other");
    expect(bottle.bottleKey).toBe("smws::1.246::a-one-like-no-other");
    expect(bottle.notes).toBe("Second-fill barrel — Single cask");
  });
});
