// W2: the recorder and the History over it, against an in-memory database and a fake client.
import { describe, expect, test } from "bun:test";
import type { Client } from "#lib/server/cakeutils/client.ts";
import { fail, ok, type Result } from "#lib/api/result.ts";
import { metricKey, type Metric } from "#lib/api/metric.ts";
import type { FeaturedBoard } from "#lib/boards.ts";
import type { AdvancementRow, LeaderboardEntry, MilestoneFeedRow, Network } from "#lib/api/types.ts";
import { getMetaNumber, migrate, openDb, schemaVersion, seriesSince } from "#lib/server/recorder/db.ts";
import { MIGRATIONS } from "#lib/server/recorder/schema.ts";
import {
  applyRetention, purgeHidden, recordAdvancements, recordBoards, recordMilestones, recordMinis, recordNetwork, recordPlayers, recordServerAdvancements,
  recordTotals, rollUp, type RecorderDeps
} from "#lib/server/recorder/jobs.ts";
import { createSqliteHistory } from "#lib/server/recorder/queries.ts";
import { JOBS, firstRun, nextRun, startScheduler } from "#lib/server/recorder/scheduler.ts";
import { DAY, HOUR, MINUTE, weekStart } from "#lib/server/recorder/time.ts";
import { inRecorder } from "#lib/server/recorder/context.ts";
import { seedMock } from "#lib/server/recorder/mock-seed.ts";

// Wed 4 Nov 2026 18:00 UTC
const T0 = Date.UTC(2026, 10, 4, 18, 0, 0);

type Fake = {
  down: boolean;
  stale: boolean;
  network: Network;
  minis: { id: string; server: string; players: number; public?: boolean }[];
  players: { uuid: string; name: string; first_seen: number }[];
  boards: Map<string, { unit: string; entries: { uuid: string; name: string; value: number }[] }>;
  types: string[];
  milestonesOn: boolean;
  /** feed rows, each tagged with the scope whose feed lists it */
  feed: (MilestoneFeedRow & { scope: string })[];
  advancementsOn: boolean;
  /** advancement firsts, each tagged with its scope */
  advFeed: (AdvancementRow & { scope: string })[];
  calls: string[];
};

function fake(): Fake {
  return {
    down: false,
    stale: false,
    network: {
      total_online: 5,
      servers: [
        { id: "lobby", display_name: "Lobby", online: 1, waiting: 0, mc_version: "26.3", platform: "paper" },
        { id: "survival", display_name: "Survival", online: 3, waiting: 2, mc_version: "26.3", platform: "paper" },
        { id: "events", display_name: "Events", online: 0, waiting: 0, mc_version: null, platform: null }
      ]
    },
    minis: [{ id: "sky-1", server: "survival", players: 2 }],
    players: [],
    boards: new Map(),
    types: ["minecraft:mined", "minecraft:custom"],
    milestonesOn: true,
    feed: [],
    advancementsOn: true,
    advFeed: [],
    calls: []
  };
}

