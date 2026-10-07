import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Histogram } from "../lib/histogram";
import { binFullyInside, clampSelection } from "../lib/histogram";

type Props = {
  label: string;
  histogram: Histogram;
  from: number;
  to: number;
  unit: string;
  onChange: (from: number, to: number) => void;
};

function ticks(min: number, max: number): number[] {
  const step = (max - min) / 3;
  return [...new Set([min, Math.round(min + step), Math.round(min + step * 2), max])];
}

export function RangeHistogram({ label, histogram, from, to, unit, onChange }: Props) {
  const plotRef = useRef<HTMLDivElement>(null);
  const { min, max, binWidth, bins } = histogram;
  const selection = clampSelection(from, to, min, max, binWidth);
  const peak = Math.max(...bins.map((bin) => bin.count), 1);
  const span = max - min || 1;
  const active = selection.from > min || selection.to < max;
  const [draft, setDraft] = useState({ from: String(selection.from), to: String(selection.to) });

  useEffect(() => {
    setDraft({ from: String(selection.from), to: String(selection.to) });
  }, [selection.from, selection.to]);

  const valueAt = (clientX: number) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect?.width) return min;
    return min + ((clientX - rect.left) / rect.width) * span;
  };

  const emit = (nextFrom: number, nextTo: number) => {
    const next = clampSelection(nextFrom, nextTo, min, max, binWidth);
    onChange(next.from, next.to);
  };

  const drag = (mode: "from" | "to" | "pan", event: ReactPointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const origin = selection;
    const width = origin.to - origin.from;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const move = (ev: PointerEvent) => {
      if (mode === "pan") {
        const delta = valueAt(ev.clientX) - valueAt(startX);
        let nextFrom = Math.round(origin.from + delta);
        let nextTo = nextFrom + width;
        if (nextFrom < min) {
          nextFrom = min;
          nextTo = min + width;
        }
        if (nextTo > max) {
          nextTo = max;
          nextFrom = max - width;
        }
        onChange(nextFrom, nextTo);
        return;
      }
      const raw = valueAt(ev.clientX);
      if (mode === "from") emit(Math.min(raw, origin.to - binWidth), origin.to);
      else emit(origin.from, Math.max(raw, origin.from + binWidth));
    };
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
  };

  const commit = (end: "from" | "to", raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      setDraft({ from: String(selection.from), to: String(selection.to) });
      return;
    }
    if (end === "from") emit(n, selection.to);
    else emit(selection.from, n);
  };

  const left = ((selection.from - min) / span) * 100;
  const brushWidth = ((selection.to - selection.from) / span) * 100;

  return (
    <div className={active ? "hist on" : "hist"}>
      <div className="hist-head">
        <span>{label}</span>
        <span className="hist-values">
          {selection.from}
          {unit} – {selection.to}
          {unit}
        </span>
      </div>
      <div
        className="hist-plot"
        ref={plotRef}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest(".hist-brush")) return;
          const raw = valueAt(event.clientX);
          const mode = Math.abs(raw - selection.from) <= Math.abs(raw - selection.to) ? "from" : "to";
          drag(mode, event);
        }}
      >
        <div className="hist-bars" aria-hidden="true">
          {bins.map((bin) => (
            <div key={bin.from} className="hist-col">
              <div
                className={binFullyInside(bin, selection.from, selection.to) ? "hist-bar on" : "hist-bar"}
                style={{ height: `${(bin.count / peak) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="hist-brush" style={{ left: `${left}%`, width: `${brushWidth}%` }} onPointerDown={(event) => drag("pan", event)}>
          <button type="button" className="hist-handle left" aria-label={`${label} from`} onPointerDown={(event) => drag("from", event)} />
          <button type="button" className="hist-handle right" aria-label={`${label} to`} onPointerDown={(event) => drag("to", event)} />
        </div>
      </div>
      <div className="hist-axis" aria-hidden="true">
        {ticks(min, max).map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
      <div className="hist-ends">
        <label>
          From
          <input
            type="number"
            inputMode="numeric"
            aria-label={`${label} from`}
            value={draft.from}
            onChange={(event) => setDraft((prev) => ({ ...prev, from: event.target.value }))}
            onBlur={(event) => commit("from", event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit("from", draft.from);
            }}
          />
          <span>{unit}</span>
        </label>
        <label>
          To
          <input
            type="number"
            inputMode="numeric"
            aria-label={`${label} to`}
            value={draft.to}
            onChange={(event) => setDraft((prev) => ({ ...prev, to: event.target.value }))}
            onBlur={(event) => commit("to", event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit("to", draft.to);
            }}
          />
          <span>{unit}</span>
        </label>
      </div>
    </div>
  );
}
