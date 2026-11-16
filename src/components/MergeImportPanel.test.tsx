import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as XLSX from "xlsx";
import type { Catalog } from "../types";
import { MergeImportPanel } from "./MergeImportPanel";

const empty: Catalog = { schemaVersion: 1, importedAt: "", bottles: [], graveyard: [], recentlyPoured: [], wheel: [] };

function workbookFile(withGlossary: boolean): File {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet([{ Distillery: "Ardbeg", Bottling: "10", "Wheel Descriptors": "orange" }]),
    "Open Bottles",
  );
  if (withGlossary) {
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        ["Family", "Color", "Wheel Subgroups", "Descriptors"],
        ["Fruity", "Orange", "Citric", "orange"],
      ]),
      "Wheel Glossary",
    );
  }
  const bytes: ArrayBuffer = XLSX.write(book, { type: "array", bookType: "xlsx" });
  return new File([bytes], "cellar.xlsx");
}

async function choose(file: File) {
  const { container } = render(<MergeImportPanel catalog={empty} onConfirm={() => true} />);
  await userEvent.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
  return within(await screen.findByRole("region", { name: "Wheel report" }));
}

afterEach(cleanup);

describe("merge preview Wheel report", () => {
  it("shows what in the chosen workbook does not fit the Flavor Wheel, beside the bottles to add", async () => {
    const report = await choose(workbookFile(true));
    expect(report.getByText("Wheel report: 1 finding. Nothing is blocked.")).toBeTruthy();
    expect(
      report.getByText('Missing parent on Open Bottles, Ardbeg 10: Descriptor "orange" has no Citric Subgroup on the bottle.'),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add 1 bottle" })).toBeTruthy();
  });

  it("reports a workbook without a Wheel Glossary tab and still offers its bottles", async () => {
    const report = await choose(workbookFile(false));
    expect(report.getByText(/^Missing tab: no Wheel Glossary tab/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add 1 bottle" })).toBeTruthy();
  });
});
