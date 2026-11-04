// Where a player stands on the featured boards (PLAN §3.4 "ranks on featured boards"). The API has
// no "rank of one player" route, so the page reads the top of each board (one page of 100) and the
// player's own values in one batch call. A player below the first page has a value but no rank.
import type { BatchPlayer, Leaderboard, PlayerProfile, Unit } from "#lib/api/types.ts";
import type { Result } from "#lib/api/result.ts";
import type { Metric } from "#lib/api/metric.ts";
import { boardHref, metricKey, shortType } from "#lib/api/metric.ts";
import type { CompositeBoard, FeaturedBoard } from "#lib/boards.ts";
import { formatStat, durationMs } from "#lib/format/stat-display.ts";

export type BoardStanding = {
  id: string;
  label: string;
  href: string;
  /** 1-based, or null when the player is not on the page of the board that was read */
  rank: number | null;
  /** how many players are on the board */
  total: number;
  /** the player's value as the API displays it ("0" when they never did it) */
  display: string;
  value: number;
  unit: Unit;
  /** ranks were read from the first `pageSize` entries only */
  pageSize: number;
};

/** The `include` key the batch route uses for a stat metric: "stats:<short type>:<subject>". */
export function includeKey(m: Metric): string {
  return m.kind === "playtime" ? "playtime" : `stats:${shortType(m.type)}:${m.subject}`;
}

/** The includes one batch call needs for the featured boards and the composites' parts (≤ 32). */
export function batchIncludes(featured: FeaturedBoard[], composites: CompositeBoard[]): string[] {
  const keys = new Set<string>();
  for (const b of featured) if (b.metric.kind === "stat") keys.add(includeKey(b.metric));
  for (const c of composites) for (const p of c.parts) keys.add(includeKey(p));
  return [...keys].slice(0, 32);
}

/**
 * The player's standing on one featured board. `board` is that board's first page in the scope;
 * `me` the batch row for the player (values in the same scope). Returns null when the board does not
 * exist yet (404, hidden until it does) or could not be read.
 */
export function standing(b: FeaturedBoard, board: Result<Leaderboard>, me: BatchPlayer | null, profile: PlayerProfile, scope: string, pageSize: number): BoardStanding | null {
  if (!board.ok) return null;
  const entry = board.data.entries.find((e) => e.uuid === profile.uuid);
  const href = boardHref(b.metric, scope);
  if (b.metric.kind === "playtime") {
    const ms = scope === "network" ? profile.playtime.total_ms : (me?.playtime?.total_ms ?? 0);
    return { id: b.id, label: b.label, href, rank: entry?.rank ?? null, total: board.data.total, display: entry?.display ?? durationMs(ms), value: entry?.value ?? ms, unit: "ms", pageSize };
  }
  const own = me?.stats?.[includeKey(b.metric)];
  const unit = (own?.unit ?? board.data.unit) as Unit;
  const value = entry?.value ?? own?.value ?? 0;
  const display = entry?.display ?? own?.display ?? formatStat(unit, value);
  return { id: b.id, label: b.label, href, rank: entry?.rank ?? null, total: board.data.total, display, value, unit, pageSize };
}

/** A composite's value for the player: the parts added inside ONE scope (never across scopes). Null when no part has data. */
export function compositeValue(c: CompositeBoard, me: BatchPlayer | null): { value: number; display: string } | null {
  if (!me?.stats) return null;
  let sum = 0;
  let seen = false;
  for (const p of c.parts) {
    const s = me.stats[includeKey(p)];
    if (!s) continue;
    if (s.unit !== c.unit) continue; // never add two units
    seen = true;
    sum += s.value;
  }
  return seen ? { value: sum, display: formatStat(c.unit, sum) } : null;
}

export { metricKey };
