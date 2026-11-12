import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyFilters, type Bottle, type FilterState } from "../types";
import { Filters } from "./Filters";

function bottle(overrides: Partial<Bottle>): Bottle {
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

const bottles = [
  bottle({ id: "islay-low", lastThird: true }),
  bottle({ id: "islay-full" }),
  bottle({ id: "speyside-low", region: "Speyside", lastThird: true }),
  bottle({ id: "closed", status: "Closed" }),
];

function statusChips(filters: FilterState): string[] {
  const html = renderToStaticMarkup(
    <Filters bottles={bottles} filters={filters} onChange={() => {}} exact={false} showStatus showGeo />,
  );
  const section = html.slice(html.indexOf(">Status<"), html.indexOf(">SMWS Theme<"));
  return [...section.matchAll(/aria-pressed="(true|false)">([^<]+)<span class="option-count">(\d+)</g)].map(
    ([, on, label, count]) => `${label} ${count}${on === "true" ? " on" : ""}`,
  );
}

describe("Status filters", () => {
  it("offers Last third after the statuses, counting the last-third bottles showing", () => {
    expect(statusChips(emptyFilters())).toEqual(["Closed 1", "Open 3", "Last third 2"]);
    expect(statusChips({ ...emptyFilters(), regions: ["Islay"] })).toEqual(["Closed 1", "Open 2", "Last third 1"]);
  });

  it("marks Last third on when it is applied", () => {
    expect(statusChips({ ...emptyFilters(), lastThird: true })).toEqual(["Closed 0", "Open 2", "Last third 2 on"]);
  });
});
