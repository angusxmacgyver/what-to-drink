import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyFilters } from "../types";
import { FilterDrawer, FiltersButton, trapTab } from "./FilterDrawer";

describe("trapTab", () => {
  const items = ["a", "b", "c"];

  it("wraps at either end and pulls focus back inside", () => {
    expect(trapTab(items, "c", false)).toBe("a");
    expect(trapTab(items, "a", true)).toBe("c");
    expect(trapTab(items, "b", false)).toBeNull();
    expect(trapTab(items, null, false)).toBe("a");
    expect(trapTab(items, null, true)).toBe("c");
  });
});

describe("FiltersButton", () => {
  it("shows the active count only when a filter is applied", () => {
    const idle = renderToStaticMarkup(
      <FiltersButton count={0} open={false} onClick={() => {}} buttonRef={{ current: null }} />,
    );
    const active = renderToStaticMarkup(
      <FiltersButton count={2} open={true} onClick={() => {}} buttonRef={{ current: null }} />,
    );
    expect(idle).toContain(">Filters<");
    expect(idle).toContain('aria-expanded="false"');
    expect(idle).not.toContain("filters-badge");
    expect(active).toContain('aria-expanded="true"');
    expect(active).toContain("filters-badge");
    expect(active).toContain(">2<");
  });
});

describe("FilterDrawer", () => {
  it("lays the tray over a scrim with Pour one and the live count", () => {
    const html = renderToStaticMarkup(
      <FilterDrawer
        filters={emptyFilters()}
        onChange={() => {}}
        available={4}
        onPour={() => {}}
        onUndo={() => {}}
        canUndo
        onClose={() => {}}
      />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain("drawer-scrim");
    expect(html).toContain('aria-label="Close filters"');
    expect(html).toContain("In your glass");
    expect(html).toContain(">4 available<");
    expect(html).toContain("Pour one");
    expect(html).toContain("Undo last");
    expect(html).not.toContain("disabled");
  });

  it("disables Pour one when nothing is available", () => {
    const html = renderToStaticMarkup(
      <FilterDrawer
        filters={emptyFilters()}
        onChange={() => {}}
        available={0}
        onPour={() => {}}
        onUndo={() => {}}
        canUndo={false}
        onClose={() => {}}
      />,
    );
    expect(html).toContain("disabled");
    expect(html).toContain(">0 available<");
    const undo = html.match(/<button[^>]*>Undo last<\/button>/)?.[0] ?? "";
    expect(undo).toContain("disabled");
  });
});
