import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyFilters } from "../types";
import { AppliedTray } from "./AppliedTray";

describe("AppliedTray", () => {
  it("says the table is open when nothing is applied", () => {
    const html = renderToStaticMarkup(
      <AppliedTray filters={emptyFilters()} onChange={() => {}} title="In your glass" />,
    );
    expect(html).toContain("In your glass");
    expect(html).toContain("Nothing applied yet — everything");
    expect(html).toContain("on the table.");
    expect(html).not.toContain("Clear all");
  });

  it("renders a removable chip and Clear all once a pick exists", () => {
    const html = renderToStaticMarkup(
      <AppliedTray
        filters={{ ...emptyFilters(), families: ["Smoke"] }}
        onChange={() => {}}
      />,
    );
    expect(html).toContain('aria-label="Remove Smoke"');
    expect(html).toContain("family-dot family-smoke");
    expect(html).toContain("Clear all");
    expect(html).not.toContain("In your glass");
  });
});
