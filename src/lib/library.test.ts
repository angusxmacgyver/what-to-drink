import { describe, expect, it } from "vitest";
import { emptyFilters, type Bottle } from "../types";
import {
  detailBottle,
  distilleryCounts,
  groupDistilleries,
  groupLibrary,
  matchesFilters,
  matchesStatus,
  optionCounts,
  originLabel,
  subOwnerFamily,
  subsForFamilies,
  withoutRange,
} from "./library";

let nextId = 0;

function bottle(overrides: Partial<Bottle> = {}): Bottle {
  nextId += 1;
  return {
    id: `id-${nextId}`,
    bottleKey: "ardbeg::10",
    distillery: "Ardbeg",
    bottling: "10",
    age: 10,
    abv: 46,
    status: "Open",
    notes: "",
    tastingNotes: "",
    location: "",
    region: "Islay",
    theme: "",
    flavorFamilies: [],
    subCharacteristics: [],
    primaryCask: [],
    secondaryCask: [],
    atApartment: false,
    country: "Scotland",
    dateEmptied: "",
    smws: null,
    drams: [],
    lastThird: false,
    killShot: false,
    ...overrides,
  };
}

describe("subsForFamilies", () => {
  const bottles = [
    bottle({ flavorFamilies: ["Peaty", "Fruity"], subCharacteristics: ["Smoke", "Apple"] }),
    bottle({ flavorFamilies: ["Peaty"], subCharacteristics: ["Tar", "Smoke"] }),
    bottle({ flavorFamilies: ["Fruity"], subCharacteristics: ["Pear", ""] }),
  ];

  it("returns nothing when no family is picked", () => {
    expect(subsForFamilies(bottles, [])).toEqual([]);
  });

  it("lists sorted, unique subs from bottles with the family", () => {
    expect(subsForFamilies(bottles, ["Peaty"])).toEqual(["Apple", "Smoke", "Tar"]);
  });

  it("requires every picked family on the bottle", () => {
    expect(subsForFamilies(bottles, ["Peaty", "Fruity"])).toEqual(["Apple", "Smoke"]);
  });

  it("drops blank subs", () => {
    expect(subsForFamilies(bottles, ["Fruity"])).toEqual(["Apple", "Pear", "Smoke"]);
  });

  it("narrows to subs owned by the picked family, even if the bottle has other tagged subs", () => {
    const owned = [
      bottle({
        flavorFamilies: ["Wood", "Sweet"],
        subCharacteristics: ["Toasted & Charred Oak", "Honey"],
      }),
    ];
    expect(subsForFamilies(owned, ["Wood"])).toEqual(["Toasted & Charred Oak"]);
  });

  it("includes subs owned by any of several picked families", () => {
    const owned = [
      bottle({
        flavorFamilies: ["Wood", "Smoke", "Sweet"],
        subCharacteristics: ["Toasted & Charred Oak", "Woodsmoke & Campfire", "Honey"],
      }),
    ];
    expect(subsForFamilies(owned, ["Wood", "Smoke"])).toEqual(["Toasted & Charred Oak", "Woodsmoke & Campfire"]);
  });

  it("keeps a sub with no curated owner visible regardless of which family is picked", () => {
    const uncurated = [bottle({ flavorFamilies: ["Wood"], subCharacteristics: ["Brand New Tag"] })];
    expect(subsForFamilies(uncurated, ["Wood"])).toEqual(["Brand New Tag"]);
  });
});

describe("subOwnerFamily", () => {
  it("returns the curated family for a known sub-characteristic", () => {
    expect(subOwnerFamily("Woodsmoke & Campfire")).toBe("Smoke");
    expect(subOwnerFamily("Honey")).toBe("Sweet");
  });

  it("returns undefined for an uncurated sub-characteristic", () => {
    expect(subOwnerFamily("Brand New Tag")).toBeUndefined();
  });
});

