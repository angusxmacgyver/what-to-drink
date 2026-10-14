import { describe, expect, it } from "vitest";
import {
  buildEntries,
  consumePool,
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
  });

  it("groups wheel labels by expression while preserving physical-bottle picks", () => {
    const stock = [bottle(), bottle({ id: "closed", status: "Closed" })];
    expect(buildEntries(stock)).toHaveLength(1);
    expect(entryForBottle(stock, stock[1]).primary.id).toBe("closed");
  });

  it("avoids the previous physical bottle when another ticket exists", () => {
    const stock = [bottle(), bottle({ id: "other", bottleKey: "lagavulin::16" })];
    expect(pickBottle(stock, "open").id).toBe("other");
  });
});
