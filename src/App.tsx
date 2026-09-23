import { useEffect, useMemo, useState } from "react";
import type { Bottle, Catalog } from "./types";
import { emptyFilters } from "./types";
import seeded from "../data/bottles.json";
import { Library } from "./components/Library";
import { PickADram } from "./components/PickADram";
import { Graveyard } from "./components/Graveyard";
import { ImportPanel } from "./components/ImportPanel";
import { OwnerForm } from "./components/OwnerForm";
import {
  downloadCatalog,
  fetchRemoteCatalog,
  isOwner,
  killBottle,
  loadStoredCatalog,
  ownerPin,
  pushRemoteCatalog,
  saveCatalog,
  setOwner,
  upsertBottle,
} from "./lib/store";

type View = "home" | "library" | "dram" | "graveyard" | "owner";

const seed = seeded as Catalog;

export default function App() {
  const [view, setView] = useState<View>("home");
  const [catalog, setCatalog] = useState<Catalog>(seed);
  const [filters, setFilters] = useState(emptyFilters);
  const [owner, setOwnerState] = useState(false);
  const [editing, setEditing] = useState<Bottle | null | "new">(null);
  const [pin, setPin] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setOwnerState(isOwner());
    const local = loadStoredCatalog();
    if (local?.bottles?.length) {
      setCatalog(local);
      return;
    }
    void fetchRemoteCatalog().then((remote) => {
      if (remote?.bottles?.length) setCatalog(remote);
    });
  }, []);

  const persist = async (next: Catalog) => {
    setCatalog(next);
    saveCatalog(next);
    await pushRemoteCatalog(next);
  };

  const importedLabel = useMemo(() => {
    if (!catalog.importedAt) return "Not imported yet";
    return `Imported ${new Date(catalog.importedAt).toLocaleString()}`;
  }, [catalog.importedAt]);

  return (
    <div className="app">
      <header className="top">
        <button type="button" className="brand" onClick={() => setView("home")}>
          What To Drink
        </button>
        <nav>
          <button type="button" className={view === "library" ? "on" : ""} onClick={() => setView("library")}>
            The Library
          </button>
          <button type="button" className={view === "dram" ? "on" : ""} onClick={() => setView("dram")}>
            Pick a Dram
          </button>
          <button
            type="button"
            className={view === "graveyard" ? "on" : ""}
            onClick={() => setView("graveyard")}
          >
            Graveyard
          </button>
          {owner ? (
            <button type="button" className={view === "owner" ? "on" : ""} onClick={() => setView("owner")}>
              Owner
            </button>
          ) : (
            <button type="button" onClick={() => setView("owner")}>
              Owner login
            </button>
          )}
        </nav>
      </header>

      {notice ? <p className="notice">{notice}</p> : null}

      {view === "home" ? (
        <section className="hero">
          <h1>
            What to drink
            <em> tonight.</em>
          </h1>
          <div className="place">
            <button type="button" onClick={() => setView("library")}>
              The Library
            </button>
            <button type="button" onClick={() => setView("dram")}>
              Pick a Dram
            </button>
          </div>
          <p className="meta">
            {catalog.bottles.length} bottles · {importedLabel}
          </p>
        </section>
      ) : null}

      {view === "library" ? (
        <Library
          bottles={catalog.bottles}
          filters={filters}
          onFilters={setFilters}
          owner={owner}
          onEdit={(b) => {
            setEditing(b);
            setView("owner");
          }}
          onKill={(id) => void persist(killBottle(catalog, id))}
          onOpen={(id) => {
            const bottle = catalog.bottles.find((b) => b.id === id);
            if (!bottle) return;
            void persist(upsertBottle(catalog, { ...bottle, status: "Open" }));
          }}
        />
      ) : null}

      {view === "dram" ? (
        <PickADram bottles={catalog.bottles} filters={filters} onFilters={setFilters} />
      ) : null}

      {view === "graveyard" ? <Graveyard bottles={catalog.graveyard} /> : null}

      {view === "owner" ? (
        <section className="panel">
          <header className="panel-head">
            <div>
              <p className="eyebrow">Gated</p>
              <h1>Owner</h1>
            </div>
            {owner ? (
              <button
                type="button"
                className="textish"
                onClick={() => {
                  setOwner(false);
                  setOwnerState(false);
                }}
              >
                Log out
              </button>
            ) : null}
          </header>
          {!owner ? (
            <form
              className="owner-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (pin === ownerPin()) {
                  setOwner(true);
                  setOwnerState(true);
                  setNotice("");
                } else {
                  setNotice("PIN did not match.");
                }
              }}
            >
              <label>
                Owner PIN
                <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
              </label>
              <button type="submit">Enter</button>
            </form>
          ) : (
            <>
              <p className="meta">{importedLabel}</p>
              <ImportPanel
                onCatalog={(next, filename) => {
                  const previous = catalog;
                  saveCatalog(previous);
                  localStorage.setItem("what-to-drink-catalog-backup", JSON.stringify(previous));
                  void persist(next);
                  downloadCatalog(next);
                  setNotice(`Replaced cellar from ${filename}. Backup kept in the browser; JSON downloaded.`);
                  setView("library");
                }}
              />
              <div className="owner-actions">
                <button type="button" onClick={() => setEditing("new")}>
                  Add bottle
                </button>
                <button type="button" onClick={() => downloadCatalog(catalog)}>
                  Download bottles.json
                </button>
              </div>
              {editing ? (
                <OwnerForm
                  initial={editing === "new" ? undefined : editing}
                  onSave={(bottle) => {
                    void persist(upsertBottle(catalog, bottle));
                    setEditing(null);
                    setView("library");
                    setNotice("Saved to The Library.");
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
