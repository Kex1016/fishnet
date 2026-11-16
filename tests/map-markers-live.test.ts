// FMK-3: the markers revalidation of the live hub (brief §4) and the client's `markers` event / poll fallback.
import { describe, expect, test } from "bun:test";
import { fail, ok, type Result } from "#lib/api/result.ts";
import type { MapChanges, MapPlayers } from "#lib/api/types.ts";
import { createLiveHub, type Clock, type LiveDeps, type Sink } from "#lib/server/map/live.ts";
import { connectLive, MARKERS_POLL_MS, POLL_MS } from "#lib/map/liveClient.ts";
import { bumpMarkers } from "#lib/server/cakeutils/mock/markers.ts";
import { createMapClient } from "#lib/server/cakeutils/map.ts";
import { createCore } from "#lib/server/cakeutils/core.ts";
import { handleMock } from "#lib/server/cakeutils/mock/handler.ts";
import { worldOf, type FetchLike, type World } from "#lib/server/cakeutils/mock/index.ts";
import { ServerList } from "#lib/server/hidden-servers-list.ts";
import { HiddenList } from "#lib/server/hidden-list.ts";

function fakeClock() {
  let t = 1_800_000_000_000;
  let id = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: Clock = {
    now: () => t,
    setTimeout: (fn, ms) => (timers.set(++id, { at: t + Math.max(0, ms), fn }), id),
    clearTimeout: (h) => void (typeof h === "number" && timers.delete(h))
  };
  const flush = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  };
  async function advance(ms: number) {
    const end = t + ms;
    await flush();
    for (;;) {
      let next: [number, { at: number; fn: () => void }] | null = null;
      for (const e of timers) if (e[1].at <= end && (!next || e[1].at < next[1].at || (e[1].at === next[1].at && e[0] < next[0]))) next = e;
      if (!next) break;
      timers.delete(next[0]);
      t = next[1].at;
      next[1].fn();
      await flush();
    }
    t = end;
    await flush();
  }
  return { clock, advance, flush, get now() { return t; } };
}

const OW = "minecraft_overworld";

function rig() {
  const fc = fakeClock();
  const s = {
    rev: {} as Record<string, number>,
    mode: "up" as "up" | "down" | "limited" | "notfound" | "stale",
    calls: [] as { server: string; world: string; at: number }[],
    visible: true
  };
  const deps: LiveDeps = {
    players: async (server): Promise<Result<MapPlayers>> => ok({ server, updated_at: fc.now, stale: false, players: [] }),
    changes: async (): Promise<Result<MapChanges>> => fail("off", { status: 404 }),
    markers: async (server, world) => {
      s.calls.push({ server, world, at: fc.now });
      if (s.mode === "down") return fail("down");
      if (s.mode === "limited") return fail("rate_limited", { status: 429, retryAfter: 90 });
      if (s.mode === "notfound") return fail("not_found", { status: 404 });
      const r = ok({ rev: s.rev[`${server}/${world}`] ?? 0 });
      return s.mode === "stale" ? { ...r, stale: true } : r;
    },
    playerUpdateMs: async () => 2000,
    visible: () => s.visible,
    hiddenPlayer: () => false,
    clock: fc.clock
  };
  const hub = createLiveHub(deps);
  let ip = 0;
  const sub = (world: string | null, server = "survival") => {
    const raw: string[] = [];
    const k: Sink = { write: (f) => (raw.push(f), 0), end() {} };
    const r = hub.subscribe({ server, ip: `10.0.${Math.floor(++ip / 200)}.${ip % 200}`, world, since: null, sink: k });
    if (!r.ok) throw new Error(r.reason);
    return { raw, markers: () => raw.filter((f) => f.startsWith("event: markers")).map((f) => JSON.parse(f.split("\n")[1].slice(6))), close: () => r.sub.close() };
  };
  return { fc, s, hub, sub };
}

