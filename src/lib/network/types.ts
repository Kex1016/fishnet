// Shapes of the network routes planned in cakeutils (API-EXPANSION §4, WEBSITE-BRIEF §3.5). They freeze when
// the contract units merge; every field the site does not need to draw a row is optional, unknown fields
// are ignored, unknown kinds are shown generically.
import type { Scope } from "#lib/api/scope.ts";

export type Who = { uuid: string; name: string };

/** GET /v2/firsts: one merged "world firsts" feed, newest first, undated (backfilled) last. */
export type FirstKind = "stat" | "advancement" | "criterion" | "playtime" | "dimension" | "biome" | "structure" | "item" | (string & {});
export type First = {
  /** null when no single holder is known (a backfilled first several players were already past) */
  uuid: string | null;
  name: string | null;
  kind: FirstKind;
  at: number | null;
  /** where it happened; null for a network-scope stat, place or item first */
  server: string | null;
  /** English display text: the thing's name or its key, an advancement's title, a duration for playtime */
  title: string;
  detail?: Record<string, unknown> | null;
  backfilled?: boolean;
  imported?: boolean;
  /** never sent by the API: the site adds the catalogue's picture of what the first is about (pictures.ts) */
  icon?: string | null;
  iconKind?: string | null;
};
export type FirstsFeed = { scope: Scope; total: number; firsts: First[] };

/** GET /v2/milestones/criteria: who first earned each criterion of an advancement. */
export type CriterionFirst = Who & { advancement: string; title: string; criterion: string; server: string | null; earned_at: number | null; imported?: boolean; earners?: number };
export type CriteriaFeed = { scope: Scope; total: number; criteria: CriterionFirst[] };

/** One player who has an advancement (cakeutils listAdvancementEarners): `rank` 1 = the first earner in the scope; in the network, `server` is where this player first completed it. */
export type AdvancementEarner = { rank: number; uuid: string; name: string; server: string; earned_at: number; imported: boolean };
/** GET /v2/milestones/advancement/earners?id=: every player who has one advancement, in the order they got it. */
export type AdvancementEarners = { advancement: string; title: string | null; scope: Scope; excluded?: string[]; total: number; earners: AdvancementEarner[] };

/** GET /v2/players/{ref}/advancement-criteria */
export type PlayerCriterion = { advancement: string; title: string; criterion: string; earned_at: number | null; imported?: boolean; first?: boolean };
export type PlayerCriteria = { total: number; criteria: PlayerCriterion[] };

/** GET /v2/deaths: newest first; `pos` only when the operator turned death positions on. */
export type Death = Who & {
  at: number;
  server: string;
  cause: string | null;
  damage_type?: string | null;
  killer?: string | null;
  killer_player?: Who | null;
  dim?: string | null;
  pos?: { x: number; y: number; z: number } | null;
  imported?: boolean;
};
export type DeathFeed = { scope: Scope; total: number; deaths: Death[] };

/** GET /v2/activity/playtime */
export type PlaytimeSeries = { scope: Scope; bucket: "day" | "week" | "month" | (string & {}); series: { start: number; ms: number; players: number }[] };
/** GET /v2/activity/heatmap: [weekday 0..6, hour 0..23, ms] */
export type ActivityHeatmap = { scope: Scope; cells: [number, number, number][] };
/** GET /v2/activity/online */
export type OnlineSeries = { scope: Scope; bucket: string; series: { start: number; avg: number; max: number }[]; peak: { at: number; count: number } | null };

export type PlaytimeMilestone = Who & { threshold_ms: number; display: string; reached_at: number | null; backfilled?: boolean };
/** GET /v2/milestones/playtime */
export type PlaytimeMilestones = { scope: Scope; total: number; milestones: PlaytimeMilestone[] };

/** GET /v2/players/{ref}/activity: aggregates only; no session list is ever served. */
export type PlayerActivity = {
  first_session_at: number | null;
  sessions: number;
  days_active: number;
  longest_session: { started_at: number; ms: number; server: string | null } | null;
  streak: { current_days: number; best_days: number; best_ended: number | null } | null;
  playtime_milestones: { threshold_ms: number; display: string; reached_at: number | null; first: boolean; backfilled?: boolean }[];
};

/** GET /v2/leaderboards/history/{type}/{subject} and /history/playtime */
export type BoardHistory = {
  metric: string;
  scope: Scope;
  unit?: string;
  tracked?: boolean;
  days: { day: number | string; entries: (Who & { rank: number; value: number; display: string })[] }[];
};
