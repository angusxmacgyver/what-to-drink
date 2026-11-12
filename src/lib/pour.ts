type Ticket = { id: string; status?: string; bottleKey?: string; lastThird?: boolean };

/** Favor last third gives a last-third bottle three tickets and every other bottle one. */
function ticketCount(item: Ticket, favorLastThird: boolean): number {
  return favorLastThird && item.lastThird ? 3 : 1;
}

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
  favorLastThird = false,
): T | null {
  const pourable = tickets(pool);
  if (pourable.length === 0) return null;
  const others = lastId == null ? [] : pourable.filter((item) => item.id !== lastId);
  const choices = others.length > 0 ? others : pourable;
  const total = choices.reduce((sum, item) => sum + ticketCount(item, favorLastThird), 0);
  let ticket = random() * total;
  for (const item of choices) {
    ticket -= ticketCount(item, favorLastThird);
    if (ticket < 0) return item;
  }
  return choices[choices.length - 1];
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

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

/** Resolves once the card has scrolled into view. Already-visible cards resolve immediately. */
export function revealCard(card: HTMLElement): Promise<void> {
  if (prefersReducedMotion()) {
    card.scrollIntoView({ block: "center", behavior: "auto" });
    return Promise.resolve();
  }
  const rect = card.getBoundingClientRect();
  if (rect.top >= 64 && rect.bottom <= window.innerHeight - 24) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      document.removeEventListener("scrollend", finish);
      resolve();
    };
    const timer = window.setTimeout(finish, 700);
    document.addEventListener("scrollend", finish);
    card.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}
