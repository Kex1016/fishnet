// Small pure helpers of the shell and the page head.

/**
 * The path a prompt or a window label shows for an address: "/" → "~", "/players/Pebblewick" →
 * "~/players/Pebblewick". Percent-escapes are decoded for reading; it is text, never a link.
 */
export function promptPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  return parts.length ? `~/${parts.join("/")}` : "~";
}

/** The first segment of an address as a window path: "/players/x" → "~/players". */
export function sectionPath(pathname: string): string {
  const first = pathname.split("/").find(Boolean);
  return first ? promptPath(`/${first}`) : "~";
}

/**
 * About how wide a display title is, in em of Jacquard 24 (measured advances: lower case 0.39, upper case
 * 0.61, digits 0.31, a space 0.26). The title's font size is the room it has divided by this, so a long
 * name gets smaller letters instead of running off a phone. Never below 3, so short words stay at the cap.
 */
export function titleEm(text: string): number {
  let em = 0;
  for (const ch of text) {
    if (ch === " ") em += 0.26;
    else if (ch >= "0" && ch <= "9") em += 0.31;
    else if (ch >= "a" && ch <= "z") em += 0.39;
    else if (ch >= "A" && ch <= "Z") em += 0.61;
    else if (ch.charCodeAt(0) < 0x2e80) em += 0.5;
    else em += 1; // CJK and other full-width characters come from Unifont
  }
  // the longest word must fit as well: a title wraps between words only
  return Math.max(3, Math.round(em * 1.06 * 100) / 100);
}

export type PagerStep = { page: number; offset: number; current: boolean } | { gap: true };

/**
 * The page numbers a pager shows: the first, the last, the current one and its neighbours, with a gap
 * ("…") where pages are left out. `[1] 2 3 … 10`.
 */
export function pagerSteps(total: number, limit: number, offset: number): PagerStep[] {
  if (limit <= 0 || total <= limit) return [];
  const pages = Math.ceil(total / limit);
  const at = Math.min(pages, Math.floor(offset / limit) + 1);
  const show = new Set<number>([1, pages, at - 1, at, at + 1]);
  if (at <= 3) [2, 3].forEach((p) => show.add(p));
  if (at >= pages - 2) [pages - 1, pages - 2].forEach((p) => show.add(p));
  const list = [...show].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const out: PagerStep[] = [];
  let prev = 0;
  for (const p of list) {
    if (p - prev > 1) out.push({ gap: true });
    out.push({ page: p, offset: (p - 1) * limit, current: p === at });
    prev = p;
  }
  return out;
}
