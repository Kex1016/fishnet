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
