import { describe, expect, it } from "vitest";
import { cardTransitionName, choosePour, rollFrames, settlePick } from "./pour";

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
});

describe("rollFrames", () => {
  it("skips across the other cards and lands on the pick", () => {
    expect(rollFrames(["a", "b", "c"], "b", false)).toEqual(["a", "c", "a", "c", "b"]);
  });

  it("lands immediately for one card or reduced motion", () => {
    expect(rollFrames(["only"], "only", false)).toEqual([]);
    expect(rollFrames(["a", "b"], "b", true)).toEqual([]);
  });
});

describe("settlePick", () => {
  it("clears a pick the pool no longer contains", () => {
    expect(settlePick(a, [a, b])).toBe(a);
    expect(settlePick(a, [b])).toBeNull();
    expect(settlePick(null, [a])).toBeNull();
  });
});