function clientOf(f: Fake): Client {
  const answer = <T>(path: string, data: () => T): Promise<Result<T>> => {
    f.calls.push(path);
    if (f.down) return Promise.resolve(fail("down"));
    return Promise.resolve(ok(data(), Date.now(), { stale: f.stale }));
  };
  const c: Partial<Client> = {
    network: () => answer("network", () => structuredClone(f.network)),
    miniServers: () =>
      answer("minis", () => ({
        mini_servers: f.minis.map((m) => ({ id: m.id, display_name: m.id, public: m.public ?? true, server: m.server, players: [], player_count: m.players }))
      })),
    players: (q = {}) =>
      answer("players", () => {
        const sorted = [...f.players].sort((a, b) => a.name.localeCompare(b.name));
        const off = q.offset ?? 0;
        return { total: sorted.length, players: sorted.slice(off, off + (q.limit ?? 10)).map((p) => ({ uuid: p.uuid, name: p.name, online: false, server: null })) };
      }),
    player: (ref) => {
      const p = f.players.find((x) => x.uuid === ref);
      if (!p) return Promise.resolve(fail("not_found"));
      return answer("player", () => ({ uuid: p.uuid, name: p.name, online: false, server: null, first_seen: p.first_seen, last_seen: p.first_seen, skin: null, prefix: [], suffix: [], playtime: { scope: "network", total_ms: 0, by_server: {}, by_mini: {} } }) as never);
    },
    leaderboard: (m: Metric, scope = "network", page = {}) => {
      const key = `${metricKey(m)}|${scope}`;
      const b = f.boards.get(key);
      if (!b) return Promise.resolve(fail(metricKey(m) === "custom:*" ? "bad_request" : "not_found"));
      return answer(`board ${key}`, () => {
        const sorted = [...b.entries].sort((x, y) => y.value - x.value || x.uuid.localeCompare(y.uuid));
        const off = page.offset ?? 0;
        const entries: LeaderboardEntry[] = sorted.slice(off, off + (page.limit ?? 10)).map((e, i) => ({ rank: off + i + 1, uuid: e.uuid, name: e.name, value: e.value, unit: b.unit, display: String(e.value) }));
        return { metric: metricKey(m), scope, unit: b.unit, total: sorted.length, entries };
      });
    },
    statTypes: () => answer("types", () => ({ types: f.types.map((key) => ({ key, name: key, kind: null })) })),
    milestonesEnabled: async () => f.milestonesOn,
    milestones: (q = {}) => {
      if (!f.milestonesOn) return Promise.resolve(fail("off"));
      return answer("milestones", () => {
        const off = q.offset ?? 0;
        const rows = f.feed.filter((r) => r.scope === (q.scope ?? "network"));
        return { scope: q.scope ?? "network", total: rows.length, milestones: rows.slice(off, off + (q.limit ?? 10)) };
      });
    },
    advancementsEnabled: async () => f.advancementsOn,
    advancements: (q = {}) => {
      if (!f.advancementsOn) return Promise.resolve(fail("off"));
      return answer("advancements", () => {
        const off = q.offset ?? 0;
        const rows = f.advFeed.filter((r) => r.scope === (q.scope ?? "network")).sort((a, b) => b.earned_at - a.earned_at);
        return { scope: q.scope ?? "network", total: rows.length, milestones: rows.slice(off, off + (q.limit ?? 10)) };
      });
    }
  };
  return c as Client;
}

function setup(opts: { hidden?: string[]; featured?: FeaturedBoard[] } = {}) {
  const db = openDb(":memory:");
  const f = fake();
  let now = T0;
  const hiddenSet = new Set(opts.hidden ?? []);
  const logs: string[] = [];
  const d: RecorderDeps = {
    db,
    client: clientOf(f),
    now: () => now,
    hidden: (p) => hiddenSet.has(p.uuid) || hiddenSet.has(p.name),
    log: (l) => logs.push(l),
    featured: opts.featured ?? [
      { id: "playtime", label: "Playtime", metric: { kind: "playtime" } },
      { id: "mined", label: "Blocks mined", metric: { kind: "stat", type: "minecraft:mined", subject: "*" } }
    ]
  };
  const h = createSqliteHistory(db, { now: () => now, hidden: d.hidden, featured: d.featured });
  return { db, f, d, h, logs, at: (t: number) => (now = t), get now() { return now; } };
}

const board = (entries: [string, string, number][], unit = "count") => ({ unit, entries: entries.map(([uuid, name, value]) => ({ uuid, name, value })) });

describe("schema", () => {
  test("migrates to the listed version and refuses a newer file", () => {
    const db = openDb(":memory:");
    expect(schemaVersion(db)).toBe(MIGRATIONS.length);
    migrate(db); // idempotent
    db.exec(`PRAGMA user_version = ${MIGRATIONS.length + 1}`);
    expect(() => migrate(db)).toThrow(/newer than this build/);
  });
});