describe("hub markers revalidation", () => {
  test("one revalidation per 30 s per watched world, with 1 or 50 subscribers", async () => {
    for (const n of [1, 50]) {
      const r = rig();
      const subs = Array.from({ length: n }, () => r.sub(OW));
      await r.fc.advance(5 * 60_000);
      // the first call is at once, then every 30 s: 1 + 10 in 5 minutes
      expect(r.s.calls.length).toBe(11);
      for (let i = 1; i < r.s.calls.length; i++) expect(r.s.calls[i].at - r.s.calls[i - 1].at).toBeGreaterThanOrEqual(30_000);
      subs.forEach((x) => expect(x.markers()).toEqual([]));
      r.hub.stop();
    }
  });

  test("the first rev fires nothing, an unchanged rev (304) fires nothing, a new rev fires one event per subscriber of that world only", async () => {
    const r = rig();
    r.s.rev[`survival/${OW}`] = 4;
    r.s.rev["survival/minecraft_the_nether"] = 9;
    const a = r.sub(OW);
    const b = r.sub(OW);
    const other = r.sub("minecraft_the_nether");
    const none = r.sub(null);
    await r.fc.advance(60_000);
    expect(a.markers()).toEqual([]);
    r.s.rev[`survival/${OW}`] = 5;
    await r.fc.advance(30_000);
    expect(a.markers()).toEqual([{ world: OW, rev: 5 }]);
    expect(b.markers()).toEqual([{ world: OW, rev: 5 }]);
    expect(other.markers()).toEqual([]);
    expect(none.raw.join("")).not.toContain("markers");
    await r.fc.advance(90_000);
    expect(a.markers()).toHaveLength(1);
    r.hub.stop();
  });

  test("a subscriber that joins later gets no replay; frames carry only world and rev", async () => {
    const r = rig();
    const a = r.sub(OW);
    await r.fc.advance(30_000);
    r.s.rev[`survival/${OW}`] = 2;
    await r.fc.advance(30_000);
    const late = r.sub(OW);
    expect(late.markers()).toEqual([]);
    for (const f of a.raw.filter((x) => x.startsWith("event: markers"))) expect(Object.keys(JSON.parse(f.split("\n")[1].slice(6))).sort()).toEqual(["rev", "world"]);
    r.hub.stop();
  });

  test("no requests for unwatched worlds; polling stops when the last watcher leaves and a rejoin starts from a fresh baseline", async () => {
    const r = rig();
    const a = r.sub(OW);
    await r.fc.advance(60_000);
    const n = r.s.calls.length;
    expect(r.s.calls.every((c) => c.world === OW)).toBe(true);
    a.close();
    await r.fc.advance(5 * 60_000);
    expect(r.s.calls.length).toBe(n);
    r.s.rev[`survival/${OW}`] = 7;
    const b = r.sub(OW);
    await r.fc.advance(1000);
    expect(b.markers()).toEqual([]); // the first rev seen after joining is the baseline
    r.hub.stop();
  });

  test("never for a hidden or unlisted server", async () => {
    const r = rig();
    r.s.visible = false;
    const res = r.hub.subscribe({ server: "staff", ip: "1.1.1.1", world: OW, since: null, sink: { write: () => 0, end() {} } });
    expect(res.ok).toBe(false);
    await r.fc.advance(2 * 60_000);
    expect(r.s.calls).toEqual([]);
  });

  test("a server that turns hidden while watched stops its markers polls", async () => {
    const r = rig();
    const a = r.sub(OW);
    await r.fc.advance(30_000);
    const n = r.s.calls.length;
    r.s.visible = false;
    await r.fc.advance(2 * 60_000);
    expect(r.s.calls.length).toBeLessThanOrEqual(n + 1);
    expect(a.markers()).toEqual([]);
    r.hub.stop();
  });

  test("a 404 stops polling the world until it is watched again", async () => {
    const r = rig();
    r.s.mode = "notfound";
    const a = r.sub(OW);
    await r.fc.advance(5 * 60_000);
    expect(r.s.calls).toHaveLength(1);
    r.s.mode = "up";
    const b = r.sub(OW);
    await r.fc.advance(30_000);
    expect(r.s.calls.length).toBeGreaterThan(1);
    expect(a.markers().concat(b.markers())).toEqual([]);
    r.hub.stop();
  });

  test("down, 429 and a stale answer keep the last rev and send nothing; the next good answer compares with it", async () => {
    const r = rig();
    const a = r.sub(OW);
    await r.fc.advance(0);
    r.s.rev[`survival/${OW}`] = 1;
    await r.fc.advance(30_000); // 0 -> 1 fires once
    expect(a.markers()).toHaveLength(1);
    const before = a.markers().length;
    for (const mode of ["down", "limited", "stale"] as const) {
      r.s.mode = mode;
      r.s.rev[`survival/${OW}`] = 50;
      await r.fc.advance(120_000);
    }
    expect(a.markers()).toHaveLength(before);
    r.s.mode = "up";
    r.s.rev[`survival/${OW}`] = 2;
    await r.fc.advance(120_000);
    expect(a.markers().at(-1)).toEqual({ world: OW, rev: 2 });
    expect(a.markers()).toHaveLength(before + 1);
    r.hub.stop();
  });

  test("a 429's retry-after slows the world, within the budget of 2 requests a minute", async () => {
    const r = rig();
    r.s.mode = "limited";
    r.sub(OW);
    await r.fc.advance(5 * 60_000);
    expect(r.s.calls.length).toBeLessThanOrEqual(1 + Math.ceil(300 / 90));
    r.hub.stop();
  });
});

