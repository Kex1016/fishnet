// The recorder's jobs (PLAN §3.3). Each one reads the API through the site's client and writes one
// transaction. Rules every job follows:
//   - only fresh answers are recorded: a failure or a `stale` (served-from-cache-while-down) answer
//     writes nothing, so cakeutils being down shows up as a gap, never as a made-up sample;
//   - scopes are stored side by side, never added together (I3, G-16);
//   - opted-out players are dropped before anything is stored;
//   - a sum is written only when every page of a board was read (no partial totals).
import type { Client } from "../cakeutils/client.ts";
import type { Result } from "#lib/api/result.ts";
import type { Leaderboard, MilestoneFeedRow } from "#lib/api/types.ts";
import type { Scope } from "#lib/api/scope.ts";
import { metricKey, type Metric } from "#lib/api/metric.ts";
import { FEATURED, type FeaturedBoard } from "#lib/boards.ts";
import { type Db, getMeta, getMetaNumber, registerSeries, seriesSince, setMeta, tx } from "./db.ts";
import { DAY, HOUR, KEEP_HOURLY_BOARDS, KEEP_LONG, KEEP_MINUTES, MINUTE, floorTo } from "./time.ts";

export type Hidden = (p: { uuid: string; name: string }) => boolean;

export type RecorderDeps = {
  db: Db;
  client: Client;
  now: () => number;
  hidden: Hidden;
  log: (line: string) => void;
  /** the boards to snapshot and total; default FEATURED from src/lib/boards.ts */
  featured?: FeaturedBoard[];
};

/** ok = recorded; skipped = nothing to record (feature off, nothing new); down = try again soon. */
export type Outcome = "ok" | "skipped" | "down";

const PAGE = 100;
/** Page caps, so one job never turns into a flood: playtime board 10 pages, totals 50, players 100. */
export const CAPS = { playtimePages: 10, totalPages: 50, playerPages: 100, profilesPerRun: 30, milestonePagesFirst: 20, milestonePages: 3 };

const ID = /^[A-Za-z0-9._-]{1,64}$/;

function fresh<T>(r: Result<T>): T | null {
  return r.ok && !r.stale ? r.data : null;
}

/** A finite integer from untrusted JSON, or null. */
function int(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? Math.trunc(x) : null;
}

function str(x: unknown): string | null {
  return typeof x === "string" ? x : null;
}

/** Server ids the latest network sample listed (for per-server work). */
export function knownServers(db: Db): string[] {
  const last = db.prepare("SELECT max(t) AS t FROM online_minute WHERE scope = 'network'").get() as { t: number | null };
  if (last.t === null) return [];
  return (db.prepare("SELECT scope FROM online_minute WHERE t = ? AND scope LIKE 'server:%' ORDER BY scope").all(last.t) as { scope: string }[]).map((r) =>
    r.scope.slice(7)
  );
}

// ---- 1 min: /v2/network

export async function recordNetwork(d: RecorderDeps): Promise<Outcome> {
  const n = fresh(await d.client.network());
  if (!n) return "down";
  const t = floorTo(d.now(), MINUTE);
  const total = int(n.total_online);
  if (total === null || !Array.isArray(n.servers)) return "down";
  tx(d.db, () => {
    const ins = d.db.prepare("INSERT OR REPLACE INTO online_minute (scope, t, online, waiting, linked) VALUES (?, ?, ?, ?, ?)");
    ins.run("network", t, total, null, 1);
    registerSeries(d.db, "online:network", t);
    for (const s of n.servers) {
      const id = str(s?.id);
      if (!id || !ID.test(id)) continue;
      const linked = s.mc_version !== null || s.platform !== null;
      ins.run(`server:${id}`, t, int(s.online) ?? 0, int(s.waiting) ?? 0, linked ? 1 : 0);
      registerSeries(d.db, `online:server:${id}`, t);
    }
  });
  return "ok";
}

// ---- 10 min: /v2/mini-servers (public presence)

export async function recordMinis(d: RecorderDeps): Promise<Outcome> {
  const m = fresh(await d.client.miniServers());
  if (!m || !Array.isArray(m.mini_servers)) return "down";
  const t = floorTo(d.now(), MINUTE);
  tx(d.db, () => {
    d.db.prepare("INSERT OR IGNORE INTO mini_poll (t) VALUES (?)").run(t);
    const ins = d.db.prepare("INSERT OR REPLACE INTO mini_sample (server, mini, t, players) VALUES (?, ?, ?, ?)");
    for (const x of m.mini_servers) {
      const server = str(x?.server);
      const id = str(x?.id);
      if (x.public === false || !server || !id || !ID.test(server) || id.length > 64 || id.includes("/")) continue;
      ins.run(server, id, t, Math.max(0, int(x.player_count) ?? 0));
      registerSeries(d.db, `mini:${server}/${id}`, t);
    }
    registerSeries(d.db, "minis", t);
  });
  return "ok";
}

