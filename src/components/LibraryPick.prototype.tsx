// PROTOTYPE, throwaway. Three ways to put the Pick on the Library and show it draws from the filtered view.
// Switch with ?variant=A|B|C on The Library (dev only). Not for main: keep on a prototype/ branch once a variant wins.
import { useRef, useState, type ReactNode } from "react";
import type { Bottle, FilterState } from "../types";
import { appliedChips } from "../lib/applied";
import { choosePour, leadBottle, prefersReducedMotion } from "../lib/pour";
import { FANCY_PICKER_URL, stageFancyPool } from "../lib/fancy";

export const PICK_VARIANTS = [
  { key: "A", name: "Header button with count" },
  { key: "B", name: "Pick inside the filter drawer" },
  { key: "C", name: "Docked pool sentence" },
];

export const rowId = (bottleKey: string) => `lib-${bottleKey}`;

export const PROTOTYPE_CSS = `
@keyframes proto-pick-pulse {
  0% { box-shadow: 0 0 0 0 var(--gold); transform: scale(1); }
  40% { box-shadow: 0 0 0 10px transparent; transform: scale(1.025); }
  100% { box-shadow: 0 0 0 3px var(--gold); transform: scale(1); }
}
.proto-picking { animation: proto-pick-pulse 750ms cubic-bezier(0.32, 0.72, 0, 1) both; border-radius: 12px; }
.proto-picked { box-shadow: 0 0 0 3px var(--gold); border-radius: 12px; }
.proto-pick-btn { font-weight: 700; }
.proto-pick-btn small { display: block; font-weight: 400; font-size: 11px; opacity: 0.8; }
.proto-dock { position: sticky; bottom: 64px; z-index: 5; margin-top: 24px; display: flex; align-items: center; gap: 16px; padding: 14px 18px; border: 1px solid var(--line-strong); border-radius: 16px; background: var(--card-bg); box-shadow: 0 10px 30px rgba(0,0,0,0.35); }
.proto-dock p { flex: 1; margin: 0; font-family: var(--serif); font-size: 17px; }
.proto-dock p b { color: var(--amber); }
.proto-drawer-pick { display: flex; flex-direction: column; gap: 8px; padding: 12px 0 0; border-top: 1px solid var(--line); }
.proto-drawer-pick p { margin: 0; color: var(--muted); font-size: 13px; }
`;

function revealEl(el: HTMLElement): Promise<void> {
  if (prefersReducedMotion()) {
    el.scrollIntoView({ block: "center" });
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      document.removeEventListener("scrollend", done);
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, 700);
    document.addEventListener("scrollend", done);
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

export function usePrototypePick(shown: Bottle[], setOpenKey: (key: string | null) => void) {
  const [picked, setPicked] = useState<Bottle | null>(null);
  const [phase, setPhase] = useState<"idle" | "picking" | "picked">("idle");
  const [fancy, setFancy] = useState(false);
  const generation = useRef(0);

  const pick = () => {
    if (fancy) {
      stageFancyPool(shown);
      window.location.assign(FANCY_PICKER_URL);
      return;
    }
    const next = choosePour(shown, picked?.id ?? null);
    if (!next) return;
    const lead = leadBottle(shown, next);
    const mine = ++generation.current;
    setOpenKey(null);
    setPicked(lead);
    setPhase("idle");
    window.requestAnimationFrame(() => {
      const el = document.getElementById(rowId(lead.bottleKey));
      const land = () => {
        if (mine !== generation.current) return;
        setPhase("picking");
        window.setTimeout(() => {
          if (mine !== generation.current) return;
          setPhase("picked");
          setOpenKey(lead.bottleKey);
        }, 750);
      };
      if (el) void revealEl(el).then(land);
      else land();
    });
  };

  const markFor = (bottleKey: string) =>
    picked?.bottleKey !== bottleKey ? "" : phase === "picking" ? "proto-picking" : phase === "picked" ? "proto-picked" : "";

  return { pick, picked: phase === "picked" ? picked : null, markFor, fancy, setFancy };
}

function poolText(filters: FilterState): string {
  return appliedChips(filters).map((chip) => chip.label).join(" · ");
}

type Affordance = { count: number; filters: FilterState; onPick: () => void; fancy: boolean; onFancy: (next: boolean) => void };

function FancySwitch({ fancy, onFancy }: Pick<Affordance, "fancy" | "onFancy">) {
  return (
    <label className="fancy-mode" style={{ padding: 0 }}>
      <input type="checkbox" checked={fancy} onChange={(event) => onFancy(event.currentTarget.checked)} />
      <span>I feel fancy</span>
    </label>
  );
}

/** A: the Pick sits in the header beside Filters, and its label carries the size of the pool. */
export function HeaderPick({ count, filters, onPick }: Affordance) {
  const narrowed = appliedChips(filters).length > 0;
  return (
    <button type="button" className="roll proto-pick-btn" onClick={onPick} disabled={count === 0} title={poolText(filters) || "Whole Library"}>
      Pick a dram
      <small>{narrowed ? `from ${count} filtered` : `from all ${count}`}</small>
    </button>
  );
}

/** B: the Pick lives in the filter drawer, so you pick right where you narrowed. */
export function DrawerPick({ count, filters, onPick, fancy, onFancy }: Affordance) {
  const narrowed = appliedChips(filters).length > 0;
  return (
    <div className="proto-drawer-pick">
      <p>{narrowed ? `A Pick chooses one of the ${count} bottles these filters leave.` : `No filters yet: a Pick chooses from all ${count} bottles.`}</p>
      <button type="button" className="roll" onClick={onPick} disabled={count === 0}>
        Pick from these {count}
      </button>
      <FancySwitch fancy={fancy} onFancy={onFancy} />
    </div>
  );
}

/** C: a docked sentence that always states the pool, with the Pick on it. */
export function DockPick({ count, filters, onPick, fancy, onFancy, children }: Affordance & { children?: ReactNode }) {
  const text = poolText(filters);
  return (
    <div className="proto-dock">
      <p>
        Picking from <b>{count}</b> {count === 1 ? "bottle" : "bottles"}
        {text ? <> · {text}</> : <> · the whole Library</>}
      </p>
      {children}
      <FancySwitch fancy={fancy} onFancy={onFancy} />
      <button type="button" className="roll" onClick={onPick} disabled={count === 0}>
        Pick a dram
      </button>
    </div>
  );
}