describe("distilleryCounts", () => {
  it("counts physical bottles per distillery", () => {
    const bottles = [
      bottle({ distillery: "Ardbeg" }),
      bottle({ distillery: "Ardbeg" }),
      bottle({ distillery: "Lagavulin" }),
    ];
    expect(distilleryCounts(bottles)).toEqual({ Ardbeg: 2, Lagavulin: 1 });
  });
});

describe("matchesStatus", () => {
  it("keeps every bottle when no status is picked", () => {
    expect(matchesStatus(bottle({ status: "Closed" }), [])).toBe(true);
  });

  it("keeps only bottles with a picked status", () => {
    expect(matchesStatus(bottle({ status: "Open" }), ["Open"])).toBe(true);
    expect(matchesStatus(bottle({ status: "Closed" }), ["Open"])).toBe(false);
    expect(matchesStatus(bottle({ status: "Closed" }), ["Open", "Closed"])).toBe(true);
  });

  it("matches nothing for two statuses under Match exactly", () => {
    expect(matchesStatus(bottle({ status: "Open" }), ["Open", "Closed"], true)).toBe(false);
    expect(matchesStatus(bottle({ status: "Open" }), ["Open"], true)).toBe(true);
  });
});

describe("matchesFilters place", () => {
  const house = bottle({ atApartment: false });
  const apartment = bottle({ atApartment: true });

  it("keeps bottles at both places when no place is chosen", () => {
    expect(matchesFilters(house, emptyFilters())).toBe(true);
    expect(matchesFilters(apartment, emptyFilters())).toBe(true);
  });

  it("keeps only the chosen place's bottles", () => {
    const atHouse = { ...emptyFilters(), place: "house" as const };
    const atApartment = { ...emptyFilters(), place: "apartment" as const };
    expect(matchesFilters(house, atHouse)).toBe(true);
    expect(matchesFilters(apartment, atHouse)).toBe(false);
    expect(matchesFilters(house, atApartment)).toBe(false);
    expect(matchesFilters(apartment, atApartment)).toBe(true);
  });
});

describe("matchesFilters ABV", () => {
  const filters = { ...emptyFilters(), abvMin: "40", abvMax: "50" };

  it("keeps a blank ABV and the bottles on the ends of the range", () => {
    expect(matchesFilters(bottle({ abv: null }), filters)).toBe(true);
    expect(matchesFilters(bottle({ abv: 40 }), filters)).toBe(true);
    expect(matchesFilters(bottle({ abv: 50 }), filters)).toBe(true);
    expect(matchesFilters(bottle({ abv: 55.3 }), filters)).toBe(false);
  });
});

describe("matchesFilters age", () => {
  it("keeps every age when the range is unset and NAS is on", () => {
    const filters = emptyFilters();
    expect(matchesFilters(bottle({ age: "NAS" }), filters)).toBe(true);
    expect(matchesFilters(bottle({ age: null }), filters)).toBe(true);
    expect(matchesFilters(bottle({ age: 12 }), filters)).toBe(true);
  });

  it("keeps NAS and blank ages inside a narrowed range while NAS stays on", () => {
    const filters = { ...emptyFilters(), ageMin: "12", ageMax: "18" };
    expect(matchesFilters(bottle({ age: "NAS" }), filters)).toBe(true);
    expect(matchesFilters(bottle({ age: null }), filters)).toBe(true);
    expect(matchesFilters(bottle({ age: 12 }), filters)).toBe(true);
    expect(matchesFilters(bottle({ age: 18 }), filters)).toBe(true);
    expect(matchesFilters(bottle({ age: 10 }), filters)).toBe(false);
  });

  it("drops NAS and blank ages when the toggle is off, and still keeps numeric ages in range", () => {
    const narrowed = { ...emptyFilters(), ageMin: "12", ageMax: "18", includeNas: false };
    expect(matchesFilters(bottle({ age: "NAS" }), narrowed)).toBe(false);
    expect(matchesFilters(bottle({ age: null }), narrowed)).toBe(false);
    expect(matchesFilters(bottle({ age: 12 }), narrowed)).toBe(true);
    expect(matchesFilters(bottle({ age: 21 }), narrowed)).toBe(false);

    const nasOff = { ...emptyFilters(), includeNas: false };
    expect(matchesFilters(bottle({ age: "NAS" }), nasOff)).toBe(false);
    expect(matchesFilters(bottle({ age: null }), nasOff)).toBe(false);
    expect(matchesFilters(bottle({ age: 12 }), nasOff)).toBe(true);
  });
});

