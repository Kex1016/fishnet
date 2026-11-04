// Helpers shared by the home and server pages (W4). Pure: the client and the opt-out filter come in as
// arguments, so tests run without SvelteKit's environment.
//
// A network or server total for a stat is the sum of every player's value on that board, inside ONE
// scope. That is adding players, which is fine; it is never a sum of scopes (cakeutils I3, G-16).
import type { Metric } from "#lib/api/metric.ts";
import { ok, type Result } from "#lib/api/result.ts";
import type { Scope } from "#lib/api/scope.ts";
import type { Leaderboard, LeaderboardEntry, Unit } from "#lib/api/types.ts";
import type { Client } from "#lib/server/cakeutils/client.ts";

const PAGE = 100;
/** Most pages one total will walk (2 000 players). Past that the total says so instead of guessing. */
export const MAX_PAGES = 20;

export type BoardSum = {
  unit: Unit;
  /** every listed player's value added together, in the unit */
  sum: number;
  /** players on the board (opted-out players left out) */
  players: number;
  /** the first page, best first */
  top: LeaderboardEntry[];
  /** false when the board has more than MAX_PAGES pages: `sum` then covers the best players only */
  complete: boolean;
};

type Hide = (rows: LeaderboardEntry[]) => LeaderboardEntry[];

/** Walks a board and adds up its values. Failures pass through unchanged (404 = nobody ever did it). */
export async function boardSum(c: Pick<Client, "leaderboard">, metric: Metric, scope: Scope, hide: Hide = (r) => r): Promise<Result<BoardSum>> {
  const first = await c.leaderboard(metric, scope, { limit: PAGE, offset: 0 });
  if (!first.ok) return first;
  const pages = Math.min(Math.ceil(first.data.total / PAGE), MAX_PAGES);
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => c.leaderboard(metric, scope, { limit: PAGE, offset: (i + 1) * PAGE })));
  const got: Leaderboard[] = [first.data];
  let stale = first.stale;
  let asOf = first.asOf;
  for (const r of rest) {
    if (!r.ok) return r;
    got.push(r.data);
    stale = stale || r.stale;
    asOf = Math.min(asOf, r.asOf);
  }
  const rows = hide(got.flatMap((g) => g.entries));
  return ok(
    {
      unit: first.data.unit,
      sum: rows.reduce((a, e) => a + e.value, 0),
      players: rows.length,
      top: hide(first.data.entries),
      complete: first.data.total <= MAX_PAGES * PAGE
    },
    asOf,
    { stale, empty: first.data.total === 0 }
  );
}

/** Rows for BarList from board entries. */
export function barRows(entries: LeaderboardEntry[], limit = 5) {
  return entries.slice(0, limit).map((e) => ({ rank: e.rank, key: e.uuid, uuid: e.uuid, label: e.name, v: e.value, display: e.display, href: `/players/${encodeURIComponent(e.name)}` }));
}

/** UTC hours "00".."23": the columns of the busiest-hours heatmap. */
export const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Heatmap rows from History.activityByHour: `cells[d][h]` (d = 0 Monday, h = UTC hour, null = no
 * samples) → one row per weekday with 24 cells. Nothing recorded (`cells: []`) → no rows, so the
 * chart shows its empty state.
 */
export function activityGrid(cells: (number | null)[][]): { label: string; cells: (number | null)[] }[] {
  if (!cells.length) return [];
  return WEEKDAYS.map((label, d) => ({ label, cells: HOURS.map((_, h) => cells[d]?.[h] ?? null) }));
}

/** A mean number of players for a readout: whole numbers plain, otherwise one decimal. */
export function meanPlayers(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** A failure the page should say out loud (cakeutils unreachable or throttled), not hide as "nothing yet". */
export function isOutage<T>(r: Result<T>): boolean {
  return !r.ok && (r.kind === "down" || r.kind === "rate_limited");
}

