// TS port of cakeutils' core StatDisplay (STATS §7): the API already sends `display`; show that as
// given. This port is for values the site computes itself (composite boards, network totals, chart
// axes, milestone thresholds in the mock). Locale-independent, dot decimals, seconds truncated.
// W1 owns this directory and may extend it; the cases in tests/stat-display.test.ts come from
// cakeutils' StatDisplayTest and must keep passing.
//
// Rounding: Java's String.format("%.2f") rounds HALF_UP on the shortest decimal form of the double
// (1.005 → "1.01"), while JS toFixed rounds the binary value (1.005 → "1.00"). `fixed` below does
// what Java does, so 100 500 cm reads "1.01 km" here exactly as in the API's `display`.
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
      return `${fixed(value / 10, 1)} ♥`;
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
  return Math.abs(m) >= 1000 ? `${fixed(m / 1000, 2)} km` : `${fixed(m, 1)} m`;
}

/**
 * `x` with `digits` decimals, rounded half away from zero on its shortest decimal form, like Java's
 * `String.format(Locale.ROOT, "%.<digits>f", x)`. Keeps the sign of a negative that rounds to zero
 * ("-0.0", as Java prints it).
 */
export function fixed(x: number, digits: number): string {
  if (!Number.isFinite(x)) return String(x);
  const neg = x < 0;
  const s = String(Math.abs(x));
  if (/e/i.test(s)) return (neg ? "-" : "") + Math.abs(x).toFixed(digits); // < 1e-6 or ≥ 1e21: no tie possible at 1–2 digits
  const [int, frac = ""] = s.split(".");
  if (frac.length <= digits) return (neg ? "-" : "") + int + (digits ? "." + frac.padEnd(digits, "0") : "");
  // keep `digits` decimals, then round half up on the next digit, carrying through the integer part
  const kept = (int + frac.slice(0, digits)).split("").map(Number);
  if (Number(frac[digits]) >= 5) {
    let i = kept.length - 1;
    while (i >= 0 && kept[i] === 9) kept[i--] = 0;
    if (i < 0) kept.unshift(1);
    else kept[i]++;
  }
  const all = kept.join("");
  const ip = all.slice(0, all.length - digits) || "0";
  return (neg ? "-" : "") + ip + (digits ? "." + all.slice(all.length - digits) : "");
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
