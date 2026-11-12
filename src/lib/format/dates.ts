// Dates read "4 Nov 2026". Everything is stored and sent in UTC (epoch ms); a single moment is shown in the
// visitor's own time zone and says which ("17:44 CET"), David 12 Nov 2026. The zone comes from a `tz` cookie the
// browser sets (hooks.server.ts, +layout.svelte); until it does, the zone is UTC. Charts bucketed by UTC day or
// hour keep UTC labels (`utcDay`, `utcHm`) and say so, because their buckets are UTC.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let source: () => string = () => "UTC";
/** Where the current time zone comes from: per request on the server, the browser's zone in the browser. */
export function setZoneSource(f: () => string): void {
  source = f;
}
/** The current IANA time zone ("Europe/Budapest"), UTC when unknown. */
export function zone(): string {
  return source() || "UTC";
}

/** A zone name the runtime knows, else null (cookie input is untrusted). */
export function validZone(z: string | null | undefined): string | null {
  if (!z || z.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(z)) return null;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: z });
    return z;
  } catch {
    return null;
  }
}

type Parts = { y: number; mo: number; d: number; h: number; mi: number; name: string };
const formats = new Map<string, Intl.DateTimeFormat>();
function parts(ms: number | Date, z = zone()): Parts {
  const t = new Date(ms);
  if (z === "UTC") return { y: t.getUTCFullYear(), mo: t.getUTCMonth(), d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), name: "UTC" };
  let f = formats.get(z);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone: z, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" });
    formats.set(z, f);
  }
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(t)) p[x.type] = x.value;
  return { y: +p.year, mo: +p.month - 1, d: +p.day, h: +p.hour % 24, mi: +p.minute, name: shortName(t, z, p.timeZoneName) };
}
// British English names European zones ("CET", "BST") and American English American ones ("EST"); either
// falls back to an offset ("GMT+9"), which is fine
const us = new Map<string, Intl.DateTimeFormat>();
function shortName(t: Date, z: string, gb: string | undefined): string {
  if (gb && !/^GMT[+-]/.test(gb)) return gb;
  let f = us.get(z);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: z, timeZoneName: "short" });
    us.set(z, f);
  }
  const name = f.formatToParts(t).find((x) => x.type === "timeZoneName")?.value;
  return name && !/^GMT[+-]/.test(name) ? name : (gb ?? name ?? z);
}
const two = (n: number) => String(n).padStart(2, "0");

/** "4 Nov 2026", in the visitor's zone. */
export function day(ms: number | Date): string {
  const p = parts(ms);
  return `${p.d} ${MONTHS[p.mo]} ${p.y}`;
}

/** "17:44", in the visitor's zone (no zone name: callers that show a time alone add `zoneName`). */
export function hm(ms: number | Date): string {
  const p = parts(ms);
  return `${two(p.h)}:${two(p.mi)}`;
}

/** The zone's short name at that moment: "UTC", "CET", "GMT+9". */
export function zoneName(ms: number | Date): string {
  return parts(ms).name;
}

/** "4 Nov 2026, 17:44 CET" */
export function dateTime(ms: number | Date): string {
  const p = parts(ms);
  return `${p.d} ${MONTHS[p.mo]} ${p.y}, ${two(p.h)}:${two(p.mi)} ${p.name}`;
}

/** "as of 17:44 CET" today, "as of 3 Nov 2026, 17:44 CET" otherwise (today in the visitor's zone). */
export function asOf(ms: number, now = Date.now()): string {
  const a = parts(ms);
  const n = parts(now);
  const sameDay = a.y === n.y && a.mo === n.mo && a.d === n.d;
  return sameDay ? `as of ${two(a.h)}:${two(a.mi)} ${a.name}` : `as of ${dateTime(ms)}`;
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

/** "4 Nov 2026" in UTC: for UTC day buckets. */
export function utcDay(ms: number | Date): string {
  const p = parts(ms, "UTC");
  return `${p.d} ${MONTHS[p.mo]} ${p.y}`;
}

/** "17:44" in UTC: for UTC hour buckets. */
export function utcHm(ms: number | Date): string {
  const p = parts(ms, "UTC");
  return `${two(p.h)}:${two(p.mi)}`;
}

/** ISO date for <time datetime>. */
export function iso(ms: number | Date): string {
  return new Date(ms).toISOString();
}
