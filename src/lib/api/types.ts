// The cakeutils v2 shapes fishnet uses, as aliases over the generated schema (schema.d.ts) plus the
// milestone shapes from the D-109 brief (PLAN §2.5), hand-written until that branch merges.
// Frozen by W0: a unit that needs a change asks the coordinator. Pure types: safe to import anywhere.
import type { components } from "./schema.d.ts";

type S = components["schemas"];

export type Problem = S["Problem"];
export type Health = S["Health"];
export type Network = S["Network"];
export type Server = Network["servers"][number];
export type PlayerSummary = S["PlayerSummary"];
export type PlayerList = S["PlayerList"];
export type Segment = S["Segment"];
export type Playtime = S["Playtime"];
export type PlayerProfile = S["PlayerProfile"];
export type StatValue = S["StatValue"];
export type StatRow = S["StatRow"];
export type StatList = S["StatList"];
export type BatchRequest = S["BatchRequest"];
export type BatchResponse = S["BatchResponse"];
export type BatchPlayer = BatchResponse["players"][number];
export type StatTypes = S["StatTypes"];
export type StatType = StatTypes["types"][number];
export type Subject = S["Subject"];
export type SubjectList = S["SubjectList"];
export type SubjectDetail = S["SubjectDetail"];
export type Leaderboard = S["Leaderboard"];
export type LeaderboardEntry = Leaderboard["entries"][number];
export type MiniServers = S["MiniServers"];
export type MiniServer = MiniServers["mini_servers"][number];

/** Units the API documents today. Anything else formats as a plain number (PLAN §2.2). */
export type KnownUnit = "count" | "distance_cm" | "ticks" | "damage_tenths" | "ms";
export type Unit = KnownUnit | (string & {});

/** Subject kinds the catalogue documents; `null` = a key seen before its definition arrived. */
export type Kind = "block" | "item" | "entity" | "custom" | "other";

// ---- Milestones (D-109 brief; PLAN §2.5). Additive, feature-detected, every nullable field on purpose.

/** One rung of a stat's ladder. `uuid`/`name`/`reached_at` are null when the first player is unknown. */
export type MilestoneRow = {
  threshold: number;
  /** The threshold formatted in the stat's unit, as the API gives it. */
  display: string;
  uuid: string | null;
  name: string | null;
  /** epoch ms; null when reached before tracking began */
  reached_at: number | null;
  /** true = reached before tracking began (the API found it already passed) */
  backfilled: boolean;
};

/** GET /v2/milestones/stats/{type}/{subject}: lowest threshold first, at most 18 rows. */
export type MilestoneLadder = {
  metric: string;
  scope: string;
  unit: Unit;
  /** false for time and damage stats: no ladder exists */
  tracked: boolean;
  milestones: MilestoneRow[];
};

/** A feed row: a ladder rung plus which stat it belongs to. `stat_name` may be null (catalogue has no name yet). */
export type MilestoneFeedRow = MilestoneRow & {
  metric: string;
  type: string;
  subject: string;
  stat_name: string | null;
  unit: Unit;
  icon?: string | null;
  scope: string;
};

/** GET /v2/milestones: newest first, backfilled rows last. */
export type MilestoneFeed = {
  scope: string;
  total: number;
  milestones: MilestoneFeedRow[];
};

/** GET /v2/players/{ref}/milestones: what this player was first to reach. Same rows as the feed. */
export type PlayerMilestones = MilestoneFeed & { uuid: string };
