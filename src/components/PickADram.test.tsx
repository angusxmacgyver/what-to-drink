import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyFilters, type Bottle } from "../types";
import { DramResults, DramSummary } from "./PickADram";

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

function render(
  bottles: Bottle[],
  openKey: string | null = null,
  extra: { pickedId?: string | null; rollingKey?: string | null; announce?: string } = {},
) {
  return renderToStaticMarkup(
    <DramResults bottles={bottles} openKey={openKey} onToggle={() => {}} {...extra} />,
  );
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

  it("marks the picked card, opens its detail, and leaves a spot for Just poured", () => {
    const html = render(pair, "ardbeg::10", {
      pickedId: "closed",
      announce: "Your dram: Ardbeg 10. Bottle is at: Crate.",
    });
    expect(html).toContain("library-card open picked");
    expect(html).toContain("Your dram");
    expect(html).toContain("Bottle is at: Crate");
    expect(html).toContain('aria-label="Ardbeg 10. Your dram. Bottle is at: Crate."');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Your dram: Ardbeg 10. Bottle is at: Crate.");
    expect(html).toContain("just-poured");
    expect(html).not.toContain('class="result"');
  });

  it("keeps the picked card when another card is open", () => {
    const html = render([...pair, hakushu], "hakushu::12", { pickedId: "closed" });
    const cards = [...html.matchAll(/<button[^>]*class="([^"]*)"/g)].map((match) => match[1]);
    expect(cards[0]).toContain("picked");
    expect(cards[0]).not.toContain("open");
    expect(cards[1]).toContain("open");
    expect(cards[1]).not.toContain("picked");
    expect(html).not.toContain("just-poured");
    expect(html).toContain("Your dram");
  });

  it("highlights a card mid-roll without calling it the dram yet", () => {
    const html = render([...pair, hakushu], null, { rollingKey: "hakushu::12" });
    expect(html).toContain("library-card rolling");
    expect(html).not.toContain("picked");
    expect(html).not.toContain("Your dram");
  });
});

describe("DramSummary", () => {
  it("shows the count, the applied chips, and Clear all above the grid", () => {
    const html = renderToStaticMarkup(
      <DramSummary available={3} filters={{ ...emptyFilters(), families: ["Smoke"] }} onFilters={() => {}}>
        <p>the grid</p>
      </DramSummary>,
    );
    expect(html).toContain(">3 available<");
    expect(html).toContain('aria-label="Remove Smoke"');
    expect(html).toContain("Clear all");
    expect(html).toContain("the grid");
    expect(html).not.toContain("No bottles match this combination.");
    expect(html).not.toContain("Pour one");
  });

  it("replaces the grid when the combination matches nothing", () => {
    const html = renderToStaticMarkup(
      <DramSummary available={0} filters={{ ...emptyFilters(), families: ["Smoke"] }} onFilters={() => {}}>
        <p>the grid</p>
      </DramSummary>,
    );
    expect(html).toContain(">0 available<");
    expect(html).toContain("No bottles match this combination.");
    expect(html).toContain('aria-label="Remove Smoke"');
    expect(html).toContain("Clear all");
    expect(html).not.toContain("the grid");
    expect(html).not.toContain("Nothing matches these filters.");
  });
});
