type Props = {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  emptyHint?: string;
  colorFor?: (option: string) => string;
};

export function ChipSelect({ label, options, value, onChange, emptyHint, colorFor }: Props) {
  const toggle = (option: string) => {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  };

  return (
    <div className="chipset grow">
      <div className="chipset-head">
        <span className="chipset-label">{label}</span>
        {value.length ? (
          <button type="button" className="chipset-clear" onClick={() => onChange([])}>
            Clear
          </button>
        ) : null}
      </div>
      {options.length === 0 && emptyHint ? (
        <p className="chipset-hint">{emptyHint}</p>
      ) : (
        <div className="chipset-row">
          {options.map((option) => {
            const on = value.includes(option);
            const classes = ["chip", on ? "on" : "", colorFor?.(option) ?? ""].filter(Boolean).join(" ");
            return (
              <button
                key={option}
                type="button"
                className={classes}
                aria-pressed={on}
                onClick={() => toggle(option)}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
