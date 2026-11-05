// The History interface (src/lib/server/history.ts) over the recorder's SQLite file. Every answer
// carries the `since` of its own series (when that series was first recorded, null = never), so a
// chart says "Recording since <date>" and shows its empty state under two points.
//
// Point values: online series give the bucket's PEAK (max of the minute samples), so a point reads
// "3 online" and never "2.4"; the activity heatmap gives the MEAN per weekday-hour. Scopes are read
// side by side, never added together.
import type { DayGrid, History, Point, Range, RankMove, RankMoves, Series, ServerSample, ServerSeries } from "../history.ts";
import { parseScope, type Scope } from "#lib/api/scope.ts";
import { metricKey, parseMetric } from "#lib/api/metric.ts";
import { FEATURED, type FeaturedBoard } from "#lib/boards.ts";
import { type Db, getMetaNumber, seriesSince } from "./db.ts";
import { DAY, HOUR, MINUTE, RANGE_BUCKET, RANGE_MS, WEEK, floorTo, isRange, weekStart, weekday } from "./time.ts";
import type { Hidden } from "./jobs.ts";

export type HistoryOptions = {
  now?: () => number;
  hidden?: Hidden;
  featured?: FeaturedBoard[];
  log?: (line: string) => void;
  /** awaited before every query (mock mode seeds its database first) */
  ready?: Promise<unknown>;
};

const EMPTY: Series = { since: null, points: [] };
const ID = /^[A-Za-z0-9._-]{1,64}$/;

type Bucket = { t: number; max: number; sum: number; n: number; waitingMax: number | null; linkedN: number };

/** A metric key from either a FEATURED board id ("mined") or a metric in criterion form ("mined:*"). */
export function resolveMetricKey(s: string, featured: FeaturedBoard[] = FEATURED): string | null {
  const b = featured.find((f) => f.id === s);
  if (b) return metricKey(b.metric);
  const m = parseMetric(s);
  return m ? metricKey(m) : null;
}

/** Only network and server scopes have online rows; minis come from presence polls. */
function onlineScope(scope: Scope): string | null {
  const p = parseScope(scope);
  if (!p) return null;
  return p.kind === "network" ? "network" : p.kind === "server" ? `server:${p.server}` : null;
}

