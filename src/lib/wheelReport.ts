import type { Bottle, WheelFamily } from "../types";
import { isWheelColor } from "./colors";
import { parentsOf, placeTerm, sameTerm, type WheelLevel } from "./wheel";

/** The wheel as read from the Wheel Glossary, with each row's Family as written there. */
export type WheelGlossary = { wheel: WheelFamily[]; familyRows: { name: string; color: string }[] };

export type SheetBottle = {
  sheet: string;
  bottle: Pick<Bottle, "distillery" | "bottling" | "wheelFamilies" | "wheelSubgroups" | "wheelDescriptors">;
};

export type WheelFinding = {
  kind: "missing-tab" | "duplicate" | "family-spelling" | "color-conflict" | "unknown-color" | "stray" | "missing-parent";
  text: string;
};

const LEVELS: Record<WheelLevel, { name: string; parent: string }> = {
  family: { name: "Family", parent: "" },
  subgroup: { name: "Subgroup", parent: "Family" },
  descriptor: { name: "Descriptor", parent: "Subgroup" },
};

function groupBy<T>(items: T[], term: (item: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = term(item).trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()];
}

const distinct = (values: string[]) => groupBy(values, (value) => value).map(([first]) => first);

function duplicates(level: WheelLevel, listed: { term: string; under: string }[]): WheelFinding[] {
  return groupBy(listed, (entry) => entry.term)
    .filter((group) => group.length > 1)
    .map((group) => {
      const under = distinct(group.map((entry) => entry.under));
      const where = under.length === 1 ? `twice under ${under[0]}` : `under ${under.join(" and ")}`;
      return {
        kind: "duplicate",
        text: `Duplicate in the Wheel Glossary: ${LEVELS[level].name} "${group[0].term}" is listed ${where}.`,
      };
    });
}

function familyFindings({ wheel, familyRows }: WheelGlossary): WheelFinding[] {
  const findings: WheelFinding[] = [];
  for (const rows of groupBy(familyRows, (row) => row.name)) {
    const spellings = [...new Set(rows.map((row) => row.name.trim()))];
    if (spellings.length > 1) {
      const written = spellings.map((name) => `"${name}"`).join(" and ");
      findings.push({ kind: "family-spelling", text: `Family written differently in the Wheel Glossary: ${written}.` });
    }
    const colors = distinct(rows.map((row) => row.color.trim()).filter(Boolean));
    if (colors.length > 1) {
      findings.push({
        kind: "color-conflict",
        text: `Conflicting colors in the Wheel Glossary: Family "${rows[0].name}" is given ${colors.join(" and ")}.`,
      });
    }
  }
  for (const family of wheel.filter((f) => !isWheelColor(f.color))) {
    const color = family.color.trim() ? `has color "${family.color}"` : "has no color";
    findings.push({ kind: "unknown-color", text: `Unknown color in the Wheel Glossary: Family "${family.name}" ${color}.` });
  }
  return findings;
}

function bottleFindings(wheel: WheelFamily[], { sheet, bottle }: SheetBottle): WheelFinding[] {
  const where = `${sheet}, ${bottle.distillery} ${bottle.bottling}`;
  const levels: [WheelLevel, string[], string[]][] = [
    ["family", bottle.wheelFamilies, []],
    ["subgroup", bottle.wheelSubgroups, bottle.wheelFamilies],
    ["descriptor", bottle.wheelDescriptors, bottle.wheelSubgroups],
  ];
  const findings: WheelFinding[] = [];
  for (const [level, terms, onBottle] of levels) {
    const { name, parent } = LEVELS[level];
    for (const term of terms) {
      if (placeTerm(wheel, level, term).family === null) {
        findings.push({ kind: "stray", text: `Stray term on ${where}: ${name} "${term}" is not in the Wheel Glossary.` });
        continue;
      }
      const parents = parentsOf(wheel, level, term);
      if (parents.length && !parents.some((p) => onBottle.some((listed) => sameTerm(listed, p)))) {
        findings.push({
          kind: "missing-parent",
          text: `Missing parent on ${where}: ${name} "${term}" has no ${parents[0]} ${parent} on the bottle.`,
        });
      }
    }
  }
  return findings;
}

/** A glossary of null means the workbook had no Wheel Glossary to read. */
export function wheelReport(glossary: WheelGlossary | null, bottles: SheetBottle[]): WheelFinding[] {
  if (glossary === null) {
    return [
      {
        kind: "missing-tab",
        text: "Missing tab: no Wheel Glossary tab with a Family header row was found, so no bottle's Flavor Wheel terms were checked.",
      },
    ];
  }
  const { wheel } = glossary;
  const subgroups = wheel.flatMap((family) => family.subgroups.map((s) => ({ term: s.name, under: family.name })));
  const descriptors = wheel.flatMap((family) =>
    family.subgroups.flatMap((s) => s.descriptors.map((term) => ({ term, under: s.name }))),
  );
  return [
    ...duplicates("subgroup", subgroups),
    ...duplicates("descriptor", descriptors),
    ...familyFindings(glossary),
    ...bottles.flatMap((entry) => bottleFindings(wheel, entry)),
  ];
}

export function wheelReportSummary(findings: WheelFinding[]): string {
  if (!findings.length) return "Wheel report: everything in the workbook fits the Flavor Wheel.";
  return `Wheel report: ${findings.length} finding${findings.length === 1 ? "" : "s"}. Nothing is blocked.`;
}
