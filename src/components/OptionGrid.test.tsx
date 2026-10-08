import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { setSectionCollapsed } from "../lib/store";
import { OptionGrid } from "./OptionGrid";

afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
  const session = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => session.set(key, value),
    removeItem: (key: string) => session.delete(key),
  });
});

const options = [
  { label: "Smoke", count: 4, swatch: "family-smoke" },
  { label: "Sweet", count: 0, swatch: "family-sweet" },
];

function html(value: string[] = []) {
  return renderToStaticMarkup(
    <OptionGrid id="families" label="Flavor families" options={options} value={value} onChange={() => {}} />,
  );
}

describe("OptionGrid", () => {
  it("renders each option as a button with its count and swatch", () => {
    const markup = html(["Smoke"]);
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain(">Smoke<");
    expect(markup).toContain(">4<");
    expect(markup).toContain("family-dot family-smoke");
    expect(markup).toContain(">Sweet<");
    expect(markup).toContain(">0<");
    expect(markup).toContain('class="option-tile quiet"');
    expect(markup).not.toContain("disabled");
  });

  it("shows Clear only when the section has picks", () => {
    expect(html()).not.toContain("Clear");
    expect(html(["Smoke"])).toContain("Clear");
  });

  it("hides the tiles when this section was collapsed earlier in the session", () => {
    setSectionCollapsed("families", true);
    const markup = html(["Smoke"]);
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("option-grid");
    expect(markup).toContain("Clear");
  });
});
