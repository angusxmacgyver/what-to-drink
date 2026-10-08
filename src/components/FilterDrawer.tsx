import { useEffect, useRef, type RefObject } from "react";
import type { FilterState } from "../types";
import { appliedChips } from "../lib/applied";
import { AppliedTray } from "./AppliedTray";

const FOCUSABLE = "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])";

export function activeFilterCount(filters: FilterState): number {
  return appliedChips(filters).length;
}

/** Where Tab should go to stay inside the drawer. Null lets the browser move. */
export function trapTab<T>(items: readonly T[], active: T | null, shift: boolean): T | null {
  if (items.length === 0) return null;
  const first = items[0];
  const last = items[items.length - 1];
  const index = active == null ? -1 : items.indexOf(active);
  if (index < 0) return shift ? last : first;
  if (shift && index === 0) return last;
  if (!shift && index === items.length - 1) return first;
  return null;
}

type ButtonProps = {
  count: number;
  open: boolean;
  onClick: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
};

export function FiltersButton({ count, open, onClick, buttonRef }: ButtonProps) {
  return (
    <button ref={buttonRef} type="button" className="textish" aria-expanded={open} onClick={onClick}>
      Filters
      {count > 0 ? <span className="filters-badge">{count}</span> : null}
    </button>
  );
}

type DrawerProps = {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  available: number;
  onPour: () => void;
  onClose: () => void;
};

export function FilterDrawer({ filters, onChange, available, onPour, onClose }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const items = () => [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items()[0];
    if (first) first.focus();
    else panel.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const next = trapTab(items(), document.activeElement instanceof HTMLElement ? document.activeElement : null, event.shiftKey);
      if (!next) return;
      event.preventDefault();
      next.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="drawer-root">
      <div className="drawer-scrim" onClick={onClose} />
      <div ref={panelRef} className="drawer" role="dialog" aria-modal="true" aria-label="Filters" tabIndex={-1}>
        <AppliedTray title="In your glass" filters={filters} onChange={onChange} />
        <footer className="drawer-footer">
          <span className="count">{available} available</span>
          <button type="button" className="roll" onClick={onPour} disabled={available === 0}>
            Pour one
          </button>
        </footer>
      </div>
    </div>
  );
}
