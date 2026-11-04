// Pure helpers for the board pages (W6): names, scopes, the distribution and the numbers in the tiles.
// No server imports, so tests and components can use it. Everything here works on values the API
// gave us for ONE scope; nothing adds scopes together (cakeutils I3, G-16).
import type { CategoryPoint } from "#lib/charts/types.ts";
import type { LeaderboardEntry, Unit } from "#lib/api/types.ts";
import type { Scope } from "#lib/api/scope.ts";
import { parseScope } from "#lib/api/scope.ts";
import { isUuidName } from "#lib/players/names.ts";
import { axisTick } from "#lib/format/stat-display.ts";

/** How many players a board page loads before it stops (10 pages of 100); it says so when it did. */
export const BOARD_CAP = 1000;

type Named = { id: string; display_name: string };

/** "Network", "Survival" (a server's display name), "Skyblock 1" (a mini), or the raw id as a fallback. */
export function scopeLabel(scope: Scope | string, servers: Named[] = [], minis: { server: string; id: string; display_name: string }[] = []): string {
  const p = parseScope(scope);
  if (!p || p.kind === "network") return "Network";
  if (p.kind === "server") return servers.find((s) => s.id === p.server)?.display_name ?? p.server;
  return minis.find((m) => m.server === p.server && m.id === p.mini)?.display_name ?? p.mini;
}

/** Public mini-servers for the scope switch, plus the viewed one so the switch always shows where you are. */
export function scopeMinis(scope: Scope | string, listed: { server: string; id: string; display_name: string }[]): { server: string; id: string; display_name: string }[] {
  const out = listed.map((m) => ({ server: m.server, id: m.id, display_name: m.display_name }));
  const p = parseScope(scope);
  if (p?.kind === "mini" && !out.some((m) => m.server === p.server && m.id === p.mini)) out.push({ server: p.server, id: p.mini, display_name: p.mini });
  return out;
}

/** A player row created from a stat before login has the UUID as its name (PLAN §2.3). */
export function playerLabel(e: { uuid: string; name: string }): string {
  return isUuidName(e.name) ? `Player ${e.uuid.slice(0, 8)}` : e.name;
}

/** Profile link for a board row: the name, or the UUID when the name is one. */
export function playerHref(e: { uuid: string; name: string }): string {
  return `/players/${encodeURIComponent(isUuidName(e.name) ? e.uuid : e.name)}`;
}

export function sum(values: number[]): number {
  let t = 0;
  for (const v of values) t += v;
  return t;
}

/** The middle value (the mean of the two middle ones for an even count, rounded); null for no values. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** One step of the distribution's scale in raw units: a metre, an hour, a heart, a plain count. */
export function bucketBase(unit: Unit): number {
  switch (unit) {
    case "distance_cm":
      return 100;
    case "ticks":
      return 72_000;
    case "ms":
      return 3_600_000;
    case "damage_tenths":
      return 10;
    default:
      return 1;
  }
}

/**
 * Players by how much they have, in tenfold steps (1–10, 10–100, ...) of the unit's base step, from
 * the lowest to the highest occupied step with empty ones in between kept at 0. Values below the
 * base fall in a first "under X" step. Fewer than two occupied steps still returns what there is:
 * the chart shows its empty state itself.
 */
export function distribution(values: number[], unit: Unit): CategoryPoint[] {
  const positive = values.filter((v) => v > 0 && Number.isFinite(v));
  if (positive.length === 0) return [];
  const base = bucketBase(unit);
  const step = (v: number) => (v < base ? -1 : Math.floor(Math.log10(v / base) + 1e-9));
  const counts = new Map<number, number>();
  for (const v of positive) counts.set(step(v), (counts.get(step(v)) ?? 0) + 1);
  const lo = Math.min(...counts.keys());
  const hi = Math.max(...counts.keys());
  const out: CategoryPoint[] = [];
  for (let k = lo; k <= hi; k++) {
    const from = k < 0 ? 0 : base * 10 ** k;
    const to = base * 10 ** (k + 1);
    const label = k < 0 ? `under ${axisTick(unit, base)}` : `${axisTick(unit, from)} to ${axisTick(unit, to)}`;
    out.push({ key: String(k), label, v: counts.get(k) ?? 0, display: `${counts.get(k) ?? 0} ${(counts.get(k) ?? 0) === 1 ? "player" : "players"}` });
  }
  return out;
}

/** The entries as the rows a BarList takes. */
export function barRows(entries: LeaderboardEntry[]) {
  return entries.map((e) => ({ rank: e.rank, key: e.uuid, uuid: e.uuid, label: playerLabel(e), v: e.value, display: e.display, href: playerHref(e) }));
}
