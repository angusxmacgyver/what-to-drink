import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Bottle } from "../types";
import { DramResults } from "./PickADram";

function bottle(overrides: Partial<Bottle> = {}): Bottle {
  return {
    id: "id",
    bottleKey: "ardbeg::10",
    distillery: "Ardbeg",
    bottling: "10",
    age: 10,
    abv: 46,
    status: "Open",
    notes: "",
    tastingNotes: "",
    location: "Bar",
    region: "Islay",
    theme: "",
    flavorFamilies: ["Smoke"],
    subCharacteristics: ["Woodsmoke & Campfire"],
    atApartment: false,
    country: "Scotland",
    dateEmptied: "",
    smws: null,
    ...overrides,
  };
}

function render(bottles: Bottle[], openKey: string | null = null) {
  return renderToStaticMarkup(<DramResults bottles={bottles} openKey={openKey} onToggle={() => {}} />);
}

describe("DramResults", () => {
  const pair = [
    bottle({ id: "open", status: "Open", location: "Bar" }),
    bottle({ id: "closed", status: "Closed", location: "Crate" }),
  ];
  const hakushu = bottle({
    id: "hakushu",
    bottleKey: "hakushu::12",
    distillery: "Hakushu",
    bottling: "12 Year",
    region: "Japan",
    country: "Japan",
    flavorFamilies: [],
    subCharacteristics: [],
    smws: {
      fullCode: "99.9",
      distilleryNo: "99",
      caskNo: "9",
      flavorProfile: "",
      smwsCask: "",
      secondaryMaturation: "",
      nameIntl: "",
      vintage: "",
      smwsUrl: "",
    },
  });

  it("shows one card per expression, with the full name and no code", () => {
    const html = render([...pair, hakushu]);
    expect(html).toContain('aria-label="Ardbeg 10"');
    expect(html).toContain('title="Ardbeg 10"');
    expect(html).toContain("card-distillery");
    expect(html).toContain("card-expression");
    expect(html).toContain("Islay · Scotland");
    expect(html).toContain(">Japan<");
    expect(html).not.toContain("Japan · Japan");
    expect(html).toContain(">×2<");
    expect(html).toContain("family-dot");
    expect(html).not.toContain("99.9");
    expect(html).not.toContain("bottle-fields");
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(2);
  });

  it("opens one detail panel with flavor tags and the status split", () => {
    const html = render([...pair, hakushu], "ardbeg::10");
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(1);
    expect(html).toContain("tag family");
    expect(html).toContain("Woodsmoke &amp; Campfire");
    expect(html).toContain("Open · Bar");
    expect(html).toContain("Closed · Crate");
    expect(html.match(/bottle-fields/g)).toHaveLength(1);
    expect(html).not.toContain("99.9");
  });
});
