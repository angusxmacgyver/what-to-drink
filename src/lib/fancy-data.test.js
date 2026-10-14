import { describe, expect, it } from "vitest";
import {
  buildEntries,
  consumePool,
  describe as reveal,
  entryForBottle,
  pickBottle,
} from "../../public/fancy/js/data.js";

const bottle = (overrides = {}) => ({
  id: "open",
  bottleKey: "ardbeg::10",
  distillery: "Ardbeg",
  bottling: "10",
  status: "Open",
  age: 10,
  abv: 46,
  region: "Islay",
  flavorFamilies: ["Smoke"],
  ...overrides,
});

describe("fancy picker data", () => {
  it("consumes a staged pool once and rejects non-pourable entries", () => {
    let stored = JSON.stringify({
      version: 1,
      bottles: [bottle(), bottle({ id: "killed", status: "Killed" })],
    });
    const storage = {
      getItem: () => stored,
      removeItem: () => {
        stored = null;
      },
    };
    expect(consumePool(storage).map(({ id }) => id)).toEqual(["open"]);
    expect(stored).toBeNull();
    expect(consumePool(storage)).toEqual([]);
  });

  it("groups wheel labels by expression while preserving physical-bottle picks", () => {
    const stock = [bottle(), bottle({ id: "closed", status: "Closed" })];
    expect(buildEntries(stock)).toHaveLength(1);
    expect(entryForBottle(stock, stock[1]).primary.id).toBe("closed");
  });

  it("avoids the previous physical bottle when another ticket exists", () => {
    const stock = [bottle(), bottle({ id: "other", bottleKey: "lagavulin::16" })];
    const first = pickBottle(stock, null);
    expect(pickBottle(stock, first.id).id).not.toBe(first.id);
    expect(pickBottle([stock[0]], stock[0].id).id).toBe("open");
  });

  it("describes a distillery pour with flavor labels and a find line", () => {
    const open = bottle({
      location: "Shelf A & B",
      theme: "Peat smoke",
      tastingNotes: "Ash and lemon.",
      notes: "A house bottle.",
      country: "Scotland",
    });
    const stock = [open, bottle({ id: "sealed", status: "Closed" })];
    const info = reveal(entryForBottle(stock, open));

    expect(info.eyebrow).toBe("Tonight, pour");
    expect(info.title).toBe("Ardbeg");
    expect(info.subtitle).toBe("10");
    expect(info.meta).toEqual(["Islay", "10 years", "46% ABV"]);
    expect(info.theme).toBe("Peat smoke");
    expect(info.notes).toBe("Ash and lemon.");
    expect(info.about).toBe("A house bottle.");
    expect(info.flavors).toEqual(["Smoky"]);
    expect(info.location).toBe("Shelf A & B");
    expect(info.find).toBe(
      "Find it · <strong>Shelf A &amp; B</strong>&ensp;·&ensp;1 more sealed in reserve",
    );
  });

  it("names a Society cask and says when a sealed bottle must be cracked", () => {
    const sealed = bottle({
      id: "cask",
      bottleKey: "smws::29.284",
      distillery: "",
      bottling: "29.284",
      status: "Closed",
      age: 0,
      abv: 57.1,
      region: "Islay, Scotland",
      country: "Scotland",
      atApartment: true,
      flavorFamilies: ["Fruit (Fresh)", "Unlisted"],
      smws: { fullCode: "29.284", nameIntl: "29.284 — Lemon smoke", vintage: "2008", flavorProfile: "Young & Feisty" },
    });
    const entry = entryForBottle([sealed], sealed);
    const info = reveal(entry);

    expect(entry.isSmws).toBe(true);
    expect(entry.title).toBe("Lemon smoke");
    expect(entry.subtitle).toBe("SMWS Cask No. 29.284");
    expect(entry.wheelTitle).toBe("SMWS 29.284");
    expect(entry.wheelSub).toBe("Lemon smoke");
    expect(info.eyebrow).toBe("Tonight, from the Society");
    expect(info.meta).toEqual(["Islay", "No age statement", "57.1% ABV", "Distilled 2008"]);
    expect(info.theme).toBe("Young & Feisty");
    expect(info.flavors).toEqual(["Fresh fruit", "Unlisted"]);
    expect(info.find).toBe(
      "Find it · <strong>Apartment</strong>&ensp;·&ensp;Sealed — tonight you crack it",
    );
  });

  it("falls back to a Society label when a non-cask bottle has no name", () => {
    const sealed = bottle({
      distillery: "",
      bottling: "Batch 12",
      country: "Japan",
      smws: { fullCode: "Batch 12", nameIntl: "" },
    });
    const entry = buildEntries([sealed])[0];

    expect(entry.title).toBe("Batch 12");
    expect(entry.subtitle).toBe("Scotch Malt Whisky Society");
    expect(entry.wheelTitle).toBe("Batch 12");
    expect(entry.wheelSub).toBe("SMWS");
    expect(reveal(entry).meta).toContain("Japan");
  });
});
