type Ticket = { id: string; status?: string; bottleKey?: string };

/** Closed bottles are not tickets while an open one of the same expression can be poured. */
function tickets<T extends Ticket>(pool: T[]): T[] {
  const openKeys = new Set(
    pool.filter((item) => item.status === "Open" && item.bottleKey).map((item) => item.bottleKey),
  );
  if (openKeys.size === 0) return pool;
  return pool.filter((item) => item.status === "Open" || !item.bottleKey || !openKeys.has(item.bottleKey));
}

export function choosePour<T extends Ticket>(
  pool: T[],
  lastId: string | null,
  random: () => number = Math.random,
): T | null {
  const pourable = tickets(pool);
  if (pourable.length === 0) return null;
  const others = lastId == null ? [] : pourable.filter((item) => item.id !== lastId);
  const choices = others.length > 0 ? others : pourable;
  return choices[Math.floor(random() * choices.length)] ?? null;
}

/** The bottle to walk to. A closed pick yields to an open one of the same expression. */
export function leadBottle<T extends Ticket>(group: T[], picked: T): T {
  if (picked.status === "Open") return picked;
  return group.find((item) => item.bottleKey === picked.bottleKey && item.status === "Open") ?? picked;
}

export function settlePick<T extends { id: string }>(pick: T | null, pool: T[]): T | null {
  if (!pick || !pool.some((item) => item.id === pick.id)) return null;
  return pick;
}

/** A unique, valid CSS ident for a card's view transition. Each disallowed character is hex-escaped so keys never collide. */
export function cardTransitionName(bottleKey: string): string {
  return `card-${bottleKey.replace(/[^a-zA-Z0-9-]/g, (char) => `_${char.codePointAt(0)?.toString(16)}_`)}`;
}

/** Runs a state update inside a view transition when the browser can animate it. */
export function withViewTransition(update: () => void): void {
  const doc = typeof document === "undefined" ? undefined : document;
  if (!doc?.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }
  doc.startViewTransition(update);
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}
