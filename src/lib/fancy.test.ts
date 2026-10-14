import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Bottle } from "../types";
import { FANCY_POOL_KEY, stageFancyPool } from "./fancy";

describe("stageFancyPool", () => {
  const setItem = vi.fn();

  beforeEach(() => {
    setItem.mockReset();
    vi.stubGlobal("sessionStorage", { setItem });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("stages exactly the filtered physical bottles for the fancy picker", () => {
    const bottles = [
      { id: "open", bottleKey: "ardbeg::10", status: "Open" },
      { id: "closed", bottleKey: "ardbeg::10", status: "Closed" },
    ] as Bottle[];

    stageFancyPool(bottles);

    expect(setItem).toHaveBeenCalledWith(
      FANCY_POOL_KEY,
      JSON.stringify({ version: 1, bottles }),
    );
  });
});
