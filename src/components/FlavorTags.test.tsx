import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FlavorTags } from "./FlavorTags";

describe("FlavorTags", () => {
  it("groups characteristics by effective family and marks filter-driving tags", () => {
    const html = renderToStaticMarkup(
      <FlavorTags
        families={["Coastal", "Smoke"]}
        subs={["Brine & Sea Air", "Honey"]}
        grouped
        selectedFamilies={["Smoke"]}
        selectedSubs={["Honey"]}
        subFamilies={{ Honey: "Smoke" }}
      />,
    );

    expect(html).toContain(">Families<");
    expect(html).toContain(">Characteristics<");
    expect(html).toContain('class="tag family family-smoke matched"');
    expect(html).toContain('aria-label="Smoke, matches selected filter"');
    expect(html).toContain('class="flavor-cluster family-smoke"');
    expect(html).toContain('class="tag sub family-smoke matched"');
    expect(html).toContain('aria-label="Honey, matches selected filter"');
    expect(html.indexOf("Smoke characteristics")).toBeLessThan(html.indexOf("Coastal characteristics"));
  });
});
