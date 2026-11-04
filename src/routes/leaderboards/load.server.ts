// A whole board in one scope for the board page: the first BOARD_CAP players, 100 per request (the API's
// maximum), so the top 10, the distribution, the tiles and every table page come from the same
// cached calls. `capped` says there are more players than were loaded.
import type { Client } from "#lib/server/cakeutils/client.ts";
import type { Metric } from "#lib/api/metric.ts";
import type { Scope } from "#lib/api/scope.ts";
import { ok, type Result } from "#lib/api/result.ts";
import type { LeaderboardEntry, Unit } from "#lib/api/types.ts";
import { withoutHidden } from "#lib/server/hidden.ts";
import { BOARD_CAP } from "./board.ts";

export type FullBoard = { metric: string; scope: string; unit: Unit; total: number; entries: LeaderboardEntry[]; capped: boolean };

export async function loadBoard(c: Pick<Client, "leaderboard">, metric: Metric, scope: Scope): Promise<Result<FullBoard>> {
  const first = await c.leaderboard(metric, scope, { limit: 100, offset: 0 });
  if (!first.ok) return first;
  const total = first.data.total;
  const offsets: number[] = [];
  for (let o = 100; o < Math.min(total, BOARD_CAP); o += 100) offsets.push(o);
  const rest = await Promise.all(offsets.map((offset) => c.leaderboard(metric, scope, { limit: 100, offset })));
  const entries = [...first.data.entries];
  let stale = first.stale;
  let asOf = first.asOf;
  for (const r of rest) {
    if (!r.ok) return r;
    entries.push(...r.data.entries);
    stale ||= r.stale;
    asOf = Math.min(asOf, r.asOf);
  }
  const data: FullBoard = {
    metric: first.data.metric,
    scope: first.data.scope,
    unit: first.data.unit,
    total,
    entries: withoutHidden(entries),
    capped: total > BOARD_CAP
  };
  return ok(data, asOf, { stale, empty: total === 0 });
}
