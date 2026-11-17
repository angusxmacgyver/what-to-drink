import { describe, expect, it } from "vitest";
import type { WheelFamily } from "../types";
import { wheelReport, wheelReportSummary, type SheetBottle, type WheelGlossary } from "./wheelReport";

const wheel: WheelFamily[] = [
  {
    name: "Fruity",
    color: "Orange",
    subgroups: [
      { name: "Citric", descriptors: ["orange", "lemon zest"] },
      { name: "Dried Fruit", descriptors: ["raisin"] },
    ],
  },
  { name: "Peaty", color: "Green", subgroups: [{ name: "Medicinal", descriptors: ["iodine"] }] },
];

function glossaryOf(families: WheelFamily[], familyRows = families.map(({ name, color }) => ({ name, color }))): WheelGlossary {
  return { wheel: families, familyRows };
}

function bottleOn(sheet: string, bottling: string, families: string[], subgroups: string[], descriptors: string[]): SheetBottle {
  return {
    sheet,
    bottle: { distillery: "Ardbeg", bottling, wheelFamilies: families, wheelSubgroups: subgroups, wheelDescriptors: descriptors },
  };
}

const reported = (glossary: WheelGlossary | null, bottles: SheetBottle[]) =>
  wheelReport(glossary, bottles).map((finding) => [finding.kind, finding.text]);

describe("wheelReport", () => {
  it("reports nothing for a clean wheel and bottles whose terms all fit it", () => {
    const bottles = [bottleOn("Open Bottles", "10", ["fruity"], ["CITRIC"], ["Orange"]), bottleOn("SMWS", "Blank", [], [], [])];
    expect(wheelReport(glossaryOf(wheel), bottles)).toEqual([]);
    expect(wheelReportSummary([])).toBe("Wheel report: everything in the workbook fits the Flavor Wheel.");
  });

  it("reports a missing Wheel Glossary, and nothing about the bottles it could not check", () => {
    expect(reported(null, [bottleOn("Open Bottles", "10", ["Fruity"], [], [])])).toEqual([
      [
        "missing-tab",
        "Missing tab: no Wheel Glossary tab with a Family header row was found, so no bottle's Flavor Wheel terms were checked.",
      ],
    ]);
  });

  it("reports a Subgroup or Descriptor listed twice in the Wheel Glossary, with where each is listed", () => {
    const twice: WheelFamily[] = [
      {
        name: "Fruity",
        color: "Orange",
        subgroups: [
          { name: "Citric", descriptors: ["orange"] },
          { name: "Dried Fruit", descriptors: ["Orange", "raisin"] },
          { name: "Dried Fruit", descriptors: [] },
        ],
      },
      { name: "Peaty", color: "Green", subgroups: [{ name: "citric", descriptors: [] }] },
    ];
    expect(reported(glossaryOf(twice), [])).toEqual([
      ["duplicate", 'Duplicate in the Wheel Glossary: Subgroup "Citric" is listed under Fruity and Peaty.'],
      ["duplicate", 'Duplicate in the Wheel Glossary: Subgroup "Dried Fruit" is listed twice under Fruity.'],
      ["duplicate", 'Duplicate in the Wheel Glossary: Descriptor "orange" is listed under Citric and Dried Fruit.'],
    ]);
  });

  it("reports a Family whose color is blank or not one of the 8", () => {
    const off: WheelFamily[] = [
      { name: "Fruity", color: "Pink", subgroups: [] },
      { name: "Peaty", color: " ", subgroups: [] },
      { name: "Winey", color: "red", subgroups: [] },
    ];
    expect(reported(glossaryOf(off), [])).toEqual([
      ["unknown-color", 'Unknown color in the Wheel Glossary: Family "Fruity" has color "Pink".'],
      ["unknown-color", 'Unknown color in the Wheel Glossary: Family "Peaty" has no color.'],
    ]);
  });

  it("reports a Family given two colors, or written two ways, across its Wheel Glossary rows", () => {
    const rows = [
      { name: "Fruity", color: "Orange" },
      { name: "Fruity", color: "" },
      { name: "fruity", color: "orange" },
      { name: "Peaty", color: "Green" },
      { name: "Peaty", color: "Red" },
    ];
    expect(reported(glossaryOf(wheel, rows), [])).toEqual([
      ["family-spelling", 'Family written differently in the Wheel Glossary: "Fruity" and "fruity".'],
      ["color-conflict", 'Conflicting colors in the Wheel Glossary: Family "Peaty" is given Green and Red.'],
    ]);
  });

  it("reports each bottle term that matches no wheel term, with its sheet and bottle", () => {
    expect(reported(glossaryOf(wheel), [bottleOn("Open Bottles", "10", ["Smoky"], ["Citrus"], ["raisins"])])).toEqual([
      ["stray", 'Stray term on Open Bottles, Ardbeg 10: Family "Smoky" is not in the Wheel Glossary.'],
      ["stray", 'Stray term on Open Bottles, Ardbeg 10: Subgroup "Citrus" is not in the Wheel Glossary.'],
      ["stray", 'Stray term on Open Bottles, Ardbeg 10: Descriptor "raisins" is not in the Wheel Glossary.'],
    ]);
  });

  it("reports a Descriptor without its Subgroup, or a Subgroup without its Family, on the bottle", () => {
    const bottle = bottleOn("Fallen soldiers", "Uigeadail", ["Peaty"], ["Citric", "Medicinal"], ["iodine", "raisin"]);
    expect(reported(glossaryOf(wheel), [bottle])).toEqual([
      ["missing-parent", 'Missing parent on Fallen soldiers, Ardbeg Uigeadail: Subgroup "Citric" has no Fruity Family on the bottle.'],
      ["missing-parent", 'Missing parent on Fallen soldiers, Ardbeg Uigeadail: Descriptor "raisin" has no Dried Fruit Subgroup on the bottle.'],
    ]);
  });

  it("accepts any of a duplicated term's parents on the bottle", () => {
    const shared: WheelFamily[] = [
      { name: "Fruity", color: "Orange", subgroups: [{ name: "Citric", descriptors: ["orange"] }] },
      { name: "Peaty", color: "Green", subgroups: [{ name: "Medicinal", descriptors: ["orange"] }, { name: "Citric", descriptors: [] }] },
    ];
    const findings = wheelReport(glossaryOf(shared), [bottleOn("SMWS", "33.1", ["Peaty"], ["Citric", "Medicinal"], ["orange"])]);
    expect(findings.map((finding) => finding.kind)).toEqual(["duplicate", "duplicate"]);
  });

  it("sums up a report with findings without ever standing in the way of an import", () => {
    const findings = wheelReport(glossaryOf(wheel), [bottleOn("SMWS", "33.1", [], [], ["raisins"])]);
    expect(wheelReportSummary(findings)).toBe("Wheel report: 1 finding. Nothing is blocked.");
  });
});
