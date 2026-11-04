// Dates read "4 Nov 2026"; times are UTC and say so (reki's voice; PLAN §2.2, §6).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function day(ms: number | Date): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "4 Nov 2026, 17:44 UTC" */
export function dateTime(ms: number | Date): string {
  const d = new Date(ms);
  return `${day(d)}, ${hm(d)} UTC`;
}

/** "17:44" (UTC) */
export function hm(ms: number | Date): string {
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** "as of 17:44 UTC" today, "as of 3 Nov 2026, 17:44 UTC" otherwise. */
export function asOf(ms: number, now = Date.now()): string {
  const a = new Date(ms);
  const n = new Date(now);
  const sameDay = a.getUTCFullYear() === n.getUTCFullYear() && a.getUTCMonth() === n.getUTCMonth() && a.getUTCDate() === n.getUTCDate();
  return sameDay ? `as of ${hm(a)} UTC` : `as of ${dateTime(a)}`;
}

/** "2 min ago", "3 h ago", "5 days ago", else the day. Whole units, never "just now" past a minute. */
export function ago(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d} day${d === 1 ? "" : "s"} ago`;
  return day(ms);
}

/** ISO date for <time datetime>. */
export function iso(ms: number | Date): string {
  return new Date(ms).toISOString();
}
