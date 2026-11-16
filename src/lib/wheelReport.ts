import type { Bottle, WheelFamily } from "../types";
import { isWheelColor } from "./colors";
import { placeTerm, type WheelLevel } from "./wheel";

export type SheetBottle = {
  sheet: string;
  bottle: Pick<Bottle, "distillery" | "bottling" | "wheelFamilies" | "wheelSubgroups" | "wheelDescriptors">;
};

export type WheelFinding = {
  kind: "missing-tab" | "duplicate" | "unknown-color" | "stray" | "missing-parent";
  text: string;
};

const LEVEL_NAMES: Record<WheelLevel, string> = { family: "Family", subgroup: "Subgroup", descriptor: "Descriptor" };

const sameTerm = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function duplicates(level: WheelLevel, listed: { term: string; under: string }[]): WheelFinding[] {
  const groups = new Map<string, { term: string; under: string[] }>();
  for (const { term, under } of listed) {
    const key = term.trim().toLowerCase();
    const group = groups.get(key);
    if (group) group.under.push(under);
    else groups.set(key, { term, under: [under] });
  }
  return [...groups.values()]
    .filter((group) => group.under.length > 1)
    .map(({ term, under }) => ({
      kind: "duplicate",
      text: `Duplicate in the Wheel Glossary: ${LEVEL_NAMES[level]} "${term}" is listed under ${under.join(" and ")}.`,
    }));
}

function parentOf(wheel: WheelFamily[], level: WheelLevel, term: string): string | null {
  if (level === "subgroup") return placeTerm(wheel, level, term).family;
  if (level === "descriptor") {
    const subgroups = wheel.flatMap((family) => family.subgroups);
    return subgroups.find((subgroup) => subgroup.descriptors.some((d) => sameTerm(d, term)))?.name ?? null;
  }
  return null;
}

function bottleFindings(wheel: WheelFamily[], { sheet, bottle }: SheetBottle): WheelFinding[] {
  const where = `${sheet}, ${bottle.distillery} ${bottle.bottling}`;
  const levels: [WheelLevel, string[], string[]][] = [
    ["family", bottle.wheelFamilies, []],
    ["subgroup", bottle.wheelSubgroups, bottle.wheelFamilies],
    ["descriptor", bottle.wheelDescriptors, bottle.wheelSubgroups],
  ];
  const findings: WheelFinding[] = [];
  for (const [level, terms, parents] of levels) {
    const name = LEVEL_NAMES[level];
    for (const term of terms) {
      if (placeTerm(wheel, level, term).family === null) {
        findings.push({ kind: "stray", text: `Stray term on ${where}: ${name} "${term}" is not in the Wheel Glossary.` });
        continue;
      }
      const parent = parentOf(wheel, level, term);
      if (parent && !parents.some((listed) => sameTerm(listed, parent))) {
        const parentLevel = level === "subgroup" ? "Family" : "Subgroup";
        findings.push({
          kind: "missing-parent",
          text: `Missing parent on ${where}: ${name} "${term}" has no ${parent} ${parentLevel} on the bottle.`,
        });
      }
    }
  }
  return findings;
}

/** Everything in a workbook that does not fit its Flavor Wheel. A wheel of null means the workbook had no Wheel Glossary tab. */
export function wheelReport(wheel: WheelFamily[] | null, bottles: SheetBottle[]): WheelFinding[] {
  if (wheel === null) {
    return [
      {
        kind: "missing-tab",
        text: "Missing tab: no Wheel Glossary tab was found, so no bottle's Flavor Wheel terms were checked.",
      },
    ];
  }
  const subgroups = wheel.flatMap((family) => family.subgroups.map((s) => ({ term: s.name, under: family.name })));
  const descriptors = wheel.flatMap((family) =>
    family.subgroups.flatMap((s) => s.descriptors.map((term) => ({ term, under: s.name }))),
  );
  const colors: WheelFinding[] = wheel
    .filter((family) => !isWheelColor(family.color))
    .map((family) => ({
      kind: "unknown-color",
      text: `Unknown color in the Wheel Glossary: Family "${family.name}" ${
        family.color.trim() ? `has color "${family.color}"` : "has no color"
      }.`,
    }));
  return [
    ...duplicates("subgroup", subgroups),
    ...duplicates("descriptor", descriptors),
    ...colors,
    ...bottles.flatMap((entry) => bottleFindings(wheel, entry)),
  ];
}

export function describeWheelReport(findings: WheelFinding[]): string[] {
  if (!findings.length) return ["Wheel report: everything in the workbook fits the Flavor Wheel."];
  const count = `${findings.length} finding${findings.length === 1 ? "" : "s"}`;
  return [`Wheel report: ${count}. Nothing is blocked.`, ...findings.map((finding) => finding.text)];
}
