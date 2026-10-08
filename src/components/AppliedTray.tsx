import { emptyFilters, type FilterState } from "../types";
import { appliedChips, removeChip } from "../lib/applied";

type Props = {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  title?: string;
  flagId?: string | null;
};

export function AppliedTray({ filters, onChange, title, flagId = null }: Props) {
  const chips = appliedChips(filters);
  return (
    <div className="applied-tray">
      {title ? <p className="applied-title">{title}</p> : null}
      {chips.length === 0 ? (
        <p className="applied-empty">Nothing applied yet — everything's on the table.</p>
      ) : (
        <>
          <div className="applied-chips">
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className="chip applied-chip"
                aria-label={`Remove ${chip.label}`}
                onClick={() => onChange(removeChip(filters, chip.id))}
              >
                {chip.swatch ? <span className={`family-dot ${chip.swatch}`} aria-hidden="true" /> : null}
                <span>{chip.label}</span>
                {chip.id === flagId ? <span className="constraint-flag">Most constraining</span> : null}
              </button>
            ))}
          </div>
          <button type="button" className="chipset-clear" onClick={() => onChange(emptyFilters())}>
            Clear all
          </button>
        </>
      )}
    </div>
  );
}
