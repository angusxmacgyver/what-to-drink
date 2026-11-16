import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { catalogFromWorkbook } from "./ingest";

function sheet(name: string, rows: Record<string, string>[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
  return workbook;
}

function workbook(sheets: Record<string, Record<string, string>[]>): XLSX.WorkBook {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), name);
  }
  return book;
}

describe("Flavor Wheel import", () => {
  const glossary = (rows: string[][]): XLSX.WorkBook => {
    const book = workbook({ "Open Bottles": [{ Distillery: "Ardbeg", Bottling: "10" }] });
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Wheel Glossary");
    return book;
  };

  it("reads the wheel from the header row down, past the title and notes above it", () => {
    const catalog = catalogFromWorkbook(
      glossary([
        ["Revised Flavor Wheel Glossary"],
        ["Family colors and subgroup names unchanged."],
        [],
        ["Family", "Color", "Wheel Subgroups", "Descriptors"],
        ["Fruity", "Orange", "Citric", "orange | lemon zest|  grapefruit "],
        ["Fruity", "Orange", "Dried Fruit", "raisin"],
        ["Peaty", "Green", "Medicinal", "iodine | TCP"],
        [],
      ]),
    );
    expect(catalog.wheel).toEqual([
      {
        name: "Fruity",
        color: "Orange",
        subgroups: [
          { name: "Citric", descriptors: ["orange", "lemon zest", "grapefruit"] },
          { name: "Dried Fruit", descriptors: ["raisin"] },
        ],
      },
      { name: "Peaty", color: "Green", subgroups: [{ name: "Medicinal", descriptors: ["iodine", "TCP"] }] },
    ]);
  });

  it("never reads the Wheel Glossary as bottles", () => {
    const catalog = catalogFromWorkbook(
      glossary([
        ["Family", "Color", "Wheel Subgroups", "Descriptors"],
        ["Fruity", "Orange", "Citric", "orange"],
      ]),
    );
    expect([...catalog.bottles, ...catalog.graveyard].map((b) => b.bottling)).toEqual(["10"]);
  });

  it("gives a workbook without the tab no wheel", () => {
    expect(catalogFromWorkbook(workbook({ "Open Bottles": [{ Distillery: "Ardbeg", Bottling: "10" }] })).wheel).toEqual([]);
  });
});

describe("bottle wheel terms", () => {
  const terms = {
    "Wheel Families": "Fruity | Peaty",
    "Wheel Subgroups": "citric |Medicinal",
    "Wheel Descriptors": " orange | iodine ",
  };

  it("reads Families, Subgroups, and Descriptors on every bottle sheet, as typed in the workbook", () => {
    const catalog = catalogFromWorkbook(
      workbook({
        "Open Bottles": [{ Distillery: "Ardbeg", Bottling: "Drum", ...terms }],
        "Closed Bottles": [{ Distillery: "Ardbeg", Bottling: "10", ...terms }],
        SMWS: [{ Distillery: "Ardbeg", "Full Code": "33.1", ...terms }],
        Apartment: [{ Distillery: "Ardbeg", Bottling: "An Oa", ...terms }],
        "Fallen soldiers": [{ Distillery: "Ardbeg", Bottling: "Wee Beastie", ...terms }],
      }),
    );
    const all = [...catalog.bottles, ...catalog.graveyard];
    expect(all).toHaveLength(5);
    for (const bottle of all) {
      expect(bottle.wheelFamilies).toEqual(["Fruity", "Peaty"]);
      expect(bottle.wheelSubgroups).toEqual(["citric", "Medicinal"]);
      expect(bottle.wheelDescriptors).toEqual(["orange", "iodine"]);
    }
  });

  it("gives blank columns no terms and never fills in a parent", () => {
    const catalog = catalogFromWorkbook(
      workbook({ "Open Bottles": [{ Distillery: "Ardbeg", Bottling: "10", "Wheel Descriptors": "orange" }] }),
    );
    const [bottle] = catalog.bottles;
    expect(bottle.wheelFamilies).toEqual([]);
    expect(bottle.wheelSubgroups).toEqual([]);
    expect(bottle.wheelDescriptors).toEqual(["orange"]);
  });
});

