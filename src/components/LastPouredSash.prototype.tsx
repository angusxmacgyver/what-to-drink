// PROTOTYPE, throwaway: three looks for the Last Poured mark on the real Library and Graveyard,
// switched with ?sash=A|B|C and ?kill=1. Lives on the prototype/last-poured-sash branch only.
import { useSyncExternalStore, type KeyboardEvent } from "react";
import "./LastPouredSash.prototype.css";

const VARIANTS = [
  { key: "A", name: "Sash" },
  { key: "B", name: "Badge" },
  { key: "C", name: "Tint" },
] as const;

type VariantKey = (typeof VARIANTS)[number]["key"];

// Sample value for the prototype; the real mark would read the newest dram's date.
const POURED_AGO = "3 days ago";

const CHANGE = "prototype-params";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

function readParams() {
  return window.location.search;
}

function setParam(name: string, value: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (value == null) params.delete(name);
  else params.set(name, value);
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  window.dispatchEvent(new Event(CHANGE));
}

export function usePrototypeSash(): { variant: VariantKey; kill: boolean } {
  const search = useSyncExternalStore(subscribe, readParams, () => "");
  const params = new URLSearchParams(search);
  const raw = params.get("sash");
  const variant = VARIANTS.some((v) => v.key === raw) ? (raw as VariantKey) : "A";
  return { variant, kill: params.get("kill") === "1" };
}

export function sashHostClass(on: boolean, variant: VariantKey): string {
  return on ? `lp-host lp-host-${variant}` : "";
}

/** Sash: a copper edge strip with a small label tab, pinned to the host's upper-left corner. */
export function LastPouredSash({ variant }: { variant: VariantKey }) {
  if (variant !== "A") return null;
  return (
    <>
      <span className="lp-mark lp-edge" aria-hidden="true" />
      <span className="lp-mark lp-tab">Last poured</span>
    </>
  );
}

/** Badge: a copper-outlined pill in the name line. */
export function LastPouredBadge({ variant }: { variant: VariantKey }) {
  if (variant !== "B") return null;
  return (
    <span className="lp-mark lp-badge">
      Last poured<span className="lp-date"> · 3d ago</span>
    </span>
  );
}

/** Tint: a one-line caption under the name; the host carries the tint and the thicker rule. */
export function LastPouredEyebrow({ variant }: { variant: VariantKey }) {
  if (variant !== "C") return null;
  return <span className="lp-mark lp-caption">Last poured · {POURED_AGO}</span>;
}

export function PrototypeSashSwitcher() {
  const { variant, kill } = usePrototypeSash();
  const index = VARIANTS.findIndex((v) => v.key === variant);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length].key;
    setParam("sash", next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-variant="${next}"]`)?.focus();
  };

  return (
    <div className="lp-switcher">
      <div className="lp-segments" role="radiogroup" aria-label="Last Poured mark" onKeyDown={onKeyDown}>
        {VARIANTS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="radio"
            data-variant={v.key}
            aria-checked={v.key === variant}
            tabIndex={v.key === variant ? 0 : -1}
            className={v.key === variant ? "lp-segment on" : "lp-segment"}
            onClick={() => setParam("sash", v.key)}
          >
            {v.name}
          </button>
        ))}
      </div>
      <label className="lp-kill">
        <input type="checkbox" checked={kill} onChange={(e) => setParam("kill", e.currentTarget.checked ? "1" : null)} />
        Newest dram was a kill shot{kill ? " (see Graveyard)" : ""}
      </label>
    </div>
  );
}