// ---- 10 min: the player table (names, first_seen for "joins per week")

export async function recordPlayers(d: RecorderDeps): Promise<Outcome> {
  const listed = new Map<string, string>();
  let total = -1;
  for (let page = 0; page < CAPS.playerPages; page++) {
    const r = fresh(await d.client.players({ limit: PAGE, offset: page * PAGE }));
    if (!r) return "down";
    total = int(r.total) ?? 0;
    for (const p of r.players ?? []) {
      const uuid = str(p?.uuid);
      const name = str(p?.name);
      if (uuid && name) listed.set(uuid, name);
    }
    if ((r.players ?? []).length < PAGE || (page + 1) * PAGE >= total) break;
  }
  const now = d.now();
  const complete = listed.size === total;
  tx(d.db, () => {
    const up = d.db.prepare("INSERT INTO player (uuid, name, first_seen, seen_at) VALUES (?, ?, NULL, ?) ON CONFLICT (uuid) DO UPDATE SET name = excluded.name, seen_at = excluded.seen_at");
    const del = d.db.prepare("DELETE FROM player WHERE uuid = ?");
    for (const [uuid, name] of listed) {
      if (d.hidden({ uuid, name })) del.run(uuid);
      else up.run(uuid, name, now);
    }
    // a full listing is the truth: players it no longer has are gone
    if (complete) d.db.prepare("DELETE FROM player WHERE seen_at < ?").run(now);
  });

  // first_seen never changes: fetch each profile once, a few per run
  const missing = d.db.prepare("SELECT uuid FROM player WHERE first_seen IS NULL ORDER BY uuid LIMIT ?").all(CAPS.profilesPerRun) as { uuid: string }[];
  for (const { uuid } of missing) {
    const r = await d.client.player(uuid);
    if (!r.ok && r.kind === "not_found") {
      d.db.prepare("DELETE FROM player WHERE uuid = ?").run(uuid);
      continue;
    }
    const p = fresh(r);
    if (!p) return "down";
    const first = int(p.first_seen);
    if (first !== null) d.db.prepare("UPDATE player SET first_seen = ? WHERE uuid = ?").run(first, uuid);
  }
  const left = (d.db.prepare("SELECT count(*) AS n FROM player WHERE first_seen IS NULL").get() as { n: number }).n;
  setMeta(d.db, "players_complete", complete && Number(left) === 0 ? 1 : 0);
  if (complete && Number(left) === 0) registerSeries(d.db, "players", now);
  return "ok";
}

// ---- boards: read every page of one board (or up to a cap)

type BoardRead = { unit: string; total: number; entries: Leaderboard["entries"]; complete: boolean };

/** null = the board does not exist (404 / 400): skip it. "down" = try again later. */
async function readBoard(d: RecorderDeps, metric: Metric, scope: Scope, maxPages: number): Promise<BoardRead | null | "down"> {
  const seen = new Map<string, Leaderboard["entries"][number]>();
  let total = 0;
  let unit = "count";
  for (let page = 0; page < maxPages; page++) {
    const r = await d.client.leaderboard(metric, scope, { limit: PAGE, offset: page * PAGE });
    if (!r.ok) return r.kind === "not_found" || r.kind === "bad_request" || r.kind === "off" ? null : "down";
    if (r.stale) return "down";
    total = int(r.data.total) ?? 0;
    unit = str(r.data.unit) ?? unit;
    const rows = Array.isArray(r.data.entries) ? r.data.entries : [];
    for (const e of rows) {
      if (str(e?.uuid) && int(e.value) !== null && int(e.rank) !== null && !seen.has(e.uuid)) seen.set(e.uuid, e);
    }
    if (rows.length < PAGE || (page + 1) * PAGE >= total) break;
  }
  return { unit, total, entries: [...seen.values()], complete: seen.size === total };
}

const boardMetrics = (d: RecorderDeps) => d.featured ?? FEATURED;

// ---- 1 h: featured boards (network scope), playtime with all its pages