describe("network job", () => {
  test("records every scope side by side, never a sum", async () => {
    const s = setup();
    expect(await recordNetwork(s.d)).toBe("ok");
    const rows = s.db.prepare("SELECT scope, online, waiting, linked FROM online_minute ORDER BY scope").all();
    expect(rows).toEqual([
      { scope: "network", online: 5, waiting: null, linked: 1 },
      { scope: "server:events", online: 0, waiting: 0, linked: 0 },
      { scope: "server:lobby", online: 1, waiting: 0, linked: 1 },
      { scope: "server:survival", online: 3, waiting: 2, linked: 1 }
    ]);
    expect(await s.h.recordingSince()).toBe(T0);
  });

  test("down or stale answers write nothing", async () => {
    const s = setup();
    s.f.down = true;
    expect(await recordNetwork(s.d)).toBe("down");
    s.f.down = false;
    s.f.stale = true;
    expect(await recordNetwork(s.d)).toBe("down");
    expect(s.db.prepare("SELECT count(*) AS n FROM online_minute").get()).toEqual({ n: 0 });
    expect(await s.h.recordingSince()).toBeNull();
    expect(await s.h.online("network", "day")).toEqual({ since: null, points: [] });
  });

  test("a restart inside the same minute does not duplicate the sample", async () => {
    const s = setup();
    await recordNetwork(s.d);
    s.at(T0 + 30_000);
    s.f.network.total_online = 6;
    await recordNetwork(s.d);
    expect(s.db.prepare("SELECT count(*) AS n, max(online) AS m FROM online_minute WHERE scope = 'network'").get()).toEqual({ n: 1, m: 6 });
  });
});

/** Records `minutes` minute samples ending at the current time, online = f(i). */
async function minutes(s: ReturnType<typeof setup>, count: number, online: (i: number, t: number) => number, linked: (i: number) => boolean = () => true) {
  const end = s.now;
  for (let i = count - 1; i >= 0; i--) {
    const t = end - i * MINUTE;
    s.at(t);
    const v = online(i, t);
    s.f.network.total_online = v + 1;
    s.f.network.servers[1].online = v;
    s.f.network.servers[1].mc_version = linked(i) ? "26.3" : null;
    s.f.network.servers[1].platform = linked(i) ? "paper" : null;
    await recordNetwork(s.d);
  }
}

