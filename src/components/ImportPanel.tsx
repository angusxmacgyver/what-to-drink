import type { Catalog } from "../types";

export function ImportPanel({
  onCatalog,
}: {
  onCatalog: (catalog: Catalog, filename: string) => void;
}) {
  return (
    <section className="owner-box">
      <h2>Import workbook</h2>
      <p className="hint">
        Open, Closed, and SMWS map automatically. Draft Participants are skipped. This replaces the
        live cellar and keeps one backup in the browser (and via Download JSON).
      </p>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const { catalogFromArrayBuffer } = await import("../lib/ingest");
          const buffer = await file.arrayBuffer();
          onCatalog(catalogFromArrayBuffer(buffer), file.name);
          e.target.value = "";
        }}
      />
    </section>
  );
}