describe("groupLibrary", () => {
  it("groups bottles sharing a bottleKey into one row with stock", () => {
    const bottles = Array.from({ length: 5 }, () => bottle({ bottleKey: "ardbeg::cask-strength-10" }));
    const rows = groupLibrary(bottles);
    expect(rows).toHaveLength(1);
    expect(rows[0].stock).toBe(5);
  });

  it("sorts rows by distillery, then bottling", () => {
    const rows = groupLibrary([
      bottle({ bottleKey: "lagavulin::16", distillery: "Lagavulin", bottling: "16" }),
      bottle({ bottleKey: "ardbeg::uigeadail", distillery: "Ardbeg", bottling: "Uigeadail" }),
      bottle({ bottleKey: "ardbeg::10", distillery: "Ardbeg", bottling: "10" }),
    ]);
    expect(rows.map((r) => r.bottleKey)).toEqual(["ardbeg::10", "ardbeg::uigeadail", "lagavulin::16"]);
  });

  it("labels age and ABV as mixed when bottles in a row differ", () => {
    const [row] = groupLibrary([bottle({ age: 10, abv: 46 }), bottle({ age: 12, abv: 57.1 })]);
    expect(row.ageLabel).toBe("mixed");
    expect(row.abvLabel).toBe("mixed");
  });
});

describe("groupDistilleries", () => {
  it("keeps row order and reports expression and bottle counts", () => {
    const rows = groupLibrary([
      bottle({ id: "ardbeg-open", bottleKey: "ardbeg::10", distillery: "Ardbeg", bottling: "10" }),
      bottle({ id: "ardbeg-closed", bottleKey: "ardbeg::10", distillery: "Ardbeg", bottling: "10" }),
      bottle({ id: "ardbeg-oogie", bottleKey: "ardbeg::oogie", distillery: "Ardbeg", bottling: "Uigeadail" }),
      bottle({ id: "lagavulin", bottleKey: "lagavulin::16", distillery: "Lagavulin", bottling: "16" }),
    ]);

    const groups = groupDistilleries(rows);

    expect(groups.map((group) => group.distillery)).toEqual(["Ardbeg", "Lagavulin"]);
    expect(groups[0].rows.map((row) => row.bottling)).toEqual(["10", "Uigeadail"]);
    expect(groups[0].expressionCount).toBe(2);
    expect(groups[0].bottleCount).toBe(3);
    expect(groups[1].expressionCount).toBe(1);
    expect(groups[1].bottleCount).toBe(1);
  });
});

describe("originLabel", () => {
  it("shows region and country once when they are the same", () => {
    expect(originLabel("Japan", "Japan")).toBe("Japan");
  });

  it("shows both when they differ", () => {
    expect(originLabel("Islay", "Scotland")).toBe("Islay · Scotland");
  });

  it("shows whichever side is present", () => {
    expect(originLabel("Islay", " ")).toBe("Islay");
    expect(originLabel("", "USA")).toBe("USA");
  });
});

function lastThirdCellar() {
  const islayLow = bottle({ region: "Islay", lastThird: true });
  const islayFull = bottle({ region: "Islay" });
  const speysideLow = bottle({ region: "Speyside", lastThird: true });
  return { islayLow, speysideLow, all: [islayLow, islayFull, speysideLow] };
}

