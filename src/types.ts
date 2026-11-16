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
  primaryCask: string[];
  secondaryCask: string[];
  atApartment: boolean;
  country: string;
  dateEmptied: string;
  smws: SmwsExtras | null;
  /** Commit time of each dram, oldest first. The dram count is its length. Empty in the graveyard. */
  drams: string[];
  lastThird: boolean;
  /** On a graveyard bottle: whether a kill shot finished it. */
  killShot: boolean;
};

export type RecentPour = {
  bottleId: string;
  at: string;
  killShot: boolean;
};

export const RECENTLY_POURED_LIMIT = 25;

export const isRecentPour = (value: unknown): value is RecentPour => {
  const line = value as RecentPour | null;
  return (
    typeof line === "object" &&
    line !== null &&
    typeof line.bottleId === "string" &&
    typeof line.at === "string" &&
    typeof line.killShot === "boolean"
  );
};

export type WheelSubgroup = { name: string; descriptors: string[] };

/** A Family of the Flavor Wheel, with its color name as written in the Wheel Glossary. */
export type WheelFamily = { name: string; color: string; subgroups: WheelSubgroup[] };

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isWheelSubgroup = (value: unknown): value is WheelSubgroup => {
  const subgroup = value as WheelSubgroup | null;
  return typeof subgroup === "object" && subgroup !== null && typeof subgroup.name === "string" && isStringList(subgroup.descriptors);
};

export const isWheelFamily = (value: unknown): value is WheelFamily => {
  const family = value as WheelFamily | null;
  return (
    typeof family === "object" &&
    family !== null &&
    typeof family.name === "string" &&
    typeof family.color === "string" &&
    Array.isArray(family.subgroups) &&
    family.subgroups.every(isWheelSubgroup)
  );
};

export type Catalog = {
  schemaVersion: 1;
  importedAt: string;
  bottles: Bottle[];
  graveyard: Bottle[];
  /** Newest first, at most RECENTLY_POURED_LIMIT. */
  recentlyPoured: RecentPour[];
  /** The Flavor Wheel, in the Wheel Glossary's order. Empty when no wheel has been imported. */
  wheel: WheelFamily[];
};

export type FilterState = {
  search: string;
  /** None shows both places. */
  place: "house" | "apartment" | null;
  distilleries: string[];
  themes: string[];
  statuses: string[];
  /** Narrows to last-third bottles, whatever statuses are picked. */
  lastThird: boolean;
  ageMin: string;
  ageMax: string;
  includeNas: boolean;
  abvMin: string;
  abvMax: string;
  families: string[];
  subs: string[];
  subFamilies: Record<string, string>;
  countries: string[];
  regions: string[];
};

export const emptyFilters = (): FilterState => ({
  search: "",
  place: null,
  distilleries: [],
  themes: [],
  statuses: [],
  lastThird: false,
  ageMin: "",
  ageMax: "",
  includeNas: true,
  abvMin: "",
  abvMax: "",
  families: [],
  subs: [],
  subFamilies: {},
  countries: [],
  regions: [],
});
