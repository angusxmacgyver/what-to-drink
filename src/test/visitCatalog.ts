import type { Bottle, Catalog } from "../types";

export function visitBottle(overrides: Partial<Bottle> & Pick<Bottle, "id">): Bottle {
  return {
    bottleKey: `key-${overrides.id}`,
    distillery: "Distillery",
    bottling: "Expression",
    age: 12,
    abv: 46,
    status: "Open",
    notes: "",
    tastingNotes: "",
    location: "House shelf",
    region: "Islay",
    theme: "",
    flavorFamilies: [],
    subCharacteristics: [],
    atApartment: false,
    country: "Scotland",
    dateEmptied: "",
    smws: null,
    ...overrides,
  };
}

export const visitCatalog: Catalog = {
  schemaVersion: 1,
  importedAt: "2026-01-01T00:00:00.000Z",
  bottles: [
    visitBottle({
      id: "house-smoke",
      bottleKey: "ardbeg::10",
      distillery: "Ardbeg",
      bottling: "10",
      flavorFamilies: ["Smoke"],
      subCharacteristics: ["Woodsmoke & Campfire"],
    }),
    visitBottle({
      id: "house-sweet",
      bottleKey: "glendronach::12",
      distillery: "Glendronach",
      bottling: "12",
      flavorFamilies: ["Sweet"],
    }),
    visitBottle({
      id: "house-both",
      bottleKey: "highland::both",
      distillery: "Highland Both",
      bottling: "Dual",
      flavorFamilies: ["Smoke", "Sweet"],
    }),
    visitBottle({
      id: "apt-smoke",
      bottleKey: "apt::smoke",
      distillery: "Apartment Smoke",
      bottling: "Flat",
      location: "Apartment",
      atApartment: true,
      flavorFamilies: ["Smoke"],
    }),
    visitBottle({
      id: "house-closed",
      bottleKey: "closed::backup",
      distillery: "Closed Backup",
      bottling: "Backup",
      status: "Closed",
      flavorFamilies: ["Smoke"],
    }),
  ],
  graveyard: [],
};
