import { useEffect, useMemo, useState } from "react";
import type { Bottle, Catalog } from "./types";
import { emptyFilters } from "./types";
import seeded from "../data/bottles.json";
import { Library } from "./components/Library";
import { PickADram } from "./components/PickADram";
import { Graveyard } from "./components/Graveyard";
import { Analytics } from "./components/Analytics";
import { ImportPanel } from "./components/ImportPanel";
import { MergeImportPanel } from "./components/MergeImportPanel";
import { OwnerForm } from "./components/OwnerForm";
import { applyMerge } from "./lib/merge";
import {
  addBottles,
  downloadCatalog,
  fetchRemoteCatalog,
  isOwner,
  killBottle,
  loadStoredCatalog,
  loadTheme,
  replaceCatalog,
  saveBottle,
  saveCatalog,
  saveTheme,
  setOwner,
  unlockOwner,
  upsertBottle,
} from "./lib/store";
import type { Theme } from "./lib/store";

type View = "home" | "library" | "dram" | "graveyard" | "analytics" | "owner";

const seed = seeded as Catalog;

export default function App() {
  const [view, setView] = useState<View>("home");
  const [catalog, setCatalog] = useState<Catalog>(seed);
  const [filters, setFilters] = useState(emptyFilters);
  const [owner, setOwnerState] = useState(false);
  const [editing, setEditing] = useState<Bottle | null | "new">(null);
  const [pin, setPin] = useState("");
  const [notice, setNotice] = useState("");
  const [theme, setTheme] = useState<Theme>(() => loadTheme());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    setOwnerState(isOwner());
    const local = loadStoredCatalog();
    if (local?.bottles?.length) setCatalog(local);
    void fetchRemoteCatalog().then((remote) => {
      if (remote) setCatalog(remote);
    });
  }, []);

  const persist = async (next: Catalog, write: Promise<boolean>) => {
    setCatalog(next);
    saveCatalog(next);
    if (!(await write)) setNotice("Saved on this device only. The cellar server did not accept the change.");
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
        <div className="top-right">
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
            <button
              type="button"
              className={view === "analytics" ? "on" : ""}
              onClick={() => setView("analytics")}
            >
              Analytics
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
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
              </svg>
            )}
          </button>
        </div>
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
          onKill={(id) => {
            const next = killBottle(catalog, id);
            const killed = next.graveyard.find((b) => b.id === id);
            if (killed) void persist(next, saveBottle(killed));
          }}
          onOpen={(id) => {
            const bottle = catalog.bottles.find((b) => b.id === id);
            if (!bottle) return;
            const opened = { ...bottle, status: "Open" as const };
            void persist(upsertBottle(catalog, opened), saveBottle(opened));
          }}
        />
      ) : null}

      {view === "dram" ? (
        <PickADram bottles={catalog.bottles} filters={filters} onFilters={setFilters} />
      ) : null}

      {view === "graveyard" ? <Graveyard bottles={catalog.graveyard} /> : null}

      {view === "analytics" ? <Analytics catalog={catalog} /> : null}

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
                void unlockOwner(pin).then((ok) => {
                  if (ok) {
                    setOwnerState(true);
                    setNotice("");
                  } else {
                    setNotice("PIN did not match.");
                  }
                });
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
                  void persist(next, replaceCatalog(next));
                  downloadCatalog(next);
                  setNotice(`Replaced cellar from ${filename}. Backup kept in the browser; JSON downloaded.`);
                  setView("library");
                }}
              />
              <MergeImportPanel
                catalog={catalog}
                onConfirm={(bottles) => {
                  void persist(applyMerge(catalog, bottles), addBottles(bottles));
                  setNotice(`Added ${bottles.length} bottle${bottles.length === 1 ? "" : "s"} from the workbook.`);
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
                    void persist(upsertBottle(catalog, bottle), saveBottle(bottle));
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
