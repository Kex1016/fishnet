// The cakeutils v2 shapes fishnet uses, as aliases over the generated schema (schema.d.ts) including the
// milestone shapes (D-109, PLAN §2.5).
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

// ---- Milestones (D-109, merged in cakeutils; PLAN §2.5). Derived from the generated schema, so a sync
// (`bun run openapi`) moves them. Feature-detected, every nullable field on purpose.

type ApiRung = S["StatMilestones"]["milestones"][number];
type ApiFeedRow = S["MilestoneList"]["milestones"][number];

/** One rung of a stat's ladder. `uuid`/`name`/`reached_at` are null when the first player is unknown or it was reached before tracking began. */
export type MilestoneRow = ApiRung;

/** GET /v2/milestones/stats/{type}/{subject}: lowest threshold first, at most 18 rows; `tracked:false` for time and damage stats. */
export type MilestoneLadder = S["StatMilestones"];

/**
 * A feed row: a rung plus its stat (`subject` is "*" for a type total; `stat_name` may be null). The feed has `uuid` and
 * `name` (null when several players were already past a backfilled rung); the player endpoint's rows have neither
 * (the player is on the envelope), so both are optional here. `icon` and `kind` are never sent by the API: the site
 * adds them from the catalogue (src/lib/milestones/prepare.server.ts).
 */
export type MilestoneFeedRow = Omit<ApiFeedRow, "uuid" | "name"> & {
  uuid?: string | null;
  name?: string | null;
  icon?: string | null;
  kind?: string | null;
};

/** GET /v2/milestones: newest first, backfilled rows last. */
export type MilestoneFeed = Omit<S["MilestoneList"], "milestones"> & { milestones: MilestoneFeedRow[] };

/** GET /v2/players/{ref}/milestones: what this player was first to reach. */
export type PlayerMilestones = Omit<S["PlayerMilestoneList"], "milestones"> & { milestones: MilestoneFeedRow[] };

// ---- Advancement milestones (D-111, merged in cakeutils 5 Nov 2026; STATS §10, API §3). Who completed each
// advancement first, per server and for the network. Only network and server scopes exist (mini: → 400);
// nothing is backfilled, but a row's time may come from the operator's one-time import (`imported`).
// Feature-detected on its own: a proxy with D-109 but not D-111 answers 404 on /v2/milestones/advancements.

type ApiAdvancementRow = S["AdvancementMilestoneList"]["milestones"][number];

/** Who was first to an advancement in one scope: `server` is where (in the network scope: where the first earner did it), `earners` how many players have it there. */
export type AdvancementHolder = NonNullable<S["AdvancementMilestone"]["network"]>;

/**
 * A feed row: the advancement (namespaced id and the English title the backend last reported) plus its first
 * earner. The feed has `uuid` and `name`; the player endpoint's rows have neither (the player is on the
 * envelope), so both are optional here. `title` may be empty for an advancement the backend never titled.
 */
export type AdvancementRow = Omit<ApiAdvancementRow, "uuid" | "name" | "title"> & {
  uuid?: string | null;
  name?: string | null;
  title?: string | null;
};

/** GET /v2/milestones/advancements: newest first. */
export type AdvancementFeed = Omit<S["AdvancementMilestoneList"], "milestones"> & { milestones: AdvancementRow[] };

/** GET /v2/milestones/advancement?id=: one advancement's first earner in the network and on each server where someone has it; `network` is null only when nobody has it. */
export type AdvancementDetail = S["AdvancementMilestone"];

/** GET /v2/players/{ref}/advancement-milestones: what this player was first to complete. */
export type PlayerAdvancements = Omit<S["PlayerAdvancementMilestoneList"], "milestones"> & { milestones: AdvancementRow[] };
