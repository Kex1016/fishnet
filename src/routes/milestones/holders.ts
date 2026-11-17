// Pure helpers for "milestones per player" (the board on /milestones and the table on /milestones/players).
// The counts come from the recorder's copy of the milestone feed (History.milestoneHolders); nothing here
// reads the API or adds scopes together.
import type { MilestoneHolder } from "#lib/server/history.ts";
import { isUuidName } from "#lib/players/names.ts";

export type HolderSort = "most" | "latest" | "name";
export const SORTS: { id: HolderSort; label: string }[] = [
  { id: "most", label: "Most milestones" },
  { id: "latest", label: "Newest milestone" },
  { id: "name", label: "Name" }
];

export function sortParam(s: string | null | undefined): HolderSort {
  return s === "latest" || s === "name" ? s : "most";
}

export type RankedHolder = MilestoneHolder & { /** place by count, 1 = most; players with the same count share a place */ rank: number };

/** Places by count: equal counts share a place and the next one skips ("1, 2, 2, 4"). `holders` must be count descending. */
export function ranked(holders: MilestoneHolder[]): RankedHolder[] {
  let rank = 0;
  let last = Number.NaN;
  return holders.map((h, i) => {
    if (h.count !== last) rank = i + 1;
    last = h.count;
    return { ...h, rank };
  });
}

/** The table's rows: a name filter (any part, any case) and an order. Places stay the ones by count. */
export function arrange(rows: RankedHolder[], q: string, sort: HolderSort): RankedHolder[] {
  const needle = q.trim().toLowerCase();
  const out = needle ? rows.filter((r) => r.name.toLowerCase().includes(needle)) : [...rows];
  if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
  // players whose milestones were all reached before tracking began have no date: they come last
  else if (sort === "latest") out.sort((a, b) => (b.latest ?? -1) - (a.latest ?? -1) || b.count - a.count || a.name.localeCompare(b.name));
  return out;
}

/** The milestones feed filtered to one player (by name, or by UUID while the name is one), keeping scope and stat type. */
export function playerFeedHref(p: { uuid: string; name: string }, scope: string, type: string): string {
  const q = new URLSearchParams();
  if (scope !== "network") q.set("scope", scope);
  if (type) q.set("type", type);
  q.set("player", isUuidName(p.name) ? p.uuid : p.name);
  return `/milestones?${q}`;
}

/** The players table for a scope and stat type. */
export function holdersHref(scope: string, type: string): string {
  const q = new URLSearchParams();
  if (scope !== "network") q.set("scope", scope);
  if (type) q.set("type", type);
  const s = q.toString();
  return s ? `/milestones/players?${s}` : "/milestones/players";
}
