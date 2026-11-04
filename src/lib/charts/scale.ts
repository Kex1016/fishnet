// Pure helpers behind the chart components (W3): nice axis ticks, compact tick labels, time tick
// labels, the SVG path of a line, column geometry and the uptime strip's buckets. No DOM, no Svelte,
// so bun:test covers them (tests/charts.test.ts).
import type { Unit } from "#lib/api/types.ts";
import { formatStat } from "#lib/format/stat-display.ts";
import { day, hm } from "#lib/format/dates.ts";
import type { TimePoint } from "./types.ts";

/** A "nice" step (1, 2, 2.5, 5 × 10^k) so that `max / step` lands between about 2 and `count` ticks. */
export function niceStep(max: number, count = 4): number {
  if (!(max > 0) || !Number.isFinite(max)) return 1;
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  const m = r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10;
  return m * mag;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Time steps that read well: minutes, hours, days, then weeks. */
const TIME_STEPS = [MIN, 2 * MIN, 5 * MIN, 10 * MIN, 15 * MIN, 30 * MIN, HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 5 * DAY, 7 * DAY, 14 * DAY, 30 * DAY];

/** A step for a time unit (ms, or ticks at 20 per second) so that ticks land on whole minutes, hours or days. */
export function niceTimeStep(max: number, count = 4, perMs = 1): number {
  const raw = max / count / perMs;
  for (const s of TIME_STEPS) if (s >= raw) return s * perMs;
  return niceStep(max / DAY / perMs, count) * DAY * perMs;
}

/** Tick values from 0 up to and including the first nice multiple at or above `max`. */
export function niceTicks(max: number, count = 4, unit?: Unit): number[] {
  if (!(max > 0) || !Number.isFinite(max)) return [0, 1];
  const step = unit === "ms" ? niceTimeStep(max, count) : unit === "ticks" ? niceTimeStep(max, count, 0.02) : niceStep(max, count);
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(round(v));
  return ticks;
}

function round(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

/** `top` of the axis: the last nice tick (≥ max, > 0). */
export function axisTop(max: number, count = 4, unit?: Unit): number {
  const t = niceTicks(max, count, unit);
  return t[t.length - 1];
}

/** Compact counts for axis ticks: 950, 1.2K, 10K, 3.4M. Full under 10 000. */
export function compact(v: number): string {
  const a = Math.abs(v);
  if (a < 10_000) return String(Math.round(v));
  const units: [number, string][] = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"]
  ];
  for (const [n, s] of units) {
    if (a >= n) {
      const x = v / n;
      return `${Number.isInteger(x) || Math.abs(x) >= 10 ? Math.round(x) : x.toFixed(1)}${s}`;
    }
  }
  return String(v);
}

/** The y-axis tick label for a unit: counts compact, everything else through formatStat. */
export function tickLabel(unit: Unit, v: number): string {
  if (v === 0) return "0";
  switch (unit) {
    case "count":
      return compact(v);
    case "ticks":
    case "ms":
    case "distance_cm":
    case "damage_tenths":
      return formatStat(unit, v);
    default:
      return compact(v);
  }
}

/** An x-axis label for a time point: the hour inside two days, the day beyond. */
export function timeLabel(t: number, spanMs: number): string {
  return spanMs <= 2 * 86_400_000 ? hm(t) : day(t).replace(/ \d{4}$/, "");
}

/** The readout label for a time point: "17:44 UTC" inside two days, "3 Nov, 16:00 UTC" inside a month, the day beyond. */
export function timeReadout(t: number, spanMs: number): string {
  if (spanMs <= 2 * 86_400_000) return `${hm(t)} UTC`;
  if (spanMs <= 31 * 86_400_000) return `${day(t).replace(/ \d{4}$/, "")}, ${hm(t)} UTC`;
  return day(t);
}

/** A floor for an axis that does not start at zero: the nice multiple at or below `min`, never below 0. */
export function niceFloor(min: number, max: number, count = 4): number {
  if (!(min > 0) || !(max > min)) return 0;
  const step = niceStep(max - min, count);
  return Math.max(0, Math.floor(min / step) * step);
}

/** Which of `n` evenly spaced labels to show so that each gets at least `minPx`: every k-th, first and last kept. */
export function labelEvery(n: number, slotPx: number, minPx: number): number {
  if (n <= 1 || slotPx >= minPx) return 1;
  return Math.ceil(minPx / Math.max(slotPx, 0.0001));
}

/** The width of a column inside a slot: at most `cap` (24px), at least 1px, leaving a 2px gap from its neighbours. */
export function columnWidth(slotPx: number, cap = 24): number {
  return Math.max(1, Math.min(cap, Math.floor(slotPx - 2)));
}

/** A column with rounded top corners (radius r) and a square base: the SVG path. */
export function columnPath(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0 || w <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  const x2 = x + w;
  const y2 = y + h;
  return `M${f(x)},${f(y2)}V${f(y + rr)}Q${f(x)},${f(y)} ${f(x + rr)},${f(y)}H${f(x2 - rr)}Q${f(x2)},${f(y)} ${f(x2)},${f(y + rr)}V${f(y2)}Z`;
}

function f(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** x of each point across [left, right] by time (not by index), so uneven samples land where they belong. */
export function xByTime(points: { t: number }[], left: number, right: number): number[] {
  if (points.length === 0) return [];
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const span = t1 - t0;
  if (span <= 0) return points.map(() => left);
  return points.map((p) => left + ((p.t - t0) / span) * (right - left));
}

/** y of a value on an axis from `top` (value) to the baseline. */
export function yOf(v: number, top: number, yTop: number, yBase: number): number {
  if (!(top > 0)) return yBase;
  return yBase - (Math.max(0, Math.min(v, top)) / top) * (yBase - yTop);
}

/** The SVG path through the points (straight segments; 2px round joins do the softening). */
export function linePath(xs: number[], ys: number[]): string {
  return xs.map((x, i) => `${i === 0 ? "M" : "L"}${f(x)},${f(ys[i])}`).join("");
}

/** The area under the line, closed on the baseline. */
export function areaPath(xs: number[], ys: number[], yBase: number): string {
  if (xs.length === 0) return "";
  return `${linePath(xs, ys)}L${f(xs[xs.length - 1])},${f(yBase)}L${f(xs[0])},${f(yBase)}Z`;
}

/** Index of the point nearest to x. */
export function nearestIndex(xs: number[], x: number): number {
  let best = 0;
  let d = Infinity;
  for (let i = 0; i < xs.length; i++) {
    const dd = Math.abs(xs[i] - x);
    if (dd < d) {
      d = dd;
      best = i;
    }
  }
  return best;
}

/** The highest value among points (0 when none). */
export function maxValue(points: { v: number }[]): number {
  let m = 0;
  for (const p of points) if (Number.isFinite(p.v) && p.v > m) m = p.v;
  return m;
}

export type UptimeBucket = {
  /** start and end of the bucket in epoch ms */
  t0: number;
  t1: number;
  /** samples inside; 0 = no data */
  n: number;
  /** mean online and waiting of the samples (0 when none) */
  online: number;
  waiting: number;
  /** linked for the whole bucket, part of it, none of it, or no samples */
  linked: "all" | "some" | "none" | "unknown";
};

/** Samples bucketed into fixed widths over [first, last]; a bucket without samples is `unknown`. */
export function uptimeBuckets(samples: { t: number; online: number; waiting: number; linked: boolean }[], bucketMs?: number, count = 96): UptimeBucket[] {
  if (samples.length < 2) return [];
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  const first = sorted[0].t;
  const last = sorted[sorted.length - 1].t;
  const span = Math.max(1, last - first);
  const width = bucketMs && bucketMs > 0 ? bucketMs : span / count;
  const n = Math.max(1, Math.ceil(span / width));
  const out: UptimeBucket[] = Array.from({ length: n }, (_, i) => ({ t0: first + i * width, t1: first + (i + 1) * width, n: 0, online: 0, waiting: 0, linked: "unknown" }));
  const linkedCount = new Array<number>(n).fill(0);
  for (const s of sorted) {
    const i = Math.min(n - 1, Math.floor((s.t - first) / width));
    const b = out[i];
    b.n++;
    b.online += s.online;
    b.waiting += s.waiting;
    if (s.linked) linkedCount[i]++;
  }
  for (let i = 0; i < n; i++) {
    const b = out[i];
    if (b.n === 0) continue;
    b.online /= b.n;
    b.waiting /= b.n;
    b.linked = linkedCount[i] === b.n ? "all" : linkedCount[i] === 0 ? "none" : "some";
  }
  return out;
}

/** Share of buckets with samples that were fully linked, 0..1 (null when none have samples). */
export function linkedShare(buckets: UptimeBucket[]): number | null {
  const known = buckets.filter((b) => b.linked !== "unknown");
  if (known.length === 0) return null;
  return known.filter((b) => b.linked === "all").length / known.length;
}

/** 0..4: which heat step a value takes against `max`; 0 for zero. */
export function heatLevel(v: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (!(v > 0) || !(max > 0)) return 0;
  return Math.min(4, Math.max(1, Math.ceil((v / max) * 4))) as 1 | 2 | 3 | 4;
}

/** Keep every point whose value is a finite number, in time order. */
export function cleanTime(points: TimePoint[]): TimePoint[] {
  return points.filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v)).sort((a, b) => a.t - b.t);
}
