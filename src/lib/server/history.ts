// The history query interface (PLAN §2.4, §3.3): every chart over time reads through here, never
// the API (which has no history). W0 freezes the interface and returns empty series; W2 implements
// it on the recorder's SQLite. Every answer carries `since` (when recording began, null = never)
// so charts can say "Recording since <date>" and show their empty state under two points.
import type { Scope } from "#lib/api/scope.ts";

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
  /** A server's online, waiting and linked state over a range (uptime strip + waiting line). */
  server(id: string, range: Range): Promise<ServerSeries>;
  /** Busiest hours: a 7×24 grid of mean online per weekday-hour over the range. */
  activityByHour(scope: Scope, range: Range): Promise<{ since: number | null; cells: number[][] }>;
  /** Public mini-server presence over a range: mini key → series. */
  miniPresence(server: string, range: Range): Promise<Record<string, Series>>;
  /** A network total for a stat (sum of every entry of its board, inside one scope) over time. */
  networkTotal(metric: string, scope: Scope, range: Range): Promise<Series>;
  /** Rank movement on a board over the last week ("climbing this week"). */
  rankMoves(metric: string, scope: Scope): Promise<RankMoves>;
  /** Milestones reached per day (from the API's reached_at, stored to survive offsets). */
  milestonesPerDay(scope: Scope, range: Range): Promise<DayGrid>;
  /** Players seen per week by first_seen, from the recorder's player table. */
  joinsPerWeek(range: Range): Promise<Series>;
}

const EMPTY: Series = { since: null, points: [] };

/** W0's stand-in: nothing recorded yet. W2 replaces `history()` with the SQLite-backed one. */
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

export function history(): History {
  return emptyHistory;
}
