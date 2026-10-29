import { useEffect, useState } from "react";

export function useVariant(keys: readonly string[]): string {
  const read = () => {
    const value = new URLSearchParams(window.location.search).get("variant") ?? keys[0];
    return keys.includes(value) ? value : keys[0];
  };
  const [variant, setVariant] = useState(read);
  useEffect(() => {
    const sync = () => setVariant(read());
    window.addEventListener("prototype-variant", sync);
    return () => window.removeEventListener("prototype-variant", sync);
  });
  return variant;
}

function go(key: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("variant", key);
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event("prototype-variant"));
}

export function PrototypeSwitcher({ variants, current }: { variants: { key: string; name: string }[]; current: string }) {
  const index = Math.max(0, variants.findIndex((v) => v.key === current));
  const step = (by: number) => go(variants[(index + by + variants.length) % variants.length].key);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!import.meta.env.DEV) return null;
  const shown = variants[index];
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 16,
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 14px",
        borderRadius: 999,
        background: "#111",
        color: "#fff",
        font: "600 13px system-ui, sans-serif",
        boxShadow: "0 6px 24px rgba(0,0,0,0.45)",
      }}
    >
      <button type="button" onClick={() => step(-1)} style={{ all: "unset", cursor: "pointer", padding: "0 6px" }} aria-label="Previous variant">
        ←
      </button>
      <span>
        PROTOTYPE {shown.key} ({shown.name})
      </span>
      <button type="button" onClick={() => step(1)} style={{ all: "unset", cursor: "pointer", padding: "0 6px" }} aria-label="Next variant">
        →
      </button>
    </div>
  );
}
