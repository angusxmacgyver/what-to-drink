export type Age = number | "NAS" | null;

export type BottleStatus = "Open" | "Closed" | "empty" | "Killed";

export type SmwsExtras = {
  fullCode: string;
  distilleryNo: string;
  caskNo: string;
  flavorProfile: string;
  smwsCask: string;
  secondaryMaturation: string;
  nameIntl: string;
  vintage: string;
  smwsUrl: string;
};

export type Bottle = {
  id: string;
  bottleKey: string;
  distillery: string;
  bottling: string;
  age: Age;
  abv: number | null;
  status: BottleStatus;
  notes: string;
  tastingNotes: string;
  location: string;
  region: string;
  theme: string;
  flavorFamilies: string[];
  subCharacteristics: string[];
  atApartment: boolean;
  country: string;
  dateEmptied: string;
  smws: SmwsExtras | null;
};

export type Catalog = {
  schemaVersion: 1;
  importedAt: string;
  bottles: Bottle[];
  graveyard: Bottle[];
};

export type FilterState = {
  search: string;
  distilleries: string[];
  themes: string[];
  statuses: string[];
  ageMin: string;
  ageMax: string;
  includeNas: boolean;
  abvMin: string;
  abvMax: string;
  families: string[];
  subs: string[];
  subFamilies: Record<string, string>;
  /** How picked flavor families combine, and how picked sub-characteristics combine. */
  flavorMatch: "any" | "all";
  countries: string[];
  regions: string[];
};

export const emptyFilters = (): FilterState => ({
  search: "",
  distilleries: [],
  themes: [],
  statuses: [],
  ageMin: "",
  ageMax: "",
  includeNas: true,
  abvMin: "",
  abvMax: "",
  families: [],
  subs: [],
  subFamilies: {},
  flavorMatch: "all",
  countries: [],
  regions: [],
});
