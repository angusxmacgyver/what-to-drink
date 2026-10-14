import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BackToTop, showsBackToTop } from "./BackToTop";

describe("showsBackToTop", () => {
  it("stays hidden until the page has moved past 800px", () => {
    expect(showsBackToTop(0)).toBe(false);
    expect(showsBackToTop(800)).toBe(false);
    expect(showsBackToTop(801)).toBe(true);
  });
});

describe("BackToTop", () => {
  it("is present and inactive before any scroll", () => {
    const html = renderToStaticMarkup(<BackToTop />);
    expect(html).toContain('aria-label="Back to top"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('tabindex="-1"');
    expect(html).not.toContain("back-to-top on");
  });
});