describe("online history", () => {
  test("day: 5-minute peaks; week reads roll-ups and the open hour the same way", async () => {
    const s = setup();
    s.at(T0 + 3 * HOUR - MINUTE);
    await minutes(s, 180, (i) => (i % 5 === 0 ? 4 : 1));
    const day = await s.h.online("server:survival", "day");
    expect(day.since).toBe(T0);
    expect(day.points.length).toBe(36);
    expect(day.points.every((p) => p.v === 4)).toBe(true); // every 5-minute window holds one peak minute
    const before = await s.h.online("server:survival", "week");
    rollUp(s.db, s.now);
    const after = await s.h.online("server:survival", "week");
    expect(after).toEqual(before);
    expect(after.points.map((p) => p.t)).toEqual([T0, T0 + HOUR, T0 + 2 * HOUR]);
    // the network row is the API's own figure, not survival + lobby
    expect((await s.h.online("network", "week")).points[0].v).toBe(5);
  });

  test("onlineRecent: the last hour of minute samples", async () => {
    const s = setup();
    s.at(T0 + 2 * HOUR);
    await minutes(s, 90, (i) => i);
    const r = await s.h.onlineRecent("server:survival");
    expect(r.points.length).toBe(60);
    expect(r.points.at(-1)).toEqual({ t: T0 + 2 * HOUR, v: 0 });
  });

  test("server: linked when linked for at least half of a bucket", async () => {
    const s = setup();
    s.at(T0 + 2 * HOUR - MINUTE);
    // hour 1: down 20 minutes (still linked), hour 2: down 40 minutes (not linked)
    await minutes(s, 120, () => 2, (i) => !((i >= 60 && i < 80) || (i < 40)));
    rollUp(s.db, s.now + HOUR);
    const r = await s.h.server("survival", "week");
    expect(r.samples.map((x) => x.linked)).toEqual([true, false]);
    expect(r.samples[0].waiting).toBe(2);
    expect((await s.h.server("nope", "week")).since).toBeNull();
    expect((await s.h.server("bad id!", "week")).samples).toEqual([]);
  });

  test("activityByHour: weekday × UTC hour means, null where nothing was recorded", async () => {
    const s = setup();
    s.at(T0 + 59 * MINUTE); // Wednesday 18:xx
    await minutes(s, 60, (i) => (i < 30 ? 2 : 4));
    const r = await s.h.activityByHour("network", "week");
    expect(r.cells.length).toBe(7);
    expect(r.cells[2][18]).toBe(4); // network = survival + 1 from the fake: mean of 3 and 5
    expect(r.cells[2][17]).toBeNull();
    expect(r.cells[0][0]).toBeNull();
    const empty = setup();
    expect(await empty.h.activityByHour("network", "week")).toEqual({ since: null, cells: [] });
  });

  test("retention keeps minute rows 30 days, roll-ups two years", async () => {
    const s = setup();
    await recordNetwork(s.d);
    s.at(T0 + 31 * DAY);
    rollUp(s.db, s.now);
    applyRetention(s.db, s.now);
    expect(s.db.prepare("SELECT count(*) AS n FROM online_minute").get()).toEqual({ n: 0 });
    expect(s.db.prepare("SELECT count(*) AS n FROM online_hour WHERE scope = 'network'").get()).toEqual({ n: 1 });
    s.at(T0 + 731 * DAY);
    applyRetention(s.db, s.now);
    expect(s.db.prepare("SELECT count(*) AS n FROM online_hour").get()).toEqual({ n: 0 });
  });

  test("minute rows are never deleted before they are rolled up", async () => {
    const s = setup();
    await recordNetwork(s.d);
    s.at(T0 + 31 * DAY);
    applyRetention(s.db, s.now); // no roll-up yet
    expect(s.db.prepare("SELECT count(*) AS n FROM online_minute").get()).toEqual({ n: 4 });
  });
});

describe("mini-server presence", () => {
  test("a poll without the mini counts as 0; private minis are never stored", async () => {
    const s = setup();
    s.f.minis.push({ id: "vault", server: "survival", players: 1, public: false });
    await recordMinis(s.d);
    s.at(T0 + 10 * MINUTE);
    s.f.minis = [];
    await recordMinis(s.d);
    s.at(T0 + 20 * MINUTE);
    s.f.minis = [{ id: "sky-1", server: "survival", players: 3 }];
    await recordMinis(s.d);
    const r = await s.h.miniPresence("survival", "day");
    expect(Object.keys(r)).toEqual(["sky-1"]);
    expect(r["sky-1"].points.map((p) => p.v)).toEqual([2, 0, 3]);
    expect((await s.h.online("mini:survival/sky-1", "day")).points.length).toBe(3);
    s.f.down = true;
    s.at(T0 + 30 * MINUTE);
    expect(await recordMinis(s.d)).toBe("down");
    expect((await s.h.miniPresence("survival", "day"))["sky-1"].points.length).toBe(3); // a gap, not a 0
  });
});