describe("matchesFilters last third", () => {
  const { islayLow, speysideLow, all } = lastThirdCellar();

  it("keeps every bottle while Last third is off", () => {
    expect(all.filter((b) => matchesFilters(b, emptyFilters()))).toEqual(all);
  });

  it("keeps only bottles whose last-third flag is on", () => {
    const filters = { ...emptyFilters(), lastThird: true };
    expect(all.filter((b) => matchesFilters(b, filters))).toEqual([islayLow, speysideLow]);
  });

  it("combines with another filter, so Islay plus Last third is last-third Islay bottles", () => {
    const filters = { ...emptyFilters(), regions: ["Islay"], lastThird: true };
    expect(all.filter((b) => matchesFilters(b, filters))).toEqual([islayLow]);
    expect(all.filter((b) => matchesFilters(b, filters, true))).toEqual([islayLow]);
  });

  it("narrows a picked status instead of standing in for one", () => {
    const closed = bottle({ status: "Closed" });
    const open = { ...emptyFilters(), statuses: ["Open"], lastThird: true };
    expect([...all, closed].filter((b) => matchesFilters(b, open))).toEqual([islayLow, speysideLow]);
    expect([...all, closed].filter((b) => matchesFilters(b, open, true))).toEqual([islayLow, speysideLow]);
    expect([...all, closed].filter((b) => matchesFilters(b, { ...open, statuses: ["Closed"] }))).toEqual([]);
  });
});

describe("matchesFilters exact", () => {
  const smoky = bottle({ distillery: "Ardbeg", abv: 55, flavorFamilies: ["Smoke"] });
  const fruity = bottle({ distillery: "Ardbeg", abv: 55, flavorFamilies: ["Fruit (Fresh)"] });
  const both = bottle({ distillery: "Ardbeg", abv: 46, flavorFamilies: ["Smoke", "Fruit (Fresh)"] });
  const other = bottle({ distillery: "Lagavulin", abv: 55, flavorFamilies: ["Smoke"] });

  it("treats choices within a category as alternatives when off", () => {
    const filters = { ...emptyFilters(), families: ["Smoke", "Fruit (Fresh)"], distilleries: ["Ardbeg", "Lagavulin"] };
    expect([smoky, fruity, both, other].filter((b) => matchesFilters(b, filters, false))).toEqual([
      smoky,
      fruity,
      both,
      other,
    ]);
  });

  it("requires every selected choice when on", () => {
    const families = { ...emptyFilters(), families: ["Smoke", "Fruit (Fresh)"] };
    expect([smoky, fruity, both, other].filter((b) => matchesFilters(b, families, true))).toEqual([both]);

    const combined = { ...emptyFilters(), distilleries: ["Ardbeg"], families: ["Smoke"], abvMin: "48" };
    expect([smoky, fruity, both, other].filter((b) => matchesFilters(b, combined, true))).toEqual([smoky]);
  });

  it("matches nothing for two choices in a one-value category when on", () => {
    const filters = { ...emptyFilters(), distilleries: ["Ardbeg", "Lagavulin"] };
    expect([smoky, other].filter((b) => matchesFilters(b, filters, true))).toEqual([]);
  });
});

