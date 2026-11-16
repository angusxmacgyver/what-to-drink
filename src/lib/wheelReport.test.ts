import { describe, expect, it } from "vitest";
import type { WheelFamily } from "../types";
import { describeWheelReport, wheelReport, type SheetBottle } from "./wheelReport";

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

function on(sheet: string, bottling: string, families: string[], subgroups: string[], descriptors: string[]): SheetBottle {
  return {
    sheet,
    bottle: { distillery: "Ardbeg", bottling, wheelFamilies: families, wheelSubgroups: subgroups, wheelDescriptors: descriptors },
  };
}

const texts = (wheelFamilies: WheelFamily[] | null, bottles: SheetBottle[]) =>
  wheelReport(wheelFamilies, bottles).map((finding) => [finding.kind, finding.text]);

describe("wheelReport", () => {
  it("reports nothing for a clean wheel and bottles whose terms all fit it", () => {
    expect(wheelReport(wheel, [on("Open Bottles", "10", ["fruity"], ["CITRIC"], ["Orange"]), on("SMWS", "Blank", [], [], [])])).toEqual([]);
    expect(describeWheelReport([])).toEqual(["Wheel report: everything in the workbook fits the Flavor Wheel."]);
  });

  it("reports a missing Wheel Glossary tab, and nothing about the bottles it could not check", () => {
    expect(texts(null, [on("Open Bottles", "10", ["Fruity"], [], [])])).toEqual([
      ["missing-tab", "Missing tab: no Wheel Glossary tab was found, so no bottle's Flavor Wheel terms were checked."],
    ]);
  });

  it("reports a Subgroup or Descriptor listed twice in the Wheel Glossary, with where each is listed", () => {
    const twice: WheelFamily[] = [
      { name: "Fruity", color: "Orange", subgroups: [{ name: "Citric", descriptors: ["orange"] }, { name: "Dried Fruit", descriptors: ["Orange"] }] },
      { name: "Peaty", color: "Green", subgroups: [{ name: "citric", descriptors: [] }] },
    ];
    expect(texts(twice, [])).toEqual([
      ["duplicate", 'Duplicate in the Wheel Glossary: Subgroup "Citric" is listed under Fruity and Peaty.'],
      ["duplicate", 'Duplicate in the Wheel Glossary: Descriptor "orange" is listed under Citric and Dried Fruit.'],
    ]);
  });

  it("reports a Family whose color is blank or not one of the 8", () => {
    const off: WheelFamily[] = [
      { name: "Fruity", color: "Pink", subgroups: [] },
      { name: "Peaty", color: " ", subgroups: [] },
      { name: "Winey", color: "red", subgroups: [] },
    ];
    expect(texts(off, [])).toEqual([
      ["unknown-color", 'Unknown color in the Wheel Glossary: Family "Fruity" has color "Pink".'],
      ["unknown-color", 'Unknown color in the Wheel Glossary: Family "Peaty" has no color.'],
    ]);
  });

  it("reports each bottle term that matches no wheel term, with its sheet and bottle", () => {
    expect(texts(wheel, [on("Open Bottles", "10", ["Smoky"], ["Citrus"], ["raisins"])])).toEqual([
      ["stray", 'Stray term on Open Bottles, Ardbeg 10: Family "Smoky" is not in the Wheel Glossary.'],
      ["stray", 'Stray term on Open Bottles, Ardbeg 10: Subgroup "Citrus" is not in the Wheel Glossary.'],
      ["stray", 'Stray term on Open Bottles, Ardbeg 10: Descriptor "raisins" is not in the Wheel Glossary.'],
    ]);
  });

  it("reports a Descriptor without its Subgroup, or a Subgroup without its Family, on the bottle", () => {
    expect(texts(wheel, [on("Fallen soldiers", "Uigeadail", ["Peaty"], ["Citric", "Medicinal"], ["iodine", "raisin"])])).toEqual([
      ["missing-parent", 'Missing parent on Fallen soldiers, Ardbeg Uigeadail: Subgroup "Citric" has no Fruity Family on the bottle.'],
      ["missing-parent", 'Missing parent on Fallen soldiers, Ardbeg Uigeadail: Descriptor "raisin" has no Dried Fruit Subgroup on the bottle.'],
    ]);
  });

  it("lists each finding on its own line, and never stands in the way of an import", () => {
    const findings = wheelReport(wheel, [on("SMWS", "33.1", [], [], ["raisins"])]);
    expect(describeWheelReport(findings)).toEqual([
      "Wheel report: 1 finding. Nothing is blocked.",
      'Stray term on SMWS, Ardbeg 33.1: Descriptor "raisins" is not in the Wheel Glossary.',
    ]);
  });
});
