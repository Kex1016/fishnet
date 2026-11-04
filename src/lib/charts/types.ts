// Chart props, frozen by W0 (PLAN §3.1, §6; reki's chart rules). W3 implements the components in
// this directory against these props; pages (W4–W7) use them as they are now.
//
// Rules every chart follows: one hue (acc-viz; heatmaps acc-heat-1..4); labels in text/muted/faint,
// never the series colour; columns ≤ 24px with xs-radius tops on one baseline; lines 2px with ringed
// end dots; a readout in the card header that follows hover and keyboard focus; a table twin behind
// the page's one "Charts | Tables" switch (`view`); fewer than two points → the frame, the empty state
// inside it and "Recording since <date>" when `since` is set; rendered on the server as SVG.
import type { Unit } from "#lib/api/types.ts";

export type View = "charts" | "tables";

/** One point in time. `label` overrides the formatted time in readouts and tables. */
export type TimePoint = { t: number; v: number; label?: string };

/** One category (a player, a server, a day of week). */
export type CategoryPoint = { key: string; label: string; v: number; href?: string; display?: string };

export type ChartFrame = {
  title: string;
  /** link for the title */
  href?: string;
  /** a mono line under the title: scope, "last 7 days", ... */
  sub?: string;
  /** the recorder's start for history-based charts: shown as "Recording since" and in the empty state */
  since?: number | null;
  /** epoch ms of the data; shown as "as of" in the footer when `stale` */
  asOf?: number;
  stale?: boolean;
  /** which twin to render; the page passes its ?view= */
  view?: View;
  /** the empty state's title and line when there is nothing to draw */
  emptyTitle?: string;
  emptyLine?: string;
};

export type ColumnChartProps = ChartFrame & {
  points: CategoryPoint[] | TimePoint[];
  unit?: Unit;
  /** readout for the hovered point: "<display> · <label>". Default from unit. */
  format?: (v: number) => string;
  /** height of the plot in px (default 160) */
  height?: number;
  /** highlight one key (the viewed player on a board, today on a time series) */
  highlight?: string;
};

export type LineChartProps = ChartFrame & {
  points: TimePoint[];
  unit?: Unit;
  format?: (v: number) => string;
  height?: number;
  /** y starts at 0 (default true) */
  zero?: boolean;
  /** a second, muted series drawn behind the first (waiting behind online) */
  shadow?: { label: string; points: TimePoint[] };
};

export type SparklineProps = {
  points: TimePoint[];
  /** width/height in px (default 120×28); drawn inline, no frame, no axes */
  width?: number;
  height?: number;
  /** text alternative */
  label: string;
};

export type HeatmapProps = ChartFrame & {
  /** rows × columns of values; null = no data (sunk), undefined cell in the future = hairline */
  rows: { label: string; cells: (number | null)[] }[];
  columns: string[];
  unit?: Unit;
  format?: (v: number) => string;
  /** the readout line for a cell: `${row} ${column}` by default */
  cellLabel?: (row: string, column: string) => string;
};

export type StatTileProps = {
  label: string;
  /** the formatted value as the API gives it (`display`), or the site's own formatStat */
  value: string;
  /** a small unit or qualifier after the value */
  unit?: string;
  /** mono line under the value: "as of 17:44 UTC", "since 4 Nov 2026", a change */
  note?: string;
  href?: string;
  /** an inline sparkline under the value */
  spark?: TimePoint[];
  sparkLabel?: string;
};

export type BarListProps = ChartFrame & {
  /** ranked rows, longest bar = max; `display` is the formatted value */
  rows: { rank: number; key: string; label: string; v: number; display: string; href?: string; uuid?: string }[];
  unit?: Unit;
  /** show faces beside labels (rows carry uuid) */
  faces?: boolean;
  highlight?: string;
};

/** A server's state over time as a strip: linked/unlinked, with online as the fill. */
export type UptimeStripProps = ChartFrame & {
  samples: { t: number; online: number; waiting: number; linked: boolean }[];
  /** bucket width in ms (default: range / 96) */
  bucketMs?: number;
};

/** The table twin of any chart: columns and rows, rendered as an fp-table. */
export type DataTableProps = {
  columns: { key: string; label: string; num?: boolean }[];
  rows: Record<string, string | number | null | undefined>[];
  caption?: string;
};
