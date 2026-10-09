import { useState } from "react";
import { splitBalancedRow } from "../lib/colors";
import { loadCollapsedSections, setSectionCollapsed } from "../lib/store";

export type OptionTile = {
  label: string;
  count: number;
  swatch?: string;
};

type Props = {
  id: string;
  label: string;
  options: OptionTile[];
  value: string[];
  onChange: (next: string[]) => void;
  minSecondRow?: number;
};

export function OptionGrid({ id, label, options, value, onChange, minSecondRow = 0 }: Props) {
  const [collapsed, setCollapsed] = useState(() => loadCollapsedSections().includes(id));

  const toggleSection = () => {
    const next = !collapsed;
    setCollapsed(next);
    setSectionCollapsed(id, next);
  };

  const toggleOption = (option: string) => {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  };
  const [head, tail] = splitBalancedRow(options, minSecondRow);
  const tiles = (group: OptionTile[]) =>
    group.map((option) => {
      const on = value.includes(option.label);
      const classes = ["option-tile", on ? "on" : "", option.count === 0 ? "quiet" : ""].filter(Boolean).join(" ");
      return (
        <button key={option.label} type="button" className={classes} aria-pressed={on} onClick={() => toggleOption(option.label)}>
          {option.swatch ? <span className={`family-dot ${option.swatch}`} aria-hidden="true" /> : null}
          <span>{option.label}</span>
          <span className="option-count">{option.count}</span>
        </button>
      );
    });

  return (
    <section className="option-section">
      <div className="chipset-head">
        <button type="button" className="option-section-toggle" aria-expanded={!collapsed} onClick={toggleSection}>
          {label}
        </button>
        {value.length ? (
          <button type="button" className="chipset-clear" onClick={() => onChange([])}>
            Clear
          </button>
        ) : null}
      </div>
      {collapsed ? null : (
        <div className="option-grid">
          {tiles(head)}
          {tail.length ? <span className="row-break" /> : null}
          {tiles(tail)}
        </div>
      )}
    </section>
  );
}
