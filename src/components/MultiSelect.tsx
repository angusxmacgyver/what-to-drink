import { useEffect, useId, useMemo, useRef, useState } from "react";

type Props = {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
};

export function MultiSelect({ label, options, value, onChange, placeholder = "Any" }: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.toLowerCase().includes(q));
  }, [options, query]);

  const summary =
    value.length === 0
      ? placeholder
      : value.length <= 2
        ? value.join(", ")
        : `${value.slice(0, 2).join(", ")} +${value.length - 2}`;

  const toggle = (option: string) => {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  };

  return (
    <div className="multi" ref={root}>
      <span className="multi-label" id={id}>
        {label}
      </span>
      <button
        type="button"
        className={value.length ? "multi-trigger on" : "multi-trigger"}
        aria-expanded={open}
        aria-labelledby={id}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="multi-summary">{summary}</span>
        {value.length ? <span className="multi-count">{value.length}</span> : null}
      </button>
      {open ? (
        <div className="multi-panel" role="listbox" aria-multiselectable="true">
          <input
            autoFocus
            className="multi-search"
            value={query}
            placeholder="Search…"
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="multi-options">
            {filtered.length === 0 ? <p className="multi-empty">No matches</p> : null}
            {filtered.map((option) => {
              const checked = value.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  className={checked ? "multi-option checked" : "multi-option"}
                  onClick={() => toggle(option)}
                >
                  <span className="multi-tick" aria-hidden="true">
                    {checked ? "✓" : ""}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>
          {value.length ? (
            <button type="button" className="multi-clear" onClick={() => onChange([])}>
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
