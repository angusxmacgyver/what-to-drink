import { useState } from "react";
import type { Catalog } from "../types";
import { catalogFromDocument } from "../lib/store";

export function ImportPanel({
  onCatalog,
}: {
  onCatalog: (catalog: Catalog, filename: string) => void;
}) {
  const [error, setError] = useState("");

  return (
    <section className="owner-box">
      <h2>Replace the cellar</h2>
      <p className="hint">
        From a workbook (Open, Closed, and SMWS map automatically; Draft Participants are skipped) or a
        downloaded bottles.json, which restores each bottle onto its own id with its drams, last third, kill
        shot, and Recently poured. This replaces the live cellar and keeps one backup in the browser (and via
        Download JSON).
      </p>
      <input
        type="file"
        accept=".xlsx,.xls,.csv,.json"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          e.target.value = "";
          setError("");
          if (file.name.toLowerCase().endsWith(".json")) {
            try {
              onCatalog(catalogFromDocument(await file.text()), file.name);
            } catch {
              setError(`${file.name} is not a bottles.json catalog. Nothing was replaced.`);
            }
            return;
          }
          const { catalogFromArrayBuffer } = await import("../lib/ingest");
          onCatalog(catalogFromArrayBuffer(await file.arrayBuffer()), file.name);
        }}
      />
      {error ? <p className="hint">{error}</p> : null}
    </section>
  );
}
