// Featured boards that count more than one stat (src/lib/boards.ts `also`): "Diamond ore" is
// minecraft:diamond_ore plus minecraft:deepslate_diamond_ore. Vanilla keeps one stat per block, so the
// API answers each ore on its own board; this file adds a player's values of those stats together,
// inside ONE scope (adding players' stats in one scope is fine; scopes are never added, cakeutils I3,
// G-16), ranks the sums and pages them like any API board.
//
// `readerFor(c, b)` returns a `leaderboard` reader that answers the board's own metric with the
// combined board and passes every other metric through, so the helpers that walk a board (home and
// server totals, the board page, the recorder) work on it unchanged.
import type { Client } from "#lib/server/cakeutils/client.ts";
import type { FeaturedBoard } from "#lib/boards.ts";
import { metricKey, type Metric } from "#lib/api/metric.ts";
import type { Scope } from "#lib/api/scope.ts";
import type { BoardHistory } from "#lib/network/types.ts";
import { fail, ok, type Result } from "#lib/api/result.ts";
import type { Leaderboard, LeaderboardEntry, Unit } from "#lib/api/types.ts";
import { formatStat } from "#lib/format/stat-display.ts";

type Reader = Pick<Client, "leaderboard">;
type Page = { limit?: number; offset?: number };

const PAGE = 100;
/** Most pages read per part (2 000 players), as the home totals do. */
const MAX_PAGES = 20;
const TTL_MS = 15_000;

/** Every stat the board counts: its metric first, then `also`. */
export function boardParts(b: FeaturedBoard): Metric[] {
  return [b.metric, ...(b.also ?? [])];
}

type Merged = { board: Leaderboard; asOf: number; stale: boolean };
const memo = new WeakMap<Reader, Map<string, { at: number; value: Promise<Result<Merged>> }>>();

/** One page of a featured board in a scope: the API's own board, or the combined one when `also` is set. */
export async function featuredLeaderboard(c: Reader, b: FeaturedBoard, scope: Scope, page: Page = {}, now: () => number = Date.now): Promise<Result<Leaderboard>> {
  if (!b.also?.length) return c.leaderboard(b.metric, scope, page);
  const m = await merged(c, b, scope, now);
  if (!m.ok) return m;
  const offset = Math.max(0, page.offset ?? 0);
  const limit = Math.max(1, page.limit ?? 50);
  const board = { ...m.data.board, entries: m.data.board.entries.slice(offset, offset + limit) };
  return ok(board, m.data.asOf, { stale: m.data.stale, empty: m.data.board.total === 0 });
}

/** A `leaderboard` reader for code that walks one board: the board's metric reads the combined board. */
export function readerFor(c: Reader, b: FeaturedBoard): Reader {
  if (!b.also?.length) return c;
  const key = metricKey(b.metric);
  return {
    leaderboard: (metric, scope, page) => (metricKey(metric) === key ? featuredLeaderboard(c, b, scope ?? "network", page ?? {}) : c.leaderboard(metric, scope, page))
  } as Reader;
}

function merged(c: Reader, b: FeaturedBoard, scope: Scope, now: () => number): Promise<Result<Merged>> {
  const byKey = memo.get(c) ?? new Map<string, { at: number; value: Promise<Result<Merged>> }>();
  memo.set(c, byKey);
  const key = `${b.id}|${scope}`;
  const t = now();
  const hit = byKey.get(key);
  if (hit && t - hit.at < TTL_MS) return hit.value;
  for (const [k, v] of byKey) if (t - v.at >= TTL_MS) byKey.delete(k);
  const value = build(c, b, scope);
  byKey.set(key, { at: t, value });
  void value.then((r) => {
    if (!r.ok && byKey.get(key)?.value === value) byKey.delete(key); // never keep a failure
  });
  return value;
}

/** Every page of one part (up to MAX_PAGES). A part nobody recorded (404) is an empty board. */
async function readPart(c: Reader, m: Metric, scope: Scope): Promise<Result<Leaderboard> | null> {
  const first = await c.leaderboard(m, scope, { limit: PAGE, offset: 0 });
  if (!first.ok) return first.kind === "not_found" ? null : first;
  const pages = Math.min(Math.ceil(first.data.total / PAGE), MAX_PAGES);
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => c.leaderboard(m, scope, { limit: PAGE, offset: (i + 1) * PAGE })));
  const entries = [...first.data.entries];
  let stale = first.stale;
  let asOf = first.asOf;
  for (const r of rest) {
    if (!r.ok) return r;
    entries.push(...r.data.entries);
    stale ||= r.stale;
    asOf = Math.min(asOf, r.asOf);
  }
  return ok({ ...first.data, entries }, asOf, { stale, empty: first.data.total === 0 });
}

