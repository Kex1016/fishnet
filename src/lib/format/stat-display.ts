// TS port of cakeutils' core StatDisplay (STATS §7): the API already sends `display`; show that as
// given. This port is for values the site computes itself (composite boards, network totals, chart
// axes, milestone thresholds in the mock). Locale-independent, dot decimals, seconds truncated.
// W1 owns this directory and may extend it; the cases in tests/stat-display.test.ts come from
// cakeutils' StatDisplayTest and must keep passing.
import type { Unit } from "#lib/api/types.ts";

const TICKS_PER_SECOND = 20;

/** `count` plain; `distance_cm` 1.23 km / 45.6 m; `ticks` 1d 2h 3m; `damage_tenths` 12.5 ♥; `ms` like ticks. Unknown units: plain number. */
export function formatStat(unit: Unit, value: number): string {
  switch (unit) {
    case "distance_cm":
      return distance(value);
    case "ticks":
      return minutes(Math.trunc(Math.trunc(value / TICKS_PER_SECOND) / 60));
    case "damage_tenths":
      return `${(value / 10).toFixed(1)} ♥`;
    case "ms":
      return durationMs(value);
    case "count":
    default:
      return String(Math.trunc(value));
  }
}

/** A duration in milliseconds (playtime) in the ticks style: 1d 2h 3m. */
export function durationMs(ms: number): string {
  return minutes(Math.trunc(Math.trunc(ms / 1000) / 60));
}

function distance(cm: number): string {
  const m = cm / 100;
  return Math.abs(m) >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(1)} m`;
}

/** Whole minutes (truncated toward zero) as [<d>d ][<h>h ]<m>m, with a leading '-' when negative. */
function minutes(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? "-" : "";
  const mins = Math.abs(totalMinutes);
  const d = Math.floor(mins / (24 * 60));
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  if (d > 0) return `${sign}${d}d ${h}h ${m}m`;
  if (h > 0) return `${sign}${h}h ${m}m`;
  return `${sign}${m}m`;
}

/** The unit a chart axis should label: what one step of `value` means in words. */
export function unitLabel(unit: Unit): string {
  switch (unit) {
    case "count":
      return "";
    case "distance_cm":
      return "distance";
    case "ticks":
    case "ms":
      return "time";
    case "damage_tenths":
      return "damage";
    default:
      return unit;
  }
}

/** A short axis tick: 1.2k, 3.4M for counts; km/h for the others. */
export function axisTick(unit: Unit, value: number): string {
  switch (unit) {
    case "distance_cm":
      return value >= 100_000 ? `${trim(value / 100_000)} km` : `${trim(value / 100)} m`;
    case "ticks":
      return hours(value / TICKS_PER_SECOND / 3600);
    case "ms":
      return hours(value / 3_600_000);
    case "damage_tenths":
      return `${trim(value / 10)} ♥`;
    default:
      return compact(value);
  }
}

function hours(h: number): string {
  if (h >= 48) return `${trim(h / 24)}d`;
  if (h >= 1) return `${trim(h)}h`;
  return `${Math.round(h * 60)}m`;
}

/** 1234 → 1.2k, 1 234 567 → 1.2M. */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `${trim(n / 1_000_000_000)}B`;
  if (a >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (a >= 1_000) return `${trim(n / 1_000)}k`;
  return String(Math.round(n));
}

function trim(n: number): string {
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** 1234567 → "1 234 567" (thin spaces as the API's `count` display does not group; the site groups in tables). */
export function group(n: number): string {
  const s = String(Math.trunc(Math.abs(n)));
  const out = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (n < 0 ? "-" : "") + out;
}