describe("through the map client and the mock", () => {
  test("a rev bump in the mock fires one event; every 30 s tick really reaches cakeutils (never an LRU hit)", async () => {
    const world = structuredClone(worldOf("busy")) as World;
    const fc = fakeClock();
    const seen: { path: string; inm: string | null }[] = [];
    const fetchImpl: FetchLike = (input, init) => {
      const u = new URL(String(input));
      seen.push({ path: u.pathname, inm: new Headers(init?.headers).get("if-none-match") });
      return handleMock(world, new Request(input, init));
    };
    const core = createCore({ baseUrl: "http://mock.test", token: "cu_mock_mock", fetchImpl, log: () => {}, now: () => fc.now });
    const m = createMapClient({ core, now: () => fc.now, hiddenLive: () => new ServerList([]), hiddenServers: () => new ServerList([]), hiddenPlayers: () => new HiddenList([]) });
    const hub = createLiveHub({
      players: (s) => m.mapPlayers(s, { priority: "background" }),
      changes: (s, w) => m.mapChanges(s, w, { priority: "background" }),
      markers: (s, w) => m.markers(s, w, { priority: "background" }),
      playerUpdateMs: async () => 2000,
      visible: (s) => m.serverVisible(s, "live"),
      hiddenPlayer: () => false,
      clock: fc.clock
    });
    const raw: string[] = [];
    const r = hub.subscribe({ server: "survival", ip: "1.2.3.4", world: OW, since: null, sink: { write: (x) => (raw.push(x), 0), end() {} } });
    expect(r.ok).toBe(true);
    await fc.advance(1000);
    const mk = () => seen.filter((s) => s.path.endsWith(`/${OW}/markers`));
    expect(mk()).toHaveLength(1);
    await fc.advance(30_000);
    expect(mk()).toHaveLength(2);
    expect(mk()[1].inm).toMatch(/^"m\d+"$/); // revalidation: If-None-Match
    expect(raw.filter((x) => x.startsWith("event: markers"))).toHaveLength(0);
    bumpMarkers(world.map!.markers, "survival", OW);
    await fc.advance(30_000);
    expect(mk()).toHaveLength(3);
    expect(raw.filter((x) => x.startsWith("event: markers"))).toHaveLength(1);
    hub.stop();
  });
});

// ---- client

class FakeES {
  static all: FakeES[] = [];
  readyState = 1;
  listeners = new Map<string, ((e: unknown) => void)[]>();
  constructor(public url: string) {
    FakeES.all.push(this);
  }
  addEventListener(n: string, f: (e: unknown) => void) {
    this.listeners.set(n, [...(this.listeners.get(n) ?? []), f]);
  }
  close() {}
  emit(n: string, data?: unknown) {
    for (const f of this.listeners.get(n) ?? []) f({ data: typeof data === "string" ? data : JSON.stringify(data) });
  }
}

describe("liveClient markers", () => {
  test("a markers frame reaches onMarkers; a bad frame is dropped", () => {
    FakeES.all = [];
    const got: unknown[] = [];
    connectLive("s", OW, null, { onPlayers: () => {}, onMarkers: (e) => got.push(e) }, { EventSource: FakeES as unknown as typeof EventSource });
    const es = FakeES.all[0];
    es.emit("markers", { world: OW, rev: 3 });
    es.emit("markers", "not json");
    es.emit("markers", { world: 3, rev: 3 });
    es.emit("markers", { world: OW, rev: "3" });
    es.emit("markers", { world: OW, rev: 1.5 });
    expect(got).toEqual([{ world: OW, rev: 3 }]);
  });

  test("poll fallback checks markers.json at most every 30 s with If-None-Match and fires on a rev change", async () => {
    let now = 1_000_000;
    const timers: (() => void)[] = [];
    const calls: { url: string; inm: string | null }[] = [];
    let rev = 4;
    const fired: unknown[] = [];
    const conn = connectLive("s", OW, null, { onPlayers: () => {}, onMarkers: (e) => fired.push(e) }, {
      EventSource: undefined,
      now: () => now,
      markersRev: 4,
      setTimeout: (fn) => (timers.push(fn), timers.length),
      clearTimeout: () => {},
      fetch: (async (u: string, init?: RequestInit) => {
        if (u.includes("markers.json")) {
          const inm = (init?.headers as Record<string, string>)["if-none-match"] ?? null;
          calls.push({ url: u, inm });
          if (inm === `"m${rev}"`) return new Response(null, { status: 304 });
          return new Response(JSON.stringify({ rev }), { status: 200 });
        }
        return new Response(JSON.stringify({ server: "s", at: 1, state: "live", players: [] }));
      }) as unknown as typeof fetch
    });
    const tick = async () => {
      const fn = timers.shift()!;
      fn();
      for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
    };
    await new Promise((r) => setImmediate(r));
    for (let i = 0; i < 5; i++) {
      now += POLL_MS;
      await tick();
    }
    expect(calls).toHaveLength(0); // 25 s in
    now += POLL_MS;
    await tick();
    expect(calls).toEqual([{ url: `/map/s/markers.json?world=${OW}`, inm: '"m4"' }]);
    expect(fired).toEqual([]);
    rev = 5;
    for (let i = 0; i < MARKERS_POLL_MS / POLL_MS; i++) {
      now += POLL_MS;
      await tick();
    }
    expect(calls).toHaveLength(2);
    expect(fired).toEqual([{ world: OW, rev: 5 }]);
    conn.close();
  });
});
