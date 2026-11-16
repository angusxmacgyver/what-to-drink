import { useState } from "react";
import type { Bottle, Catalog, WheelFamily } from "../types";
import { planMerge } from "../lib/merge";
import type { MergeRow } from "../lib/merge";
import { wheelReportSummary, type WheelFinding } from "../lib/wheelReport";

export function MergeImportPanel({
  catalog,
  onConfirm,
}: {
  catalog: Catalog;
  onConfirm: (bottles: Bottle[], wheel: WheelFamily[] | null) => boolean | Promise<boolean>;
}) {
  const [rows, setRows] = useState<MergeRow[] | null>(null);
  const [report, setReport] = useState<WheelFinding[]>([]);
  const [wheel, setWheel] = useState<WheelFamily[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const reset = () => {
    setRows(null);
    setReport([]);
    setWheel(null);
    setSelected(new Set());
  };

  const toggle = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <section className="owner-box">
      <h2>Add bottles from a workbook</h2>
      <p className="hint">
        Adds new bottles without touching the existing cellar. Nothing is saved until you confirm below.
      </p>
      {!rows ? (
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const { importArrayBuffer } = await import("../lib/ingest");
            const buffer = await file.arrayBuffer();
            const imported = importArrayBuffer(buffer);
            const plan = planMerge(catalog.bottles, imported.catalog.bottles);
            setRows(plan);
            setReport(imported.report);
            setWheel(imported.wheel);
            setSelected(new Set(plan.filter((r) => !r.duplicateOf).map((r) => r.bottle.id)));
            e.target.value = "";
          }}
        />
      ) : (
        <>
          <section className="notice wheel-report" aria-label="Wheel report">
            <p>{wheelReportSummary(report)}</p>
            {report.length ? (
              <ul>
                {report.map((finding, index) => (
                  <li key={index}>{finding.text}</li>
                ))}
              </ul>
            ) : null}
          </section>
          {rows.length === 0 ? <p className="hint">No bottles found in that file.</p> : null}
          <ul className="merge-preview">
            {rows.map((row) => (
              <li key={row.bottle.id} className={row.duplicateOf ? "duplicate" : ""}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.has(row.bottle.id)}
                    onChange={(e) => toggle(row.bottle.id, e.target.checked)}
                  />
                  <strong>{row.bottle.distillery}</strong> <em>{row.bottle.bottling}</em>
                  {row.duplicateOf ? (
                    <span className="hint">
                      {" "}
                      — matches existing {row.duplicateOf.distillery} {row.duplicateOf.bottling}
                    </span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
          <div className="owner-actions">
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => {
                const bottles = rows.filter((r) => selected.has(r.bottle.id)).map((r) => r.bottle);
                void Promise.resolve(onConfirm(bottles, wheel)).then((ok) => {
                  if (ok) reset();
                });
              }}
            >
              Add {selected.size} bottle{selected.size === 1 ? "" : "s"}
            </button>
            <button type="button" onClick={reset}>
              Cancel
            </button>
          </div>
        </>
      )}
    </section>
  );
}
