// Composite boards (PLAN §3.4, "Travel"): the per-player values of several stats are added together,
// each read inside ONE scope. Never a sum across scopes (cakeutils I3, G-16).
//
// How: page the first part's full board for the set of players, then read every part for them with
// `players:batch` (100 players and up to 32 stats per call) and add the values whose unit matches the
// board's. A stat nobody recorded is simply missing from the batch answer and counts as 0.
// Cost for a few hundred players: a handful of requests, then the answer is memoised for 15 s so the
// index page, the board page and every visitor share one build.
import type { Client } from "#lib/server/cakeutils/client.ts";
import type { CompositeBoard } from "#lib/boards.ts";
import type { Scope } from "#lib/api/scope.ts";
import { shortType, type Metric } from "#lib/api/metric.ts";
import { fail, ok, type Result } from "#lib/api/result.ts";
import type { Leaderboard, LeaderboardEntry } from "#lib/api/types.ts";
import { formatStat } from "#lib/format/stat-display.ts";
import { withoutHidden } from "#lib/server/hidden.ts";
import { loadBoard } from "./load.server.ts";

export type CompositeData = Leaderboard & { capped: boolean };

type Reader = Pick<Client, "leaderboard" | "batch">;

const TTL_MS = 15_000;
const memo = new Map<string, { at: number; value: Promise<Result<CompositeData>> }>();

/** `stats:<type>:<subject>` as `players:batch` takes it. Playtime is not a stat and cannot be a part. */
export function includeFor(m: Metric): string | null {
  return m.kind === "stat" ? `stats:${shortType(m.type)}:${m.subject}` : null;
}

export function compositeBoard(c: Reader, b: CompositeBoard, scope: Scope, now: () => number = Date.now): Promise<Result<CompositeData>> {
  const key = `${b.id}|${scope}`;
  const t = now();
  const hit = memo.get(key);
  if (hit && t - hit.at < TTL_MS) return hit.value;
  for (const [k, v] of memo) if (t - v.at >= TTL_MS) memo.delete(k);
  const value = build(c, b, scope);
  memo.set(key, { at: t, value });
  void value.then((r) => {
    if (!r.ok && memo.get(key)?.value === value) memo.delete(key); // never keep a failure
  });
  return value;
}

/** Forget memoised boards (tests). */
export function resetCompositeMemo(): void {
  memo.clear();
}

async function build(c: Reader, b: CompositeBoard, scope: Scope): Promise<Result<CompositeData>> {
  const universe = b.parts[b.universe ?? 0];
  const includes = b.parts.map(includeFor).filter((s): s is string => s !== null);
  if (!universe || includes.length === 0 || includes.length > 32) return fail("bad_request");

  // 1. the players: the universe part's board (hidden players already dropped)
  const base = await loadBoard(c, universe, scope);
  if (!base.ok) return base;
  const players = base.data.entries;
  let stale = base.stale;
  let asOf = base.asOf;

  // 2. their values for every part
  const refs = players.map((p) => p.uuid);
  const chunks: string[][] = [];
  for (let i = 0; i < refs.length; i += 100) chunks.push(refs.slice(i, i + 100));
  const batches = await Promise.all(chunks.map((chunk) => c.batch(chunk, includes, scope)));
  const names = new Map(players.map((p) => [p.uuid, p.name]));
  const rows: { uuid: string; name: string; value: number }[] = [];
  for (const r of batches) {
    if (!r.ok) return r;
    stale ||= r.stale;
    asOf = Math.min(asOf, r.asOf);
    for (const p of r.data.players) {
      let value = 0;
      for (const sv of Object.values(p.stats ?? {})) if (sv.unit === b.unit && sv.value > 0) value += sv.value;
      if (value > 0) rows.push({ uuid: p.uuid, name: names.get(p.uuid) ?? p.name, value });
    }
  }
  rows.sort((x, y) => y.value - x.value || (x.uuid < y.uuid ? -1 : x.uuid > y.uuid ? 1 : 0));
  const entries: LeaderboardEntry[] = rows.map((r, i) => ({ rank: i + 1, uuid: r.uuid, name: r.name, value: r.value, unit: b.unit, display: formatStat(b.unit, r.value) }));
  const data: CompositeData = { metric: b.id, scope, unit: b.unit, total: entries.length, entries, capped: base.data.capped };
  return ok(data, asOf, { stale, empty: entries.length === 0 });
}