describe("optionCounts", () => {
  it("returns zero for an option no bottle has", () => {
    expect(optionCounts([bottle({ distillery: "Ardbeg" })], emptyFilters(), "distillery", ["Bowmore"])).toEqual({
      Bowmore: 0,
    });
  });

  it("counts a few thousand bottles inside the time budget", () => {
    const bottles = Array.from({ length: 2000 }, (_, index) =>
      bottle({
        distillery: index % 2 === 0 ? "Ardbeg" : "Lagavulin",
        region: "Islay",
      }),
    );
    const started = performance.now();
    const counts = optionCounts(bottles, emptyFilters(), "distillery", ["Ardbeg", "Lagavulin", "Bowmore"]);
    expect(performance.now() - started).toBeLessThan(100);
    expect(counts).toEqual({ Ardbeg: 1000, Lagavulin: 1000, Bowmore: 0 });
  });

  it("counts any bottles it is given, whatever their place or status", () => {
    const house = bottle({ distillery: "Ardbeg", region: "Islay", theme: "Peated" });
    const apartment = bottle({ distillery: "Lagavulin", region: "Islay", theme: "Peated", atApartment: true });
    const closed = bottle({ distillery: "Bowmore", region: "Islay", theme: "Peated", status: "Closed" });
    const killed = bottle({ distillery: "Laphroaig", region: "Islay", theme: "Peated", status: "Killed" });
    const sweet = bottle({ distillery: "Glenfiddich", region: "Speyside", theme: "Sweet" });
    const filters = { ...emptyFilters(), regions: ["Speyside"], themes: ["Peated"] };
    expect(
      optionCounts([house, apartment, closed, killed, sweet], filters, "region", ["Islay", "Speyside"]),
    ).toEqual({ Islay: 4, Speyside: 0 });
  });

  it("counts what adding an option would leave under Match exactly", () => {
    const smoky = bottle({ distillery: "Ardbeg", region: "Islay", flavorFamilies: ["Smoke"] });
    const both = bottle({ distillery: "Ardbeg", region: "Islay", flavorFamilies: ["Smoke", "Sweet"] });
    const sweet = bottle({ distillery: "Glenfiddich", region: "Speyside", flavorFamilies: ["Sweet"] });
    const all = [smoky, both, sweet];
    const smoke = { ...emptyFilters(), families: ["Smoke"] };
    expect(optionCounts(all, smoke, "family", ["Smoke", "Sweet"], true)).toEqual({ Smoke: 2, Sweet: 1 });
    expect(optionCounts(all, smoke, "family", ["Smoke", "Sweet"], false)).toEqual({ Smoke: 2, Sweet: 2 });

    const twoDistilleries = { ...emptyFilters(), distilleries: ["Ardbeg", "Glenfiddich"] };
    expect(optionCounts(all, twoDistilleries, "distillery", ["Ardbeg", "Glenfiddich"], true)).toEqual({
      Ardbeg: 0,
      Glenfiddich: 0,
    });
    expect(optionCounts(all, twoDistilleries, "region", ["Islay", "Speyside"], true)).toEqual({ Islay: 0, Speyside: 0 });
  });

  it("counts within the chosen Place, and counts each Place as a replacement", () => {
    const house = bottle({ region: "Islay" });
    const apartment = bottle({ region: "Islay", atApartment: true });
    const atHouse = { ...emptyFilters(), place: "house" as const };
    expect(optionCounts([house, apartment], atHouse, "region", ["Islay"], false)).toEqual({ Islay: 1 });
    expect(optionCounts([house, apartment], atHouse, "place", ["house", "apartment"], true)).toEqual({
      house: 1,
      apartment: 1,
    });
  });

  it("counts the last-third bottles the other filters leave, whether or not Last third is on", () => {
    const { all } = lastThirdCellar();
    const islay = { ...emptyFilters(), regions: ["Islay"] };
    for (const exact of [false, true]) {
      expect(optionCounts(all, islay, "lastThird", ["Last third"], exact)).toEqual({ "Last third": 1 });
      expect(optionCounts(all, { ...islay, lastThird: true }, "lastThird", ["Last third"], exact)).toEqual({
        "Last third": 1,
      });
    }
    expect(optionCounts(all, emptyFilters(), "lastThird", ["Last third"])).toEqual({ "Last third": 2 });
  });

  it("counts statuses, which a bottle has only one of", () => {
    const open = bottle({ status: "Open" });
    const closed = bottle({ status: "Closed" });
    const onlyOpen = { ...emptyFilters(), statuses: ["Open"] };
    expect(optionCounts([open, closed], onlyOpen, "status", ["Open", "Closed"], false)).toEqual({ Open: 1, Closed: 1 });
    expect(optionCounts([open, closed], onlyOpen, "status", ["Open", "Closed"], true)).toEqual({ Open: 1, Closed: 0 });
  });
});

