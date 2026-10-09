import { describe, expect, it } from "vitest";
import { cardTransitionName, choosePour, leadBottle, settlePick } from "./pour";

describe("cardTransitionName", () => {
  it("makes a valid ident and keeps distinct keys distinct", () => {
    expect(cardTransitionName("ardbeg::cask-strength-10")).toBe("card-ardbeg_3a__3a_cask-strength-10");
    expect(cardTransitionName("smws::1.246::a-one")).toMatch(/^card-[a-zA-Z0-9_-]+$/);
    expect(cardTransitionName("a::b")).not.toBe(cardTransitionName("a-:b"));
    expect(cardTransitionName("a_b")).not.toBe(cardTransitionName("a-b"));
  });
});

const a = { id: "a" };
const b = { id: "b" };
const c = { id: "c" };

describe("choosePour", () => {
  it("skips the last bottle while another can be poured", () => {
    expect(choosePour([a, b], "a", () => 0)).toBe(b);
    expect(choosePour([a, b, c], "b", () => 0)).toBe(a);
    expect(choosePour([a, b, c], "b", () => 0.9)).toBe(c);
  });

  it("repeats the last bottle only when it is the only one left", () => {
    expect(choosePour([a], "a", () => 0)).toBe(a);
    expect(choosePour([], "a", () => 0)).toBeNull();
    expect(choosePour([b], "a", () => 0)).toBe(b);
  });

  it("leads to the open bottle when a closed one shares the expression", () => {
    const open = { id: "open", status: "Open" as const, bottleKey: "hakushu::12" };
    const closed = { id: "closed", status: "Closed" as const, bottleKey: "hakushu::12" };
    const elsewhere = { id: "other", status: "Closed" as const, bottleKey: "glenfiddich::12" };
    for (let step = 0; step < 10; step += 1) {
      expect(choosePour([closed, open], null, () => step / 10)).toBe(open);
    }
    expect(choosePour([closed, elsewhere], null, () => 0)).toBe(closed);
    const secondOpen = { id: "open-2", status: "Open" as const, bottleKey: "hakushu::12" };
    expect(choosePour([open, secondOpen, closed], null, () => 0.9)).toBe(secondOpen);
  });
});

describe("leadBottle", () => {
  const open = { id: "open", status: "Open", bottleKey: "hakushu::12", location: "Bar" };
  const closed = { id: "closed", status: "Closed", bottleKey: "hakushu::12", location: "Mid Rack C" };

  it("walks to the open bottle when the pick is its closed sibling", () => {
    expect(leadBottle([closed, open], closed)).toBe(open);
    expect(leadBottle([open, closed], open).location).toBe("Bar");
    expect(leadBottle([closed], closed)).toBe(closed);
  });
});

describe("settlePick", () => {
  it("clears a pick the pool no longer contains", () => {
    expect(settlePick(a, [a, b])).toBe(a);
    expect(settlePick(a, [b])).toBeNull();
    expect(settlePick(null, [a])).toBeNull();
  });
});
