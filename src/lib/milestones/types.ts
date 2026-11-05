// Props of the milestone components (PLAN §2.5, §7 W7), frozen by W0. W4 (home, servers), W5
// (players) and W6 (stats) import these; W7 implements them. Every nullable field follows the rules:
// backfilled → "Reached before tracking began" (name only if given); uuid/name null → "first player
// unknown"; stat_name null → title-cased subject key; thresholds are data (`display` as given).
import type { AdvancementRow, MilestoneFeedRow, MilestoneLadder as Ladder } from "#lib/api/types.ts";
import type { Result } from "#lib/api/result.ts";

export type MilestoneFeedProps = {
  /** the client's answer; `off` and `empty` render on purpose */
  result: Result<{ milestones: MilestoneFeedRow[]; total: number }>;
  /** headline over the list */
  title?: string;
  href?: string;
  /** show the stat (icon + name) on each row; false on a stat's own page */
  showStat?: boolean;
  /** show the player on each row; false on a player's own page */
  showPlayer?: boolean;
  /** rows to render (the page pages the rest) */
  limit?: number;
};

export type MilestoneLadderProps = {
  /** the client's answer for one stat in one scope: not_found → "Nobody has done this yet", tracked:false → "No milestones for this stat" */
  result: Result<Ladder>;
  /** the stat's name from the catalogue (the ladder has none) */
  statName?: string | null;
  icon?: string | null;
  kind?: string | null;
};

export type PlayerFirstsProps = {
  /** /v2/players/{ref}/milestones for the viewed player */
  result: Result<{ milestones: MilestoneFeedRow[]; total: number }>;
  playerName: string;
  limit?: number;
};

// ---- Advancement milestones (D-111): the same states as the stat feeds, plus a server on every row (where the
// first completion happened) and an `imported` tag for times that came from the operator's one-time import.

export type AdvancementFeedProps = {
  /** the client's answer; `off` and `empty` render on purpose */
  result: Result<{ milestones: AdvancementRow[]; total: number }>;
  title?: string;
  href?: string;
  /** show the first earner on each row; false on a player's own page */
  showPlayer?: boolean;
  /** say on which server each row happened; false on a server's own page */
  showServer?: boolean;
  /** server id → display name (from /v2/network); an id without one is title-cased */
  serverNames?: Record<string, string>;
  /** rows to render (the page pages the rest) */
  limit?: number;
};

export type PlayerAdvancementFirstsProps = {
  /** /v2/players/{ref}/advancement-milestones for the viewed player */
  result: Result<{ milestones: AdvancementRow[]; total: number }>;
  playerName: string;
  showServer?: boolean;
  serverNames?: Record<string, string>;
  limit?: number;
};