describe("boards and rank moves", () => {
  test("snapshots drop hidden players; moves need two snapshots", async () => {
    const s = setup({ hidden: ["u-hid"] });
    s.f.boards.set("mined:*|network", board([["u-a", "Ann", 10], ["u-b", "Bo", 20], ["u-hid", "Hid", 30]]));
    s.f.boards.set("playtime|network", board([["u-a", "Ann", 1000]], "ms"));
    expect(await recordBoards(s.d)).toBe("ok");
    expect(s.db.prepare("SELECT count(*) AS n FROM board_entry WHERE uuid = 'u-hid'").get()).toEqual({ n: 0 });
    expect((await s.h.rankMoves("mined", "network")).moves).toEqual([]);
    s.at(T0 + 3 * DAY);
    s.f.boards.set("mined:*|network", board([["u-a", "Ann", 50], ["u-b", "Bo", 25], ["u-c", "Cy", 1], ["u-hid", "Hid", 30]]));
    await recordBoards(s.d);
    const r = await s.h.rankMoves("mined:*", "network"); // id or metric key
    expect(r.since).toBe(T0);
    expect(r.moves.map((m) => [m.name, m.rank, m.before])).toEqual([
      ["Ann", 1, 3],
      ["Bo", 3, 2],
      ["Cy", 4, null]
    ]);
    expect(await s.h.rankMoves("mined", "server:lobby")).toEqual({ since: null, moves: [] });
  });

  test("a stat nobody recorded yet is skipped, not stored", async () => {
    const s = setup();
    expect(await recordBoards(s.d)).toBe("skipped");
    expect(await s.h.rankMoves("mined", "network")).toEqual({ since: null, moves: [] });
  });
});

describe("totals", () => {
  test("sums players inside one scope, every scope on its own, never partial", async () => {
    const s = setup({ hidden: ["u-hid"] });
    await recordNetwork(s.d); // knows lobby, survival, events
    s.f.boards.set("mined:*|network", board([["u-a", "Ann", 10], ["u-b", "Bo", 20], ["u-hid", "Hid", 5]]));
    s.f.boards.set("mined:*|server:survival", board([["u-a", "Ann", 7]]));
    s.f.boards.set("mined:*|server:lobby", board([]));
    s.f.boards.set("playtime|network", board([["u-a", "Ann", 1000]], "ms"));
    expect(await recordTotals(s.d)).toBe("ok");
    const rows = s.db.prepare("SELECT metric, scope, value, players FROM stat_total ORDER BY metric, scope").all();
    expect(rows).toEqual([
      { metric: "mined:*", scope: "network", value: 30, players: 2 },
      { metric: "mined:*", scope: "server:lobby", value: 0, players: 0 },
      { metric: "mined:*", scope: "server:survival", value: 7, players: 1 },
      { metric: "playtime", scope: "network", value: 1000, players: 1 }
    ]);
    expect(s.f.calls.some((c) => c.includes("custom:*"))).toBe(false);
    const series = await s.h.networkTotal("mined", "network", "month");
    expect(series).toEqual({ since: T0, points: [{ t: T0, v: 30 }] });
    const none = setup();
    expect(await recordTotals(none.d)).toBe("down"); // waits for the first network sample
    expect((await s.h.networkTotal("mined", "server:events", "month")).since).toBeNull();
  });

  test("a board longer than the page cap is not summed", async () => {
    const s = setup();
    await recordNetwork(s.d);
    const many: [string, string, number][] = Array.from({ length: 5001 }, (_, i) => [`u-${i}`, `P${i}`, 1]);
    s.f.boards.set("mined:*|network", board(many));
    await recordTotals(s.d);
    expect(s.db.prepare("SELECT count(*) AS n FROM stat_total").get()).toEqual({ n: 0 });
  });
});

const ms = (metric: string, threshold: number, reached_at: number | null, extra: Partial<MilestoneFeedRow> = {}): MilestoneFeedRow & { scope: string } => ({
  metric,
  type: "minecraft:mined",
  subject: "minecraft:stone",
  stat_name: null,
  unit: "count",
  scope: "network",
  threshold,
  display: String(threshold),
  uuid: "u-a",
  name: "Ann",
  reached_at,
  backfilled: reached_at === null,
  ...extra
});

