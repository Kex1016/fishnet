// Mock mode only (FISHNET_MOCK=fresh|busy; the production server refuses to start with it).
//
// Both scenarios first run the real recorder jobs once against the mock API, so the newest point of
// every series is what the fixture world says now, and the real query code reads it back.
//   fresh: nothing more. One sample per series: every chart shows its empty state with
//          "Recording since <today>", exactly like a new install.
//   busy:  plus 30 days of generated, deterministic history before that (a daily rhythm, an outage,
//          an event server that was linked for two days, rank movement, growing totals), so pages
//          and charts can be built and screenshotted. This is fixture data like the mock world itself
//          and never touches data/fishnet.db.
import type { Scenario } from "../cakeutils/mock/index.ts";
import { type Db, getMetaNumber, setMeta, tx } from "./db.ts";
import {
  knownServers, recordAdvancements, recordBoards, recordMilestones, recordMinis, recordNetwork, recordPlayers, recordServerAdvancements,
  recordServerMilestones, recordTotals, type RecorderDeps
} from "./jobs.ts";
import { DAY, HOUR, MINUTE, floorTo, weekday } from "./time.ts";

export async function seedMock(d: RecorderDeps, scenario: Scenario): Promise<void> {
  await recordNetwork(d);
  await recordMinis(d);
  for (let i = 0; i < 50 && (getMetaNumber(d.db, "players_complete") ?? 0) !== 1; i++) await recordPlayers(d);
  await recordBoards(d);
  await recordTotals(d);
  await recordMilestones(d, "network");
  await recordServerMilestones(d);
  await recordAdvancements(d, "network");
  await recordServerAdvancements(d);
  if (scenario === "busy") synthesize(d.db, d.now());
}

/** mulberry32: a small deterministic PRNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** 0..1: quiet at night (UTC), busiest around 19:00, livelier at weekends. */
function activity(t: number): number {
  const h = (t % DAY) / HOUR;
  const daily = 0.15 + 0.85 * Math.max(0, Math.cos(((h - 19) / 24) * 2 * Math.PI)) ** 1.6;
  return Math.min(1, daily * (weekday(t) >= 5 ? 1.25 : 1));
}

const SPAN = 30 * DAY;
const MINUTE_SPAN = 2 * DAY;