describe("cask import", () => {
  const casks = { "Primary Cask": "Ex-bourbon | Oloroso sherry", "Secondary Cask": "Rum" };

  it("reads primary and secondary cask on every bottle sheet, in the order written", () => {
    const catalog = catalogFromWorkbook(
      workbook({
        "Open Bottles": [{ Distillery: "Ardbeg", Bottling: "Drum", ...casks }],
        "Closed Bottles": [{ Distillery: "Ardbeg", Bottling: "10", ...casks }],
        SMWS: [{ Distillery: "Ardbeg", "Full Code": "33.1", ...casks }],
        Apartment: [{ Distillery: "Ardbeg", Bottling: "An Oa", ...casks }],
        "Fallen soldiers": [{ Distillery: "Ardbeg", Bottling: "Wee Beastie", ...casks }],
      }),
    );
    const all = [...catalog.bottles, ...catalog.graveyard];
    expect(all).toHaveLength(5);
    for (const bottle of all) {
      expect(bottle.primaryCask).toEqual(["Ex-bourbon", "Oloroso sherry"]);
      expect(bottle.secondaryCask).toEqual(["Rum"]);
    }
  });

  it("gives blank cells no casks, keeps a lone secondary cask, and keeps tags as typed", () => {
    const catalog = catalogFromWorkbook(
      workbook({
        "Open Bottles": [
          { Distillery: "Ardbeg", Bottling: "10", "Primary Cask": "", "Secondary Cask": "" },
          { Distillery: "Ardbeg", Bottling: "Drum", "Primary Cask": "", "Secondary Cask": " PX sherry |  | ex-Bourbon " },
        ],
      }),
    );
    const [blank, lone] = catalog.bottles;
    expect(blank.primaryCask).toEqual([]);
    expect(blank.secondaryCask).toEqual([]);
    expect(lone.primaryCask).toEqual([]);
    expect(lone.secondaryCask).toEqual(["PX sherry", "ex-Bourbon"]);
  });

  it("leaves a Society bottle's SMWS cask and secondary maturation as before", () => {
    const catalog = catalogFromWorkbook(
      sheet("SMWS", [
        {
          Distillery: "Glenfarclas",
          "Full Code": "1.246",
          "SMWS Cask": "Second-fill barrel",
          "Secondary Maturation": "Oloroso hogshead",
        },
      ]),
    );
    const [bottle] = catalog.bottles;
    expect(bottle.smws?.smwsCask).toBe("Second-fill barrel");
    expect(bottle.smws?.secondaryMaturation).toBe("Oloroso hogshead");
    expect(bottle.notes).toBe("Second-fill barrel — Oloroso hogshead");
    expect(bottle.primaryCask).toEqual([]);
    expect(bottle.secondaryCask).toEqual([]);
  });
});

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

  it("reads Distillery / Producer and the combined Bottling name", () => {
    const catalog = catalogFromWorkbook(
      sheet("SMWS", [
        {
          "Distillery / Producer": "Glenfarclas",
          Bottling: "1.278 - Fruitberg! Dead ahead!",
          "Full Code": "1.278",
          Age: "9",
          "ABV %": "59.9",
          Region: "Speyside, Spey",
        },
      ]),
    );
    const [bottle] = catalog.bottles;
    expect(bottle.distillery).toBe("Glenfarclas");
    expect(bottle.bottling).toBe("1.278 - Fruitberg! Dead ahead!");
    expect(bottle.bottleKey).toBe("smws::1.278::1-278-fruitberg-dead-ahead");
    expect(bottle.age).toBe(9);
    expect(bottle.abv).toBe(59.9);
    expect(bottle.smws?.fullCode).toBe("1.278");
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