describe("withoutRange", () => {
  const smoky12 = bottle({ age: 12, abv: 46, flavorFamilies: ["Smoke"] });
  const smoky25 = bottle({ age: 25, abv: 58, flavorFamilies: ["Smoke"] });
  const smokyNas = bottle({ age: "NAS", abv: 50, flavorFamilies: ["Smoke"] });
  const sweet18 = bottle({ age: 18, abv: 43, flavorFamilies: ["Sweet"] });
  const all = [smoky12, smoky25, smokyNas, sweet18];
  const filters = {
    ...emptyFilters(),
    families: ["Smoke"],
    ageMin: "10",
    ageMax: "14",
    includeNas: false,
    abvMin: "44",
    abvMax: "48",
  };

  it("keeps bottles outside the age brush and NAS, and drops what another facet excludes", () => {
    const pool = all.filter((b) => matchesFilters(b, withoutRange(filters, "age")));
    expect(pool).toEqual([smoky12]);
    const loose = { ...filters, abvMin: "", abvMax: "" };
    expect(all.filter((b) => matchesFilters(b, withoutRange(loose, "age")))).toEqual([smoky12, smoky25, smokyNas]);
  });

  it("lifts only the ABV range for the ABV histogram", () => {
    const pool = all.filter((b) => matchesFilters(b, withoutRange(filters, "abv")));
    expect(pool).toEqual([smoky12]);
    const anyAge = { ...filters, ageMin: "", ageMax: "", includeNas: true };
    expect(all.filter((b) => matchesFilters(b, withoutRange(anyAge, "abv")))).toEqual([smoky12, smoky25, smokyNas]);
  });
});

describe("matchesFilters search", () => {
  it('matches a bottle whose primary cask includes the search term', () => {
    const sherry = bottle({ primaryCask: ["Oloroso sherry"] });
    const filters = { ...emptyFilters(), search: "oloroso" };
    expect(matchesFilters(sherry, filters)).toBe(true);
  });

  it('matches a bottle whose secondary cask includes the search term', () => {
    const finished = bottle({ secondaryCask: ["Oloroso sherry"] });
    const filters = { ...emptyFilters(), search: "oloroso" };
    expect(matchesFilters(finished, filters)).toBe(true);
  });

  it('does not match a bottle that mentions the cask only in notes', () => {
    const notesOnly = bottle({ notes: "Finished in Oloroso" });
    const filters = { ...emptyFilters(), search: "oloroso" };
    expect(matchesFilters(notesOnly, filters)).toBe(false);
  });

  it('still matches distillery, bottling, and SMWS fields', () => {
    const byDistillery = bottle({ distillery: "Glenmorangie", bottling: "Original" });
    const byBottling = bottle({ distillery: "Macallan", bottling: "Sherry Oak" });
    const byCode = bottle({
      distillery: "SMWS",
      bottling: "Cask Strength",
      smws: {
        fullCode: "53.123",
        nameIntl: "Fruity punch",
        distilleryNo: "",
        caskNo: "",
        flavorProfile: "",
        smwsCask: "",
        secondaryMaturation: "",
        vintage: "",
        smwsUrl: "",
      },
    });
    const bySmwsName = bottle({
      distillery: "SMWS",
      bottling: "Batch",
      smws: {
        fullCode: "99.1",
        nameIntl: "Oloroso elegance",
        distilleryNo: "",
        caskNo: "",
        flavorProfile: "",
        smwsCask: "",
        secondaryMaturation: "",
        vintage: "",
        smwsUrl: "",
      },
    });
    expect(matchesFilters(byDistillery, { ...emptyFilters(), search: "glenmorangie" })).toBe(true);
    expect(matchesFilters(byBottling, { ...emptyFilters(), search: "sherry oak" })).toBe(true);
    expect(matchesFilters(byCode, { ...emptyFilters(), search: "53.123" })).toBe(true);
    expect(matchesFilters(bySmwsName, { ...emptyFilters(), search: "oloroso" })).toBe(true);
  });
});

describe("detailBottle", () => {
  it("uses the first Open bottle when one exists", () => {
    const closed = bottle({ id: "closed", status: "Closed" });
    const open = bottle({ id: "open", status: "Open" });
    const later = bottle({ id: "later", status: "Open" });
    expect(detailBottle([closed, open, later]).id).toBe("open");
  });

  it("uses the first bottle when none are Open", () => {
    const first = bottle({ id: "first", status: "Closed" });
    const second = bottle({ id: "second", status: "Closed" });
    expect(detailBottle([first, second]).id).toBe("first");
  });
});