describe("milestones", () => {
  test("stores the feed head, stops at known rows and at backfilled ones", async () => {
    const s = setup({ hidden: ["Hid"] });
    s.f.feed = [ms("mined:minecraft:stone", 100, T0 - DAY), ms("mined:minecraft:stone", 10, T0 - 3 * DAY), ms("mined:minecraft:stone", 1, null)];
    await recordMilestones(s.d, "network");
    expect(s.db.prepare("SELECT count(*) AS n FROM milestone").get()).toEqual({ n: 2 });
    s.f.feed.unshift(ms("mined:minecraft:dirt", 1, T0 - HOUR), ms("mined:minecraft:sand", 1, T0 - HOUR, { uuid: "u-h", name: "Hid" }));
    s.f.calls = [];
    await recordMilestones(s.d, "network");
    expect(s.f.calls.length).toBe(1);
    expect(s.db.prepare("SELECT count(*) AS n FROM milestone").get()).toEqual({ n: 3 });
    const g = await s.h.milestonesPerDay("network", "week");
    expect(g.since).toBe(T0 - 3 * DAY);
    expect(g.days.map((x) => x.v)).toEqual([1, 0, 1, 1]);
    expect(g.days[0].day).toBe(Date.UTC(2026, 10, 1));
  });

  test("off: nothing recorded, since null", async () => {
    const s = setup();
    s.f.milestonesOn = false;
    expect(await recordMilestones(s.d, "network")).toBe("skipped");
    expect(await s.h.milestonesPerDay("network", "month")).toEqual({ since: null, days: [] });
  });

  test("on with nothing reached: zero days from the first run", async () => {
    const s = setup();
    await recordMilestones(s.d, "network");
    expect(await s.h.milestonesPerDay("network", "month")).toEqual({ since: T0, days: [{ day: Date.UTC(2026, 10, 4), v: 0 }] });
  });
});

const adv = (advancement: string, earned_at: number, extra: Partial<AdvancementRow & { scope: string }> = {}): AdvancementRow & { scope: string } => ({
  advancement,
  title: advancement,
  uuid: "u-a",
  name: "Ann",
  server: "survival",
  earned_at,
  imported: false,
  earners: 1,
  scope: "network",
  ...extra
});

describe("advancement firsts (D-111)", () => {
  test("stores every row, replaces a first that moved earlier, drops opted-out players", async () => {
    const s = setup({ hidden: ["Hid"] });
    s.f.advFeed = [adv("minecraft:story/root", T0 - DAY), adv("minecraft:story/mine_diamond", T0 - 3 * DAY), adv("minecraft:nether/root", T0 - HOUR, { uuid: "u-h", name: "Hid" })];
    expect(await recordAdvancements(s.d, "network")).toBe("ok");
    expect(s.db.prepare("SELECT count(*) AS n FROM advancement_first").get()).toEqual({ n: 2 });
    // an import found an earlier completion by someone else: the row is replaced, not duplicated
    s.f.advFeed[1] = adv("minecraft:story/mine_diamond", T0 - 10 * DAY, { uuid: "u-b", name: "Bea", imported: true });
    s.f.calls = [];
    await recordAdvancements(s.d, "network");
    expect(s.f.calls.length).toBe(1); // one page covers the feed
    const row = s.db.prepare("SELECT name, earned_at, imported FROM advancement_first WHERE advancement = 'minecraft:story/mine_diamond'").get();
    expect(row).toEqual({ name: "Bea", earned_at: T0 - 10 * DAY, imported: 1 });
    const g = await s.h.advancementsPerDay("network", "week");
    expect(g.since).toBe(T0 - 10 * DAY); // reaches back to the imported first
    expect(g.days.map((x) => x.v)).toEqual([0, 0, 0, 0, 0, 1, 0]); // the last 7 days: root yesterday, diamond 10 days back is outside the week
    expect(g.days[6].day).toBe(Date.UTC(2026, 10, 4));
    expect((await s.h.advancementsPerDay("network", "month")).days.find((x) => x.day === Date.UTC(2026, 9, 25))?.v).toBe(1);
    const q = await s.h.advancementsPerDay("network", "quarter"); // the heatmap's range: every day since the earliest first
    expect(q.days.length).toBe(11);
    expect(q.days[0]).toEqual({ day: Date.UTC(2026, 9, 25), v: 1 });
  });

  test("purge removes a player who opted out after being recorded", async () => {
    const s = setup();
    s.f.advFeed = [adv("minecraft:story/root", T0 - DAY, { uuid: "u-x", name: "Xan" })];
    await recordAdvancements(s.d, "network");
    const hidden = (p: { uuid: string; name: string }) => p.uuid === "u-x";
    purgeHidden(s.db, hidden);
    expect(s.db.prepare("SELECT count(*) AS n FROM advancement_first").get()).toEqual({ n: 0 });
  });

  test("off (a proxy without D-111): skipped without a request, since null, servers too", async () => {
    const s = setup();
    s.f.advancementsOn = false;
    expect(await recordAdvancements(s.d, "network")).toBe("skipped");
    expect(await recordServerAdvancements(s.d)).toBe("skipped");
    expect(s.f.calls).toEqual([]);
    expect(await s.h.advancementsPerDay("network", "month")).toEqual({ since: null, days: [] });
  });

  test("on with nothing completed: zero days from the first run; servers after a network sample", async () => {
    const s = setup();
    await recordAdvancements(s.d, "network");
    expect(await s.h.advancementsPerDay("network", "month")).toEqual({ since: T0, days: [{ day: Date.UTC(2026, 10, 4), v: 0 }] });
    expect(await recordServerAdvancements(s.d)).toBe("down"); // no network sample yet
    await recordNetwork(s.d);
    s.f.advFeed = [adv("minecraft:story/root", T0 - HOUR, { scope: "server:survival" })];
    expect(await recordServerAdvancements(s.d)).toBe("ok");
    expect((await s.h.advancementsPerDay("server:survival", "week")).days.at(-1)?.v).toBe(1);
    expect((await s.h.advancementsPerDay("server:lobby", "week")).days.at(-1)?.v).toBe(0);
    expect((await s.h.advancementsPerDay("network", "week")).days.at(-1)?.v).toBe(0); // never added across scopes
  });
});