export async function recordBoards(d: RecorderDeps): Promise<Outcome> {
  const t = floorTo(d.now(), HOUR);
  let wrote = false;
  for (const b of boardMetrics(d)) {
    const read = await readBoard(d, b.metric, "network", b.metric.kind === "playtime" ? CAPS.playtimePages : 1);
    if (read === "down") return "down";
    if (!read) continue;
    const key = metricKey(b.metric);
    const entries = read.entries.filter((e) => !d.hidden(e));
    tx(d.db, () => {
      d.db.prepare("DELETE FROM board_entry WHERE board = ? AND scope = ? AND t = ?").run(key, "network", t);
      d.db.prepare("INSERT OR REPLACE INTO board_snapshot (board, scope, t, total, complete) VALUES (?, ?, ?, ?, ?)").run(key, "network", t, read.total, read.complete ? 1 : 0);
      const ins = d.db.prepare("INSERT INTO board_entry (board, scope, t, uuid, name, rank, value, display) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      for (const e of entries) ins.run(key, "network", t, e.uuid, String(e.name), int(e.rank)!, int(e.value)!, String(e.display ?? ""));
      registerSeries(d.db, `board:${key}:network`, d.now());
    });
    wrote = true;
  }
  return wrote ? "ok" : "skipped";
}

// ---- 6 h: network totals per featured stat (every scope) and per type total (network)

export async function recordTotals(d: RecorderDeps): Promise<Outcome> {
  const t = floorTo(d.now(), HOUR);
  const jobs: { metric: Metric; scope: Scope }[] = [];
  const keys = new Set<string>();
  const add = (metric: Metric, scope: Scope) => {
    const k = `${metricKey(metric)}|${scope}`;
    if (!keys.has(k)) {
      keys.add(k);
      jobs.push({ metric, scope });
    }
  };
  const servers = knownServers(d.db);
  if (!servers.length) return "down"; // no network sample yet: wait for one, so server scopes are not missed
  for (const b of boardMetrics(d)) {
    add(b.metric, "network");
    for (const s of servers) add(b.metric, `server:${s}`);
  }
  const types = await d.client.statTypes();
  if (!types.ok || types.stale) return "down";
  for (const ty of types.data.types ?? []) {
    const key = str(ty?.key);
    if (key && key !== "minecraft:custom") add({ kind: "stat", type: key, subject: "*" }, "network"); // custom:* is mixed_units
  }
  let wrote = 0;
  for (const j of jobs) {
    const read = await readBoard(d, j.metric, j.scope, CAPS.totalPages);
    if (read === "down") return wrote ? "ok" : "down";
    if (!read || !read.complete) continue; // never record a partial sum
    // players inside one scope may be added (PLAN §2.2); scopes never are
    let sum = 0;
    let players = 0;
    for (const e of read.entries) {
      if (d.hidden(e)) continue;
      sum += int(e.value)!;
      players++;
    }
    const key = metricKey(j.metric);
    tx(d.db, () => {
      d.db.prepare("INSERT OR REPLACE INTO stat_total (metric, scope, t, value, unit, players) VALUES (?, ?, ?, ?, ?, ?)").run(key, j.scope, t, sum, read.unit, players);
      registerSeries(d.db, `total:${key}:${j.scope}`, d.now());
    });
    wrote++;
  }
  return wrote ? "ok" : "skipped";
}

// ---- 10 min (network) and 1 h (servers): the milestone feed head, new rows only

export async function recordMilestones(d: RecorderDeps, scope: Scope): Promise<Outcome> {
  if (!(await d.client.milestonesEnabled())) return "skipped";
  const seriesKey = `milestones:${scope}`;
  const first = seriesSince(d.db, seriesKey) === null;
  const maxPages = first ? CAPS.milestonePagesFirst : CAPS.milestonePages;
  const now = d.now();
  const exists = d.db.prepare("SELECT 1 AS x FROM milestone WHERE scope = ? AND metric = ? AND threshold = ?");
  const ins = d.db.prepare(
    "INSERT OR REPLACE INTO milestone (scope, metric, threshold, uuid, name, reached_at, backfilled, seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  for (let page = 0; page < maxPages; page++) {
    const r = await d.client.milestones({ scope, limit: PAGE, offset: page * PAGE });
    if (!r.ok) return r.kind === "off" || r.kind === "not_found" || r.kind === "bad_request" ? "skipped" : "down";
    if (r.stale) return "down";
    const rows: MilestoneFeedRow[] = Array.isArray(r.data.milestones) ? r.data.milestones : [];
    let caughtUp = false;
    tx(d.db, () => {
      for (const m of rows) {
        const metric = str(m?.metric);
        const threshold = typeof m?.threshold === "number" && Number.isFinite(m.threshold) ? m.threshold : null;
        if (!metric || threshold === null) continue;
        const reached = int(m.reached_at);
        // backfilled rows come last and carry no day: everything dated has been read
        if (m.backfilled || reached === null) {
          caughtUp = true;
          break;
        }
        const uuid = str(m.uuid);
        const name = str(m.name);
        if ((uuid || name) && d.hidden({ uuid: uuid ?? "", name: name ?? "" })) continue;
        if (exists.get(scope, metric, threshold)) {
          caughtUp = true; // newest first: the rest is already stored
          break;
        }
        ins.run(scope, metric, threshold, uuid, name, reached, 0, now);
      }
      registerSeries(d.db, seriesKey, now);
    });
    if (caughtUp || rows.length < PAGE) break;
  }
  return "ok";
}

export async function recordServerMilestones(d: RecorderDeps): Promise<Outcome> {
  if (!(await d.client.milestonesEnabled())) return "skipped";
  const servers = knownServers(d.db);
  if (!servers.length) return "down"; // no network sample yet
  let any = false;
  for (const s of servers) {
    const o = await recordMilestones(d, `server:${s}`);
    if (o === "down") return "down";
    if (o === "ok") any = true;
  }
  return any ? "ok" : "skipped";
}

// ---- 1 h: roll-ups, retention, opt-outs

/** Rolls complete hours of minute rows into online_hour (re-rolls the last two to catch late rows). */
export function rollUp(db: Db, now: number): void {
  const upto = getMetaNumber(db, "rollup_upto") ?? 0;
  const from = Math.max(0, upto - 2 * HOUR);
  const to = floorTo(now, HOUR);
  if (to <= from) return;
  tx(db, () => {
    db.prepare(
      `INSERT OR REPLACE INTO online_hour (scope, t, n, online_mean, online_max, waiting_max, linked_n)
       SELECT scope, (t / ${HOUR}) * ${HOUR} AS h, count(*), avg(online), max(online), max(waiting), sum(linked)
       FROM online_minute WHERE t >= ? AND t < ? GROUP BY scope, h`
    ).run(from, to);
    setMeta(db, "rollup_upto", to);
  });
}

export function applyRetention(db: Db, now: number): void {
  const upto = getMetaNumber(db, "rollup_upto") ?? 0;
  const long = now - KEEP_LONG;
  const boardCut = now - KEEP_HOURLY_BOARDS;
  tx(db, () => {
    db.prepare("DELETE FROM online_minute WHERE t < ?").run(Math.min(now - KEEP_MINUTES, upto));
    db.prepare("DELETE FROM online_hour WHERE t < ?").run(long);
    db.prepare("DELETE FROM mini_sample WHERE t < ?").run(long);
    db.prepare("DELETE FROM mini_poll WHERE t < ?").run(long);
    db.prepare("DELETE FROM stat_total WHERE t < ?").run(long);
    db.prepare("DELETE FROM board_snapshot WHERE t < ?").run(long);
    db.prepare(
      `DELETE FROM board_snapshot WHERE t < ? AND (board, scope, t) NOT IN
         (SELECT board, scope, min(t) FROM board_snapshot GROUP BY board, scope, t / ${DAY})`
    ).run(boardCut);
    db.prepare("DELETE FROM board_entry WHERE t < ? AND (board, scope, t) NOT IN (SELECT board, scope, t FROM board_snapshot)").run(boardCut);
  });
}

/** Deletes rows of players who opted out since they were recorded. */
export function purgeHidden(db: Db, hidden: Hidden): void {
  const rows = db.prepare("SELECT DISTINCT uuid, name FROM board_entry UNION SELECT uuid, name FROM player").all() as { uuid: string; name: string }[];
  const gone = rows.filter((r) => hidden(r)).map((r) => r.uuid);
  const ms = db.prepare("SELECT DISTINCT uuid, name FROM milestone WHERE uuid IS NOT NULL OR name IS NOT NULL").all() as { uuid: string | null; name: string | null }[];
  const goneMs = ms.filter((r) => hidden({ uuid: r.uuid ?? "", name: r.name ?? "" }));
  if (!gone.length && !goneMs.length) return;
  tx(db, () => {
    for (const u of gone) {
      db.prepare("DELETE FROM board_entry WHERE uuid = ?").run(u);
      db.prepare("DELETE FROM player WHERE uuid = ?").run(u);
    }
    for (const m of goneMs) db.prepare("DELETE FROM milestone WHERE uuid IS ? AND name IS ?").run(m.uuid, m.name);
  });
}

export async function maintain(d: RecorderDeps): Promise<Outcome> {
  const now = d.now();
  rollUp(d.db, now);
  applyRetention(d.db, now);
  purgeHidden(d.db, d.hidden);
  d.db.exec("PRAGMA optimize");
  if (getMeta(d.db, "created_at") === null) setMeta(d.db, "created_at", now);
  return "ok";
}