async function build(c: Reader, b: FeaturedBoard, scope: Scope): Promise<Result<Merged>> {
  const parts = await Promise.all(boardParts(b).map((m) => readPart(c, m, scope)));
  const found = parts.filter((p): p is Result<Leaderboard> => p !== null);
  for (const p of found) if (!p.ok) return p;
  const oks = found as Extract<Result<Leaderboard>, { ok: true }>[];
  if (oks.length === 0) return fail("not_found"); // nobody has done any of it yet
  // the unit is the first answering part's; a part in another unit is never added
  const unit = oks[0].data.unit;
  const rows = new Map<string, { uuid: string; name: string; value: number }>();
  for (const p of oks) {
    if (p.data.unit !== unit) continue;
    for (const e of p.data.entries) {
      const row = rows.get(e.uuid);
      if (row) row.value += e.value;
      else rows.set(e.uuid, { uuid: e.uuid, name: e.name, value: e.value });
    }
  }
  const sorted = [...rows.values()].filter((r) => r.value > 0).sort((x, y) => y.value - x.value || (x.uuid < y.uuid ? -1 : x.uuid > y.uuid ? 1 : 0));
  const entries: LeaderboardEntry[] = sorted.map((r, i) => ({ rank: i + 1, uuid: r.uuid, name: r.name, value: r.value, unit, display: formatStat(unit as Unit, r.value) }));
  const excluded = oks[0].data.excluded;
  const board: Leaderboard = { metric: b.id, scope: oks[0].data.scope, unit, total: entries.length, entries, ...(excluded ? { excluded } : {}) };
  return ok({ board, asOf: Math.min(...oks.map((p) => p.asOf)), stale: oks.some((p) => p.stale) }, Date.now());
}

// ---- the leader per day of a combined board, from each part's daily top (cakeutils history route)

type History = BoardHistory;
type Day = History["days"][number];
type DayRow = Day["entries"][number];

/**
 * The combined board's leader on each day, from every part's daily top `limit` players. A day is kept
 * only when the leader is certain: the leader's sum is exact (every part lists them, or a part listing
 * fewer than `limit` players has nobody else), and no other visible player can reach it, counting a
 * part's last listed value as the most an unlisted player can have there. Otherwise the day is left
 * out, never guessed. `parts`: one answer per part, null for a part nobody has recorded (404).
 * Hidden players are never the leader; they still count toward the bounds.
 */
export function combinedLeaders(id: string, parts: (Result<History> | null)[], limit: number, hidden: (e: DayRow) => boolean): Result<History> {
  const answered = parts.filter((p): p is Result<History> => p !== null);
  for (const p of answered) if (!p.ok) return p;
  const oks = answered as Extract<Result<History>, { ok: true }>[];
  if (oks.length === 0) return fail("not_found");
  const first = oks[0].data;
  if (oks.some((p) => p.data.tracked === false || p.data.unit !== first.unit)) return ok({ metric: id, scope: first.scope, unit: first.unit, tracked: false, days: [] }, oks[0].asOf);
  const byDay = oks.map((p) => new Map(p.data.days.map((d) => [String(d.day), d.entries])));
  const days: Day[] = [];
  for (const day of byDay[0].keys()) {
    const lists = byDay.map((m) => m.get(day));
    if (lists.some((l) => l === undefined)) continue; // a part has no snapshot that day
    const bounds = lists.map((l) => (l!.length < limit ? 0 : Math.min(...l!.map((e) => e.value))));
    const rows = new Map<string, { row: DayRow; low: number; high: number }>();
    lists.forEach((l) => {
      const seen = new Set<string>();
      for (const e of l!) {
        if (seen.has(e.uuid)) continue;
        seen.add(e.uuid);
        const r = rows.get(e.uuid) ?? { row: e, low: 0, high: 0 };
        r.low += e.value;
        rows.set(e.uuid, r);
      }
    });
    for (const [uuid, r] of rows) r.high = r.low + lists.reduce((a, l, i) => a + (l!.some((e) => e.uuid === uuid) ? 0 : bounds[i]), 0);
    const visible = [...rows.values()].filter((r) => !hidden(r.row));
    const best = visible.filter((r) => r.low === r.high).sort((a, b) => b.low - a.low || (a.row.uuid < b.row.uuid ? -1 : 1))[0];
    if (!best || best.low <= 0) continue;
    const outsider = bounds.reduce((a, b) => a + b, 0);
    if (outsider > best.low || visible.some((r) => r !== best && r.high > best.low)) continue;
    days.push({ day, entries: [{ rank: 1, uuid: best.row.uuid, name: best.row.name, value: best.low, display: formatStat((first.unit ?? "count") as Unit, best.low) }] });
  }
  return ok({ metric: id, scope: first.scope, unit: first.unit, tracked: true, days }, Math.min(...oks.map((p) => p.asOf)), { stale: oks.some((p) => p.stale) });
}