describe("players and joins per week", () => {
  test("empty until every first_seen is known, then counts per Monday week", async () => {
    const s = setup({ hidden: ["u-hid"] });
    for (let i = 0; i < 40; i++) s.f.players.push({ uuid: `u-${String(i).padStart(2, "0")}`, name: `P${i}`, first_seen: T0 - (i % 3) * WEEK_MS - HOUR });
    s.f.players.push({ uuid: "u-hid", name: "Hid", first_seen: T0 });
    await recordPlayers(s.d); // 30 profiles per run
    expect(await s.h.joinsPerWeek("month")).toEqual({ since: null, points: [] });
    await recordPlayers(s.d);
    const r = await s.h.joinsPerWeek("month");
    expect(r.points.map((p) => p.v)).toEqual([13, 13, 14]);
    expect(r.points.at(-1)!.t).toBe(weekStart(T0));
    expect(s.db.prepare("SELECT count(*) AS n FROM player WHERE uuid = 'u-hid'").get()).toEqual({ n: 0 });
    // a player who opts out later disappears from the counts and the table
    purgeHidden(s.db, (p) => p.uuid === "u-00");
    expect((await s.h.joinsPerWeek("month")).points.reduce((a, p) => a + p.v, 0)).toBe(39);
  });
});
const WEEK_MS = 7 * DAY;