export function createSqliteHistory(db: Db, o: HistoryOptions = {}): History {
  const now = o.now ?? Date.now;
  const hidden: Hidden = o.hidden ?? (() => false);
  const featured = o.featured ?? FEATURED;
  const log = o.log ?? ((l: string) => console.warn(l));
  let warned = false;

  /** Every method: never throws (a broken file means empty charts, not a 500). */
  function guard<A extends unknown[], R>(fallback: () => R, fn: (...a: A) => R): (...a: A) => Promise<R> {
    return async (...a: A) => {
      if (o.ready) await o.ready.catch(() => undefined);
      try {
        return fn(...a);
      } catch (e) {
        if (!warned) log(`fishnet recorder: history query failed, charts show no history: ${(e as Error).message}`);
        warned = true;
        return fallback();
      }
    };
  }

  /** Online buckets of one scope in [from, to): minute rows below an hour, roll-ups + the open hours above. */
  function onlineBuckets(scope: string, from: number, to: number, bucket: number): Bucket[] {
    const out = new Map<number, Bucket>();
    const add = (t: number, max: number, sum: number, n: number, waitingMax: number | null, linkedN: number) => {
      const b = floorTo(t, bucket);
      const x = out.get(b);
      if (!x) out.set(b, { t: b, max, sum, n, waitingMax, linkedN });
      else {
        x.max = Math.max(x.max, max);
        x.sum += sum;
        x.n += n;
        x.waitingMax = waitingMax === null ? x.waitingMax : Math.max(x.waitingMax ?? 0, waitingMax);
        x.linkedN += linkedN;
      }
    };
    type Row = { t: number; mx: number; sm: number; n: number; w: number | null; l: number };
    if (bucket < HOUR) {
      const rows = db
        .prepare(
          `SELECT (t / ${bucket}) * ${bucket} AS t, max(online) AS mx, sum(online) AS sm, count(*) AS n, max(waiting) AS w, sum(linked) AS l
           FROM online_minute WHERE scope = ? AND t >= ? AND t < ? GROUP BY 1 ORDER BY 1`
        )
        .all(scope, from, to) as Row[];
      for (const r of rows) add(Number(r.t), Number(r.mx), Number(r.sm), Number(r.n), r.w === null ? null : Number(r.w), Number(r.l));
    } else {
      const upto = Math.max(from, Math.min(to, getMetaNumber(db, "rollup_upto") ?? 0));
      const hours = db
        .prepare("SELECT t, online_max AS mx, online_mean * n AS sm, n, waiting_max AS w, linked_n AS l FROM online_hour WHERE scope = ? AND t >= ? AND t < ? ORDER BY t")
        .all(scope, from, upto) as Row[];
      const open = db
        .prepare(
          `SELECT (t / ${HOUR}) * ${HOUR} AS t, max(online) AS mx, sum(online) AS sm, count(*) AS n, max(waiting) AS w, sum(linked) AS l
           FROM online_minute WHERE scope = ? AND t >= ? AND t < ? GROUP BY 1 ORDER BY 1`
        )
        .all(scope, upto, to) as Row[];
      for (const r of [...hours, ...open]) add(Number(r.t), Number(r.mx), Number(r.sm), Number(r.n), r.w === null ? null : Number(r.w), Number(r.l));
    }
    return [...out.values()].sort((a, b) => a.t - b.t);
  }

  function window(range: Range, bucket: number): { from: number; to: number } {
    const t = now();
    return { from: floorTo(t - RANGE_MS[range], bucket), to: t + 1 };
  }

  /** One mini's presence: every bucket with a successful poll; no row for the mini in a poll = 0. */
  function miniSeries(server: string, range: Range, only?: string): Record<string, Series> {
    const bucket = Math.max(RANGE_BUCKET[range], 10 * MINUTE);
    const { from, to } = window(range, bucket);
    const polls = db.prepare("SELECT t FROM mini_poll WHERE t >= ? AND t < ? ORDER BY t").all(from, to) as { t: number }[];
    const rows = (
      only
        ? db.prepare("SELECT mini, t, players FROM mini_sample WHERE server = ? AND mini = ? AND t >= ? AND t < ?").all(server, only, from, to)
        : db.prepare("SELECT mini, t, players FROM mini_sample WHERE server = ? AND t >= ? AND t < ?").all(server, from, to)
    ) as { mini: string; t: number; players: number }[];
    const buckets = [...new Set(polls.map((p) => floorTo(Number(p.t), bucket)))];
    const byMini = new Map<string, Map<number, number>>();
    for (const r of rows) {
      const m = byMini.get(r.mini) ?? new Map<number, number>();
      const b = floorTo(Number(r.t), bucket);
      m.set(b, Math.max(m.get(b) ?? 0, Number(r.players)));
      byMini.set(r.mini, m);
    }
    const out: Record<string, Series> = {};
    for (const [mini, m] of [...byMini].sort(([a], [b]) => a.localeCompare(b))) {
      out[mini] = { since: seriesSince(db, `mini:${server}/${mini}`), points: buckets.map((t) => ({ t, v: m.get(t) ?? 0 })) };
    }
    return out;
  }

  const h: History = {
    recordingSince: guard(
      () => null,
      () => getMetaNumber(db, "recording_since")
    ),

    online: guard(
      () => EMPTY,
      (scope: Scope, range: Range): Series => {
        if (!isRange(range)) return EMPTY;
        const p = parseScope(scope);
        if (p?.kind === "mini") {
          const s = miniSeries(p.server, range, p.mini)[p.mini];
          return s ?? { since: seriesSince(db, `mini:${p.server}/${p.mini}`), points: [] };
        }
        const key = onlineScope(scope);
        if (!key) return EMPTY;
        const bucket = RANGE_BUCKET[range];
        const { from, to } = window(range, bucket);
        return { since: seriesSince(db, `online:${key}`), points: onlineBuckets(key, from, to, bucket).map((b) => ({ t: b.t, v: b.max })) };
      }
    ),

    onlineRecent: guard(
      () => EMPTY,
      (scope: Scope): Series => {
        const p = parseScope(scope);
        if (p?.kind === "mini") {
          const s = miniSeries(p.server, "day", p.mini)[p.mini];
          return s ? { since: s.since, points: s.points.slice(-60) } : { since: seriesSince(db, `mini:${p.server}/${p.mini}`), points: [] };
        }
        const key = onlineScope(scope);
        if (!key) return EMPTY;
        const rows = db.prepare("SELECT t, online FROM online_minute WHERE scope = ? AND t > ? ORDER BY t").all(key, now() - 60 * MINUTE) as { t: number; online: number }[];
        return { since: seriesSince(db, `online:${key}`), points: rows.map((r) => ({ t: Number(r.t), v: Number(r.online) })) };
      }
    ),

    server: guard(
      () => ({ since: null, samples: [] }),
      (id: string, range: Range): ServerSeries => {
        if (!ID.test(id) || !isRange(range)) return { since: null, samples: [] };
        const key = `server:${id}`;
        const bucket = RANGE_BUCKET[range];
        const { from, to } = window(range, bucket);
        const samples: ServerSample[] = onlineBuckets(key, from, to, bucket).map((b) => ({
          t: b.t,
          online: b.max,
          waiting: b.waitingMax ?? 0,
          // a bucket counts as linked when the backend was linked for at least half of its samples
          linked: b.linkedN * 2 >= b.n
        }));
        return { since: seriesSince(db, `online:${key}`), samples };
      }
    ),

    activityByHour: guard(
      () => ({ since: null, cells: [] }),
      (scope: Scope, range: Range) => {
        const key = onlineScope(scope);
        if (!key || !isRange(range)) return { since: null, cells: [] };
        const since = seriesSince(db, `online:${key}`);
        const { from, to } = window(range, HOUR);
        const hours = onlineBuckets(key, from, to, HOUR);
        if (!hours.length) return { since, cells: [] };
        const sum = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
        const n = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
        for (const b of hours) {
          const d = weekday(b.t);
          const hr = new Date(b.t).getUTCHours();
          sum[d][hr] += b.sum;
          n[d][hr] += b.n;
        }
        // cells[weekday][hour]: Monday first, UTC hours; null = no samples for that weekday-hour
        const cells = sum.map((row, d) => row.map((s, hr) => (n[d][hr] ? Math.round((s / n[d][hr]) * 100) / 100 : null)));
        return { since, cells };
      }
    ),

    miniPresence: guard(
      () => ({}),
      (server: string, range: Range) => (ID.test(server) && isRange(range) ? miniSeries(server, range) : {})
    ),

    networkTotal: guard(
      () => EMPTY,
      (metric: string, scope: Scope, range: Range): Series => {
        const key = resolveMetricKey(metric, featured);
        const p = parseScope(scope);
        if (!key || !p || !isRange(range)) return EMPTY;
        const rows = db
          .prepare("SELECT t, value FROM stat_total WHERE metric = ? AND scope = ? AND t >= ? ORDER BY t")
          .all(key, scope, now() - RANGE_MS[range]) as { t: number; value: number }[];
        return { since: seriesSince(db, `total:${key}:${scope}`), points: rows.map((r) => ({ t: Number(r.t), v: Number(r.value) })) };
      }
    ),

    rankMoves: guard(
      () => ({ since: null, moves: [] }),
      (metric: string, scope: Scope): RankMoves => {
        const key = resolveMetricKey(metric, featured);
        if (!key || !parseScope(scope)) return { since: null, moves: [] };
        const since = seriesSince(db, `board:${key}:${scope}`);
        const latest = (db.prepare("SELECT max(t) AS t FROM board_snapshot WHERE board = ? AND scope = ?").get(key, scope) as { t: number | null }).t;
        if (latest === null) return { since, moves: [] };
        const base = (db.prepare("SELECT min(t) AS t FROM board_snapshot WHERE board = ? AND scope = ? AND t >= ?").get(key, scope, Number(latest) - WEEK) as { t: number | null }).t;
        // one snapshot is not a movement
        if (base === null || Number(base) === Number(latest)) return { since, moves: [] };
        type E = { uuid: string; name: string; rank: number; value: number; display: string };
        const entries = (t: number) => db.prepare("SELECT uuid, name, rank, value, display FROM board_entry WHERE board = ? AND scope = ? AND t = ? ORDER BY rank, uuid").all(key, scope, t) as E[];
        const before = new Map(entries(Number(base)).map((e) => [e.uuid, Number(e.rank)]));
        const moves: RankMove[] = entries(Number(latest))
          .filter((e) => !hidden(e))
          .map((e) => ({ uuid: e.uuid, name: e.name, rank: Number(e.rank), before: before.get(e.uuid) ?? null, value: Number(e.value), display: e.display }));
        return { since, moves };
      }
    ),

    milestonesPerDay: guard(
      () => ({ since: null, days: [] }),
      (scope: Scope, range: Range): DayGrid => {
        if (!parseScope(scope) || !isRange(range)) return { since: null, days: [] };
        const recorded = seriesSince(db, `milestones:${scope}`);
        if (recorded === null) return { since: null, days: [] };
        // the API's reached_at predates our recording: the grid starts at the first dated milestone
        const first = (db.prepare("SELECT min(reached_at) AS t FROM milestone WHERE scope = ? AND backfilled = 0 AND reached_at IS NOT NULL").get(scope) as { t: number | null }).t;
        const since = first === null ? recorded : Math.min(recorded, Number(first));
        const today = floorTo(now(), DAY);
        const span = Math.round(RANGE_MS[range] / DAY);
        const start = Math.max(today - (span - 1) * DAY, floorTo(since, DAY));
        const rows = db
          .prepare("SELECT uuid, name, reached_at FROM milestone WHERE scope = ? AND backfilled = 0 AND reached_at >= ? AND reached_at < ?")
          .all(scope, start, today + DAY) as { uuid: string | null; name: string | null; reached_at: number }[];
        const counts = new Map<number, number>();
        for (const r of rows) {
          if ((r.uuid || r.name) && hidden({ uuid: r.uuid ?? "", name: r.name ?? "" })) continue;
          const d = floorTo(Number(r.reached_at), DAY);
          counts.set(d, (counts.get(d) ?? 0) + 1);
        }
        const days: DayGrid["days"] = [];
        for (let d = start; d <= today; d += DAY) days.push({ day: d, v: counts.get(d) ?? 0 });
        return { since, days };
      }
    ),

    advancementsPerDay: guard(
      () => ({ since: null, days: [] }),
      (scope: Scope, range: Range): DayGrid => {
        if (!parseScope(scope) || !isRange(range)) return { since: null, days: [] };
        const recorded = seriesSince(db, `advancements:${scope}`);
        if (recorded === null) return { since: null, days: [] };
        // earned_at predates our recording (imports reach back months): the grid starts at the earliest first
        const first = (db.prepare("SELECT min(earned_at) AS t FROM advancement_first WHERE scope = ?").get(scope) as { t: number | null }).t;
        const since = first === null ? recorded : Math.min(recorded, Number(first));
        const today = floorTo(now(), DAY);
        const span = Math.round(RANGE_MS[range] / DAY);
        const start = Math.max(today - (span - 1) * DAY, floorTo(since, DAY));
        const rows = db
          .prepare("SELECT uuid, name, earned_at FROM advancement_first WHERE scope = ? AND earned_at >= ? AND earned_at < ?")
          .all(scope, start, today + DAY) as { uuid: string | null; name: string | null; earned_at: number }[];
        const counts = new Map<number, number>();
        for (const r of rows) {
          if ((r.uuid || r.name) && hidden({ uuid: r.uuid ?? "", name: r.name ?? "" })) continue;
          const d = floorTo(Number(r.earned_at), DAY);
          counts.set(d, (counts.get(d) ?? 0) + 1);
        }
        const days: DayGrid["days"] = [];
        for (let d = start; d <= today; d += DAY) days.push({ day: d, v: counts.get(d) ?? 0 });
        return { since, days };
      }
    ),

    joinsPerWeek: guard(
      () => EMPTY,
      (range: Range): Series => {
        if (!isRange(range)) return EMPTY;
        // until every player's first_seen is known, a count per week would be short: show nothing
        if ((getMetaNumber(db, "players_complete") ?? 0) !== 1) return EMPTY;
        const rows = db.prepare("SELECT uuid, name, first_seen FROM player WHERE first_seen IS NOT NULL").all() as { uuid: string; name: string; first_seen: number }[];
        const visible = rows.filter((r) => !hidden(r));
        if (!visible.length) return { since: seriesSince(db, "players"), points: [] };
        const since = Math.min(...visible.map((r) => Number(r.first_seen)));
        const t = now();
        const start = Math.max(weekStart(t - RANGE_MS[range] + 1), weekStart(since));
        const counts = new Map<number, number>();
        for (const r of visible) {
          const w = weekStart(Number(r.first_seen));
          if (w >= start) counts.set(w, (counts.get(w) ?? 0) + 1);
        }
        const points: Point[] = [];
        for (let w = start; w <= weekStart(t); w += WEEK) points.push({ t: w, v: counts.get(w) ?? 0 });
        return { since, points };
      }
    )
  };
  return h;
}
