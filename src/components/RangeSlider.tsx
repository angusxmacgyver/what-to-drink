import { useState } from "react";

type Props = {
  label: string;
  min: number;
  max: number;
  step: number;
  low: number;
  high: number;
  format: (n: number) => string;
  onChange: (low: number, high: number) => void;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function RangeSlider({ label, min, max, step, low, high, format, onChange }: Props) {
  const [last, setLast] = useState<"low" | "high">("high");
  const span = max - min || 1;
  const lo = clamp(low, min, max);
  const hi = clamp(high, min, max);
  const left = ((lo - min) / span) * 100;
  const right = ((hi - min) / span) * 100;
  const active = lo > min || hi < max;

  const snap = (n: number) => {
    const stepped = Math.round((n - min) / step) * step + min;
    return clamp(Number(stepped.toFixed(4)), min, max);
  };

  return (
    <div className={active ? "range on" : "range"}>
      <div className="range-head">
        <span>{label}</span>
        <span className="range-values">
          {format(lo) === format(hi) ? format(lo) : `${format(lo)} – ${format(hi)}`}
        </span>
      </div>
      <div
        className="range-track"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).tagName === "INPUT") return;
          const rect = e.currentTarget.getBoundingClientRect();
          const val = snap(min + ((e.clientX - rect.left) / rect.width) * span);
          if (Math.abs(val - lo) <= Math.abs(val - hi)) {
            setLast("low");
            onChange(Math.min(val, hi), hi);
          } else {
            setLast("high");
            onChange(lo, Math.max(val, lo));
          }
        }}
      >
        <div className="range-rail" />
        <div className="range-fill" style={{ left: `${left}%`, width: `${right - left}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          aria-label={`${label} minimum`}
          style={{ zIndex: last === "low" ? 5 : 3 }}
          onChange={(e) => {
            setLast("low");
            onChange(Math.min(Number(e.target.value), hi), hi);
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          aria-label={`${label} maximum`}
          style={{ zIndex: last === "high" ? 5 : 3 }}
          onChange={(e) => {
            setLast("high");
            onChange(lo, Math.max(Number(e.target.value), lo));
          }}
        />
      </div>
    </div>
  );
}
