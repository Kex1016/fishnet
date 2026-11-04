// Time helpers for the recorder: everything in epoch ms, buckets aligned to UTC.
import type { Range } from "../history.ts";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;

/** How far back each range reaches. */
export const RANGE_MS: Record<Range, number> = { day: DAY, week: WEEK, month: 30 * DAY };

/** The bucket width of a range's online series: day 5 min (288 points), week 1 h (168), month 6 h (120). */
export const RANGE_BUCKET: Record<Range, number> = { day: 5 * MINUTE, week: HOUR, month: 6 * HOUR };

/** Retention (PLAN §3.3): minute rows 30 days, hourly roll-ups and everything else two years. */
export const KEEP_MINUTES = 30 * DAY;
export const KEEP_LONG = 730 * DAY;
/** Board snapshots: hourly for 14 days, then the first of each UTC day. */
export const KEEP_HOURLY_BOARDS = 14 * DAY;

export function floorTo(t: number, step: number): number {
  return Math.floor(t / step) * step;
}

/** Monday 00:00 UTC of the week holding `t`. */
export function weekStart(t: number): number {
  const d = floorTo(t, DAY);
  const dow = (new Date(d).getUTCDay() + 6) % 7; // Monday = 0
  return d - dow * DAY;
}

/** 0 = Monday … 6 = Sunday, UTC. */
export function weekday(t: number): number {
  return (new Date(t).getUTCDay() + 6) % 7;
}

export function isRange(r: string): r is Range {
  return r === "day" || r === "week" || r === "month";
}
