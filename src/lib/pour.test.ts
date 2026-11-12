import { afterEach, describe, expect, it, vi } from "vitest";
import { choosePour, leadBottle, revealCard, settlePick } from "./pour";

describe("revealCard", () => {
  function card(top: number) {
    const element = document.createElement("div");
    element.getBoundingClientRect = () => ({ top, bottom: top + 100 }) as DOMRect;
    element.scrollIntoView = vi.fn();
    return element;
  }

  function reducedMotion(on: boolean) {
    vi.stubGlobal("matchMedia", vi.fn().mockImplementation(() => ({ matches: on })));
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("jumps straight to the card under reduced motion", async () => {
    reducedMotion(true);
    const target = card(5000);
    await revealCard(target);
    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
  });

  it("leaves a card that is already in view where it is", async () => {
    reducedMotion(false);
    const target = card(200);
    await revealCard(target);
    expect(target.scrollIntoView).not.toHaveBeenCalled();
  });

  it("smooth-scrolls to a card out of view and waits for the scroll to end", async () => {
    reducedMotion(false);
    const target = card(5000);
    let done = false;
    const revealed = revealCard(target).then(() => {
      done = true;
    });
    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
    await Promise.resolve();
    expect(done).toBe(false);
    document.dispatchEvent(new Event("scrollend"));
    await revealed;
    expect(done).toBe(true);
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

  describe("tickets under Favor last third", () => {
    const low = { id: "low", lastThird: true };
    const full = { id: "full", lastThird: false };

    it("gives every bottle one ticket while it is off", () => {
      expect(choosePour([low, full], null, () => 0.49)).toBe(low);
      expect(choosePour([low, full], null, () => 0.5)).toBe(full);
    });

    it("gives a last-third bottle three tickets and every other bottle one while it is on", () => {
      expect(choosePour([low, full], null, () => 0.74, true)).toBe(low);
      expect(choosePour([low, full], null, () => 0.75, true)).toBe(full);
      expect(choosePour([full, low], null, () => 0.24, true)).toBe(full);
      expect(choosePour([full, low], null, () => 0.25, true)).toBe(low);
    });

    it("still skips the last bottle while another can be poured", () => {
      expect(choosePour([low, full], "full", () => 0.99, true)).toBe(low);
      expect(choosePour([low, full], "low", () => 0, true)).toBe(full);
    });
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