function synthesize(db: Db, now: number): void {
  const nowSlot = floorTo(now, MINUTE);
  const start = floorTo(now - SPAN, HOUR);
  const minuteFrom = floorTo(now - MINUTE_SPAN, HOUR);
  const servers = knownServers(db);
  const latest = new Map(
    (db.prepare("SELECT scope, online, waiting, linked FROM online_minute WHERE t = ?").all(nowSlot) as { scope: string; online: number; waiting: number | null; linked: number }[]).map(
      (r) => [r.scope, r]
    )
  );
  // the busiest linked server gets one 90-minute outage three days ago
  const outageServer = [...servers]
    .filter((s) => Number(latest.get(`server:${s}`)?.linked ?? 0) === 1)
    .sort((a, b) => Number(latest.get(`server:${b}`)?.online ?? 0) - Number(latest.get(`server:${a}`)?.online ?? 0) || a.localeCompare(b))[0];
  const base = (s: string) => Math.max(1, Number(latest.get(`server:${s}`)?.online ?? 0)) + 1.5;
  const wasLinked = (s: string, t: number) => {
    if (Number(latest.get(`server:${s}`)?.linked ?? 1) === 0) return t >= now - 12 * DAY && t < now - 10 * DAY; // an event server, up for two days
    const outage = floorTo(now - 3 * DAY, DAY) + 14 * HOUR;
    return !(s === outageServer && t >= outage && t < outage + 90 * MINUTE);
  };
  const sample = (s: string, t: number, r: () => number) => {
    if (!wasLinked(s, t)) return { online: 0, waiting: r() < 0.3 ? 1 + Math.floor(r() * 2) : 0, linked: 0 };
    const v = base(s) * activity(t) + (r() - 0.5) * 1.5;
    return { online: Math.max(0, Math.round(v)), waiting: 0, linked: 1 };
  };

  tx(db, () => {
    const minute = db.prepare("INSERT OR IGNORE INTO online_minute (scope, t, online, waiting, linked) VALUES (?, ?, ?, ?, ?)");
    const hour = db.prepare("INSERT OR REPLACE INTO online_hour (scope, t, n, online_mean, online_max, waiting_max, linked_n) VALUES (?, ?, 60, ?, ?, ?, ?)");
    // hourly roll-ups for the older part, minute rows for the last two days
    for (let t = start; t < minuteFrom; t += HOUR) {
      let net = 0;
      let netMax = 0;
      for (const s of servers) {
        const r = rng(hash(`${s}|${t}`));
        const x = sample(s, t + 30 * MINUTE, r);
        const mean = x.online * (0.75 + 0.2 * r());
        hour.run(`server:${s}`, t, mean, x.online, x.waiting, x.linked * 60);
        net += mean;
        netMax += x.online;
      }
      hour.run("network", t, net, netMax, null, 60);
    }
    for (let t = minuteFrom; t < nowSlot; t += MINUTE) {
      let net = 0;
      for (const s of servers) {
        const x = sample(s, t, rng(hash(`${s}|${t}`)));
        minute.run(`server:${s}`, t, x.online, x.waiting, x.linked);
        net += x.online;
      }
      minute.run("network", t, net, null, 1);
    }
    setMeta(db, "rollup_upto", minuteFrom);

    // mini-server presence every 10 minutes
    const minis = db.prepare("SELECT server, mini FROM mini_sample GROUP BY server, mini").all() as { server: string; mini: string }[];
    const poll = db.prepare("INSERT OR IGNORE INTO mini_poll (t) VALUES (?)");
    const mini = db.prepare("INSERT OR IGNORE INTO mini_sample (server, mini, t, players) VALUES (?, ?, ?, ?)");
    for (let t = floorTo(now - SPAN, 10 * MINUTE); t < nowSlot; t += 10 * MINUTE) {
      poll.run(t);
      for (const m of minis) {
        const r = rng(hash(`${m.server}/${m.mini}|${t}`));
        const v = Math.round(activity(t) * 3 * r());
        if (v > 0 && wasLinked(m.server, t)) mini.run(m.server, m.mini, t, v);
      }
    }

    // featured boards: a snapshot a day for the last two weeks, values lower the further back
    const snaps = db.prepare("SELECT board, scope, t, total FROM board_snapshot").all() as { board: string; scope: string; t: number; total: number }[];
    const snap = db.prepare("INSERT OR IGNORE INTO board_snapshot (board, scope, t, total, complete) VALUES (?, ?, ?, ?, 1)");
    const entry = db.prepare("INSERT OR IGNORE INTO board_entry (board, scope, t, uuid, name, rank, value, display) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    for (const s of snaps) {
      const rows = db.prepare("SELECT uuid, name, value, display FROM board_entry WHERE board = ? AND scope = ? AND t = ?").all(s.board, s.scope, s.t) as {
        uuid: string;
        name: string;
        value: number;
        display: string;
      }[];
      for (let k = 1; k <= 13; k++) {
        const t = Number(s.t) - k * DAY;
        const then = rows
          .map((e) => {
            const g = rng(hash(`${s.board}|${e.uuid}`))() * 0.6;
            return { ...e, value: Math.round(Number(e.value) * Math.max(0.05, 1 - (g * k) / 30)) };
          })
          .sort((a, b) => b.value - a.value || a.uuid.localeCompare(b.uuid));
        snap.run(s.board, s.scope, t, s.total);
        then.forEach((e, i) => entry.run(s.board, s.scope, t, e.uuid, e.name, i + 1, e.value, e.display));
      }
    }

    // totals every 6 hours, growing to today's real sum
    const totals = db.prepare("SELECT metric, scope, t, value, unit, players FROM stat_total").all() as {
      metric: string;
      scope: string;
      t: number;
      value: number;
      unit: string;
      players: number;
    }[];
    const total = db.prepare("INSERT OR IGNORE INTO stat_total (metric, scope, t, value, unit, players) VALUES (?, ?, ?, ?, ?, ?)");
    for (const x of totals) {
      for (let t = floorTo(Number(x.t) - SPAN, 6 * HOUR); t < Number(x.t); t += 6 * HOUR) {
        const age = (Number(x.t) - t) / SPAN;
        total.run(x.metric, x.scope, t, Math.round(Number(x.value) * (1 - 0.5 * age ** 0.9)), x.unit, x.players);
      }
    }

    // every generated series starts 30 days ago; milestones and players keep their real dates
    db.prepare("UPDATE series SET since = ? WHERE key LIKE 'online:%' OR key LIKE 'mini:%' OR key = 'minis' OR key LIKE 'total:%'").run(start);
    if (snaps.length) db.prepare("UPDATE series SET since = ? WHERE key LIKE 'board:%'").run(Math.min(...snaps.map((s) => Number(s.t))) - 13 * DAY);
    setMeta(db, "recording_since", start);
  });
}
