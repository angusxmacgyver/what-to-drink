import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  options: string[];
  counts: Record<string, number>;
  value: string[];
  onChange: (next: string[]) => void;
};

export function DistilleryCombobox({ options, counts, value, onChange }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

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

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = options.filter((option) => !value.includes(option));
    const filtered = q ? pool.filter((option) => option.toLowerCase().includes(q)) : pool;
    return filtered.sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0)).slice(0, 8);
  }, [options, value, query, counts]);

  const add = (name: string) => {
    onChange([...value, name]);
    setQuery("");
    setActive(0);
  };

  const remove = (name: string) => onChange(value.filter((item) => item !== name));

  const highlight = (name: string) => {
    const q = query.trim();
    if (!q) return name;
    const i = name.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1) return name;
    return (
      <>
        {name.slice(0, i)}
        <strong>{name.slice(i, i + q.length)}</strong>
        {name.slice(i + q.length)}
      </>
    );
  };

  return (
    <div
      className="combobox grow"
      ref={root}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.stopPropagation();
        event.preventDefault();
        setOpen(false);
      }}
    >
      <span className="combobox-label">Distillery / Producer</span>
      {value.length ? (
        <div className="combobox-chips">
          {value.map((name) => (
            <span key={name} className="combobox-chip">
              {name}
              <button type="button" aria-label={`Remove ${name}`} onClick={() => remove(name)}>
                &times;
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <input
        className="combobox-input"
        value={query}
        placeholder="Search distilleries…"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((a) => Math.min(a + 1, Math.max(matches.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (matches[active]) add(matches[active]);
          } else if (event.key === "Backspace" && query === "" && value.length) {
            remove(value[value.length - 1]);
          }
        }}
      />
      {open && matches.length ? (
        <div className="combobox-panel" role="listbox">
          {matches.map((name, i) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={i === active}
              className={i === active ? "combobox-option active" : "combobox-option"}
              onMouseEnter={() => setActive(i)}
              onClick={() => add(name)}
            >
              <span>{highlight(name)}</span>
              <span className="combobox-count">{counts[name] ?? 0}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