describe("scheduler", () => {
  test("restarts resume from the last run; failures retry sooner", () => {
    const hourly = JOBS.find((j) => j.name === "boards")!;
    expect(firstRun(hourly, null, T0, 2)).toBe(T0 + 5_000 + 8_000);
    expect(firstRun(hourly, T0 - 5 * MINUTE, T0, 2)).toBe(T0 + 55 * MINUTE);
    expect(firstRun(hourly, T0 - 3 * HOUR, T0, 2)).toBe(T0 + 13_000);
    expect(nextRun(hourly, T0, "ok", T0 + 20_000)).toBe(T0 + HOUR);
    expect(nextRun(hourly, T0, "down", T0 + 20_000)).toBe(T0 + 20_000 + 5 * MINUTE);
    const minute = JOBS.find((j) => j.name === "network")!;
    expect(firstRun(minute, null, T0 + 12_345, 0)).toBe(T0 + 13_345);
    expect(nextRun(minute, T0 + 13_345, "ok", T0 + 14_000)).toBe(T0 + MINUTE + 2_000);
  });

  test("runs jobs inside the recorder context and keeps their last run", async () => {
    const s = setup();
    let seen = false;
    const sched = startScheduler(s.d, [{ name: "probe", every: HOUR, run: async () => ((seen = inRecorder()), "ok") }]);
    expect(await sched.runOnce("probe")).toBe("ok");
    sched.stop();
    expect(seen).toBe(true);
    expect(inRecorder()).toBe(false);
    expect(getMetaNumber(s.db, "last_run:probe")).toBe(T0);
  });

  test("a throwing job is logged once and counts as down", async () => {
    const s = setup();
    const sched = startScheduler(s.d, [{ name: "boom", every: HOUR, run: async () => { throw new Error("nope"); } }]);
    expect(await sched.runOnce("boom")).toBe("down");
    expect(await sched.runOnce("boom")).toBe("down");
    sched.stop();
    expect(s.logs.filter((l) => l.includes("not recorded")).length).toBe(1);
    expect(getMetaNumber(s.db, "last_run:boom")).toBeNull();
  });
});

describe("history never throws", () => {
  test("a closed database answers like a fresh install", async () => {
    const s = setup();
    await recordNetwork(s.d);
    s.db.close();
    const logs: string[] = [];
    const h = createSqliteHistory(s.db, { log: (l) => logs.push(l) });
    expect(await h.online("network", "day")).toEqual({ since: null, points: [] });
    expect(await h.recordingSince()).toBeNull();
    expect(logs.length).toBe(1);
  });

  test("bad scopes and ranges are empty, not errors", async () => {
    const s = setup();
    await recordNetwork(s.d);
    expect(await s.h.online("server:../x" as never, "day")).toEqual({ since: null, points: [] });
    expect(await s.h.online("network", "year" as never)).toEqual({ since: null, points: [] });
    expect(await s.h.networkTotal("not a metric", "network", "day")).toEqual({ since: null, points: [] });
    expect(seriesSince(s.db, "online:network")).toBe(T0);
  });
});

describe("mock seeding", () => {
  test("fresh: one sample per series, every chart empty; busy: 30 days of history", async () => {
    const s = setup();
    s.f.boards.set("mined:*|network", board([["u-a", "Ann", 10], ["u-b", "Bo", 20]]));
    s.f.boards.set("playtime|network", board([["u-a", "Ann", 1000]], "ms"));
    s.f.players.push({ uuid: "u-a", name: "Ann", first_seen: T0 - 10 * DAY });
    await seedMock(s.d, "fresh");
    expect((await s.h.online("network", "week")).points.length).toBe(1);
    expect(await s.h.recordingSince()).toBe(T0);

    const b = setup();
    b.f.boards = s.f.boards;
    b.f.players = s.f.players;
    b.f.feed = [ms("mined:minecraft:stone", 10, T0 - 2 * DAY)];
    await seedMock(b.d, "busy");
    expect((await b.h.online("network", "month")).points.length).toBeGreaterThan(100);
    expect((await b.h.online("network", "day")).points.length).toBeGreaterThan(250);
    expect((await b.h.server("events", "month")).samples.some((x) => x.linked)).toBe(true);
    expect((await b.h.server("survival", "week")).samples.some((x) => !x.linked)).toBe(true); // the outage
    expect((await b.h.rankMoves("mined", "network")).moves.length).toBe(2);
    expect((await b.h.networkTotal("mined", "network", "month")).points.at(-1)!.v).toBe(30);
    expect(Object.keys(await b.h.miniPresence("survival", "week"))).toEqual(["sky-1"]);
    expect((await b.h.activityByHour("network", "week")).cells.flat().every((c) => c !== null)).toBe(true);
    expect((await b.h.joinsPerWeek("month")).points.reduce((a, p) => a + p.v, 0)).toBe(1);
  });
});
