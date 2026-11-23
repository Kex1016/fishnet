// Chart props, frozen by W0 (PLAN §3.1, §6). Pages use them as they are; H1 (the haiiro redesign) added
// only the optional `path` and `level` to the frame.
//
// Rules every chart follows: one hue (foam; iris for a second measure; the current bucket gold); heat
// steps differ in lightness; columns ≤ 24px, square, on one hairline base; a step line instead of a
// polyline; a readout above the plot (Jacquard 24) that follows hover and keyboard focus; a table twin
// behind `view`; fewer than two points → the window, the empty state inside it and "Recording since
// <date>" when `since` is set; rendered on the server as HTML (no script needed to see a chart).
import type { Unit } from "#lib/api/types.ts";

export type View = "charts" | "tables";

/** One point in time. `label` overrides the formatted time in readouts and tables. */
export type TimePoint = { t: number; v: number; label?: string };

/** One category (a player, a server, a day of week). */
export type CategoryPoint = { key: string; label: string; v: number; href?: string; display?: string };

export type ChartFrame = {
  title: string;
  /** the window's label, "~/history/online" (default: the title as a path, "~/online-over-the-week") */
  path?: string;
  /** the heading's level (default 2; 3 inside a window that has its own h2) */
  level?: 2 | 3;
  /** link for the title */
  href?: string;
  /** the quiet line on the right of the heading: scope, "last 7 days", ... */
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

/** The table twin of any chart: columns and rows, rendered as an fx-table. */
export type DataTableProps = {
  columns: { key: string; label: string; num?: boolean }[];
  rows: Record<string, string | number | null | undefined>[];
  caption?: string;
};
