// Metrics name a board or a ladder: "playtime", or a stat in criterion form (STATS §2):
// "mined:minecraft:stone" (type `minecraft:mined`, subject `minecraft:stone`), "mined:*" (type total),
// "create:pressed:minecraft:iron_ingot" (a modded type keeps its namespace). The subject is always
// the last two segments or "*"; the type is whatever comes before, with "minecraft:" dropped.

export type Metric = { kind: "playtime" } | { kind: "stat"; type: string; subject: string };

export const PLAYTIME: Metric = { kind: "playtime" };

/** Strips a leading "minecraft:" from a type key, as the API's criterion form does. */
export function shortType(type: string): string {
  return type.startsWith("minecraft:") ? type.slice(10) : type;
}

/** Adds "minecraft:" to a bare type key. */
export function fullType(type: string): string {
  return type.includes(":") ? type : `minecraft:${type}`;
}

export function metricKey(m: Metric): string {
  return m.kind === "playtime" ? "playtime" : `${shortType(m.type)}:${m.subject}`;
}

/** Parses a metric from a URL segment; null when malformed. */
export function parseMetric(s: string | null | undefined): Metric | null {
  if (!s) return null;
  if (s === "playtime") return PLAYTIME;
  const parts = s.split(":");
  if (parts.some((p) => p.length === 0)) return null;
  if (parts.length === 2 && parts[1] === "*") return { kind: "stat", type: fullType(parts[0]), subject: "*" };
  if (parts.length === 3) return { kind: "stat", type: fullType(parts[0]), subject: `${parts[1]}:${parts[2]}` };
  if (parts.length === 4) return { kind: "stat", type: `${parts[0]}:${parts[1]}`, subject: `${parts[2]}:${parts[3]}` };
  return null;
}

/** The site's own URL for a board: /leaderboards/<metric>. */
export function boardHref(m: Metric, scope?: string): string {
  const q = scope && scope !== "network" ? `?scope=${encodeURIComponent(scope)}` : "";
  return `/leaderboards/${encodeURIComponent(metricKey(m))}${q}`;
}
