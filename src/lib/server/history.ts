// The history query interface (PLAN §2.4, §3.3): every chart over time reads through here, never
// the API (which has no history). W0 froze the interface; W2 implements it on the recorder's SQLite
// (src/lib/server/recorder/). Every answer carries `since` (when that series was first recorded,
// null = never) so charts can say "Recording since <date>" and show their empty state under two points.
//
// What the numbers are: times are epoch ms, buckets aligned to UTC. Online series give each bucket's
// peak (day: 5 min buckets, week: 1 h, month: 6 h). Nothing here ever adds two scopes together.
// Opted-out players never appear. Methods never throw: a broken file answers like a fresh install.
import type { Scope } from "#lib/api/scope.ts";
import { recorderHistory } from "./recorder/index.ts";

export type Point = { t: number; v: number };
export type Series = { since: number | null; points: Point[] };
export type Range = "day" | "week" | "month";

export type ServerSample = { t: number; online: number; waiting: number; linked: boolean };
export type ServerSeries = { since: number | null; samples: ServerSample[] };

export type RankMove = { uuid: string; name: string; rank: number; before: number | null; value: number; display: string };
export type RankMoves = { since: number | null; moves: RankMove[] };

/** A per-day grid for the activity heatmap: `days[i]` = day start (UTC) → value, oldest first. */
export type DayGrid = { since: number | null; days: { day: number; v: number }[] };

export interface History {
  /** When the recorder first wrote anything, or null on a fresh install. */
  recordingSince(): Promise<number | null>;
  /** Players online in a scope over a range (network: total_online; server: that server), minute rows → hourly roll-ups. */
  online(scope: Scope, range: Range): Promise<Series>;
  /** The last ~60 samples of online in a scope, for a sparkline. */
  onlineRecent(scope: Scope): Promise<Series>;
  /** A server's online, waiting and linked state over a range (uptime strip + waiting line). A bucket is `linked` when the backend was linked for at least half of its samples. */
  server(id: string, range: Range): Promise<ServerSeries>;
  /**
   * Busiest hours: a 7×24 grid of mean online per weekday-hour over the range. `cells[d][h]`: d = 0 is
   * Monday … 6 Sunday, h = UTC hour; null = no samples for that weekday-hour (not "nobody online").
   * `cells: []` when nothing was recorded in the range.
   */
  activityByHour(scope: Scope, range: Range): Promise<{ since: number | null; cells: (number | null)[][] }>;
  /** Public mini-server presence over a range: mini key → series. */
  miniPresence(server: string, range: Range): Promise<Record<string, Series>>;
  /**
   * A total for a stat (sum of every entry of its board, inside ONE scope) over time, every 6 h.
   * `metric`: a FEATURED board id ("mined") or a metric key ("mined:*", "playtime"). Recorded for the
   * featured boards in network and every server scope, and every type total (`<type>:*`) in network.
   */
  networkTotal(metric: string, scope: Scope, range: Range): Promise<Series>;
  /**
   * Rank movement on a featured board over the last week ("climbing this week"): the latest snapshot in
   * rank order, `before` = rank in the oldest snapshot of the last 7 days (null = not on the recorded
   * part of the board then). `moves: []` until two snapshots exist. Network scope only today.
   */
  rankMoves(metric: string, scope: Scope): Promise<RankMoves>;
  /** Milestones reached per UTC day (from the API's reached_at, stored to survive offsets), zero days included, from the first dated milestone on. Backfilled rows have no day and are not counted. */
  milestonesPerDay(scope: Scope, range: Range): Promise<DayGrid>;
  /** New players per week (Monday 00:00 UTC) by first_seen, from the recorder's player table. Empty until every player's first_seen is known. */
  joinsPerWeek(range: Range): Promise<Series>;
}

const EMPTY: Series = { since: null, points: [] };

/** Nothing recorded: used while building and when the recorder's file cannot be opened. */
export const emptyHistory: History = {
  recordingSince: async () => null,
  online: async () => EMPTY,
  onlineRecent: async () => EMPTY,
  server: async () => ({ since: null, samples: [] }),
  activityByHour: async () => ({ since: null, cells: [] }),
  miniPresence: async () => ({}),
  networkTotal: async () => EMPTY,
  rankMoves: async () => ({ since: null, moves: [] }),
  milestonesPerDay: async () => ({ since: null, days: [] }),
  joinsPerWeek: async () => EMPTY
};

/** The site's History: the recorder's SQLite file (an in-memory, seeded one in mock mode). */
export function history(): History {
  return recorderHistory();
}
