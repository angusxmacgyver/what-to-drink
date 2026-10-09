const HOPS = 4;

export function choosePour<T extends { id: string }>(
  pool: T[],
  lastId: string | null,
  random: () => number = Math.random,
): T | null {
  if (pool.length === 0) return null;
  const others = lastId == null ? [] : pool.filter((item) => item.id !== lastId);
  const choices = others.length > 0 ? others : pool;
  return choices[Math.floor(random() * choices.length)] ?? null;
}

/** Highlight frames before the landing card. Empty means land immediately. */
export function rollFrames(keys: string[], landing: string, reduceMotion: boolean): string[] {
  if (reduceMotion) return [];
  const others = keys.filter((key) => key !== landing);
  if (others.length === 0) return [];
  const skips = Array.from({ length: HOPS }, (_, index) => others[index % others.length]);
  return [...skips, landing];
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
