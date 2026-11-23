// The data shapes the shared components take. Frozen with H0 (docs/HAIIRO.md): a unit that needs one changed
// asks the coordinator. Every string is text: components render it escaped.

/** 2 (common) to 6 (the rarest): the colour of a picture's frame, classes .r2 to .r6 (love, pine, foam, iris, gold). */
export type Rarity = 2 | 3 | 4 | 5 | 6;

/** The colour of a Window's frame. It carries meaning: gold = needs you or the living, love = critical,
    failed or the dead, foam = done, off = not there (not linked, switched off). */
export type WindowTone = "pine" | "gold" | "love" | "foam" | "off";

/** One choice of a Segmented. Without an href it is shown but cannot be chosen. */
export type SegmentedOption = { href?: string; label: string; current?: boolean; title?: string };

/** One row of a RankList. */
export type RankRow = {
  key: string;
  /** 1-based position; 0 or less shows no number (an unranked list) */
  rank: number;
  label: string;
  href?: string;
  /** a player: shows their face. Leave it out for rows that are not players */
  uuid?: string;
  /** 0..1: the bar's width, the share of the widest row inside one scope (never across scopes) */
  share?: number;
  /** the formatted value, as the page wants it shown */
  value: string;
  /** a quiet word after the name */
  sub?: string;
  /** the row the page is about */
  current?: boolean;
};

/** One square of a Ladder. */
export type LadderStep = {
  key?: string;
  /** what the square says: "1k", "7" */
  label: string;
  /** reached / next / locked for thresholds; dead / now for One Soul's turns; plain = no state */
  state: "reached" | "next" | "locked" | "dead" | "now" | "plain";
  /** the full sentence for the tooltip and a screen reader: "1,000 blocks, reached 4 Nov 2026" */
  title?: string;
  href?: string;
};

/** One line of a KeyValueSheet with a plain text value. */
export type SheetRow = { label: string; value: string; num?: boolean; ink?: "c2" | "c3" | "c4" | "c6" | "c7" };

/** One item of a Catalogue. */
export type CatalogueItem = {
  href: string;
  label: string;
  /** the quiet word on the right: "12 boards" */
  meta?: string;
  /** cakeutils' icon id */
  icon?: string | null;
  current?: boolean;
};
