import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyFilters, type Bottle } from "../types";
import { saveDramSelection } from "../lib/store";
import { DramResults, DramSummary, PickADram } from "./PickADram";

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
  extra: { pickedId?: string | null; announce?: string } = {},
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
    expect(html).toContain("view-transition-name:card-ardbeg_3a__3a_10");
    expect(html).toContain("view-transition-class:dram-card");
  });

  it("puts age, strength, and place above the notes, and keeps distillery and bottling in the header", () => {
    const html = render(
      [
        bottle({
          notes: "Cask note",
          tastingNotes: "Cherry and nuts",
          region: "Speyside",
          theme: "Sherry",
          smws: hakushu.smws,
        }),
      ],
      "ardbeg::10",
    );
    const dialog = html.slice(html.indexOf("dram-dialog-root"));
    const at = (label: string) => dialog.indexOf(`>${label}<`);
    const facts = ["Age", "ABV %", "Status", "Location", "Region", "Theme"];
    const notes = at("Notes");
    for (const label of facts) expect(at(label)).toBeGreaterThan(-1);
    for (const label of facts) expect(at(label)).toBeLessThan(notes);
    expect(notes).toBeLessThan(at("Tasting notes"));
    expect(at("Tasting notes")).toBeLessThan(at("Full code"));
    expect(dialog).not.toContain("Distillery / Producer");
    expect(dialog).not.toContain(">Bottling<");
    expect(dialog).toContain(">Ardbeg<");
    expect(dialog).toContain("<em>10</em>");
  });

  it("opens one detail dialog with flavor tags and the status split, outside the grid", () => {
    const html = render([...pair, hakushu], "ardbeg::10");
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(1);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Close details"');
    const grid = html.slice(html.indexOf("library-grid"), html.indexOf("dram-dialog-root"));
    expect(grid).not.toContain("bottle-fields");
    expect(html).toContain("tag family");
    expect(html).toContain("Woodsmoke &amp; Campfire");
    expect(html).not.toContain(">Flavor families<");
    expect(html).not.toContain(">Sub-characteristics<");
    expect(html).toContain("Open · Bar");
    expect(html).toContain("Closed · Crate");
    expect(html.match(/bottle-fields/g)).toHaveLength(1);
    expect(html).not.toContain("99.9");
  });

  it("marks the picked card, opens its detail, and leaves a spot for Just poured", () => {
    const html = render(pair, "ardbeg::10", {
      pickedId: "closed",
      announce: "Your dram: Ardbeg 10. Bottle is at: Bar.",
    });
    expect(html).toContain("library-card open picked");
    expect(html).toContain("Your dram");
    expect(html).toContain("Bottle is at: Bar");
    expect(html).not.toContain("Bottle is at: Crate");
    expect(html).toContain("Closed · Crate");
    expect(html).toContain('aria-label="Ardbeg 10. Your dram. Bottle is at: Bar."');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Your dram: Ardbeg 10. Bottle is at: Bar.");
    expect(html).toContain("just-poured");
    expect(html).toContain('class="dram-dialog picked"');
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

  it("offers Pour one beside the count, then Pour another, and disables it at zero", () => {
    const summary = (available: number, poured = false) =>
      renderToStaticMarkup(
        <DramSummary available={available} filters={emptyFilters()} onFilters={() => {}} onPour={() => {}} poured={poured}>
          <p>the grid</p>
        </DramSummary>,
      );
    const ready = summary(3).match(/<button[^>]*class="roll"[^>]*>[^<]*<\/button>/)?.[0] ?? "";
    expect(ready).toContain("Pour one");
    expect(ready).not.toContain("disabled");
    expect(summary(3, true)).toContain("Pour another");
    const none = summary(0).match(/<button[^>]*class="roll"[^>]*>[^<]*<\/button>/)?.[0] ?? "";
    expect(none).toContain("disabled");
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
    const undo = html.match(/<button[^>]*>Undo last<\/button>/)?.[0] ?? "";
    expect(undo).toContain("disabled");
  });

  it("flags the most constraining filter and enables undo", () => {
    const html = renderToStaticMarkup(
      <DramSummary
        available={0}
        filters={{ ...emptyFilters(), families: ["Smoke"] }}
        onFilters={() => {}}
        onUndo={() => {}}
        canUndo
        flagId={"family\nSmoke"}
      >
        <p>the grid</p>
      </DramSummary>,
    );
    expect(html).toContain("recovery");
    expect(html).toContain("Most constraining");
    const undo = html.match(/<button[^>]*>Undo last<\/button>/)?.[0] ?? "";
    expect(undo).not.toContain("disabled");
  });
});

describe("PickADram persistence", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("opens on the saved place", () => {
    saveDramSelection({ filters: emptyFilters(), place: "house", includeOpen: true, includeClosed: false });
    const html = renderToStaticMarkup(
      <PickADram bottles={[]} filters={emptyFilters()} onFilters={() => {}} />,
    );
    expect(html).toContain("Randomizer · house");
    expect(html).not.toContain("Are you at the apartment or the house?");
  });

  it("asks where you are when nothing is saved", () => {
    const html = renderToStaticMarkup(
      <PickADram bottles={[]} filters={emptyFilters()} onFilters={() => {}} />,
    );
    expect(html).toContain("Are you at the apartment or the house?");
  });
});
