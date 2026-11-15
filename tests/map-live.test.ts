// FM-2: the live hub (brief §4.3), driven by a fake clock and a fake cakeutils.
import { describe, expect, test } from "bun:test";
import { fail, ok, type Result } from "#lib/api/result.ts";
import type { MapChanges, MapPlayers } from "#lib/api/types.ts";
import { createLiveHub, diffDots, toDot, HEARTBEAT, type Clock, type LiveDeps, type LiveLimits, type Sink } from "#lib/server/map/live.ts";
import { addressKey } from "#lib/server/map/address.ts";
import type { PlayerDot } from "#lib/map/types.ts";

// ---- fake clock: timers run in time order; microtasks are flushed between them

function fakeClock() {
  let t = 1_800_000_000_000;
  let id = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: Clock = {
    now: () => t,
    setTimeout: (fn, ms) => {
      const h = ++id;
      timers.set(h, { at: t + Math.max(0, ms), fn });
      return h;
    },
    clearTimeout: (h) => {
      if (typeof h === "number") timers.delete(h);
    }
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
  return { clock, advance, flush, get now() { return t; }, pending: () => timers.size };
}

// ---- fake cakeutils

type P = { uuid: string; name: string; world: string; x: number; z: number; yaw: number };
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const player = (n: number, x = 0, z = 0, world = "minecraft_overworld"): P => ({ uuid: U(n), name: `p${n}`, world, x, z, yaw: 0 });

function upstream() {
  const s = {
    players: [player(1, 10.5, -3.2), player(2, 100, 100)] as P[],
    mode: "up" as "up" | "down" | "stale" | "off" | "limited",
    playerUpdateMs: 1000 as number | null,
    calls: [] as number[],
    changeCalls: [] as { world: string; at: number }[],
    hidden: new Set<string>(),
    visible: true,
    listed: null as Set<string> | null,
    /** a players call waits for this before answering */
    gate: null as Promise<void> | null,
    inFlight: 0,
    maxInFlight: 0,
    logs: {} as Record<string, MapChanges | "off">
  };
  return s;
}

function hubWith(o: { limits?: Partial<LiveLimits> } = {}) {
  const fc = fakeClock();
  const s = upstream();
  const deps: LiveDeps = {
    players: async (server): Promise<Result<MapPlayers>> => {
      s.calls.push(fc.now);
      s.inFlight++;
      s.maxInFlight = Math.max(s.maxInFlight, s.inFlight);
      try {
        if (s.gate) await s.gate;
        if (s.mode === "down") return fail("down");
        if (s.mode === "limited") return fail("rate_limited", { status: 429, retryAfter: 9 });
        if (s.mode === "off") return fail("off", { status: 404 });
        return ok({ server, updated_at: fc.now, stale: s.mode === "stale", players: s.players.map((p) => ({ ...p })) });
      } finally {
        s.inFlight--;
      }
    },
    changes: async (_server, world): Promise<Result<MapChanges>> => {
      s.changeCalls.push({ world, at: fc.now });
      const l = s.logs[world];
      if (!l || l === "off") return fail("off", { status: 404 });
      return ok(structuredClone(l));
    },
    playerUpdateMs: async () => s.playerUpdateMs,
    worlds: async () => s.listed,
    visible: () => s.visible,
    hiddenPlayer: (p) => s.hidden.has(p.uuid) || s.hidden.has(p.name),
    clock: fc.clock,
    limits: o.limits
  };
  const hub = createLiveHub(deps);
  return { hub, s, fc };
}

type Frame = { event: string; data: any } | { comment: string } | { retry: number };

function sink() {
  const raw: string[] = [];
  let ended = false;
  let queued = 0;
  const k: Sink & { raw: string[]; frames: () => Frame[]; events: (name: string) => any[]; ended: () => boolean; setQueued: (n: number) => void } = {
    raw,
    write(f) {
      raw.push(f);
      return queued;
    },
    end() {
      ended = true;
    },
    ended: () => ended,
    setQueued: (n) => (queued = n),
    frames: () => raw.map(parse),
    events: (name) => raw.map(parse).filter((f): f is { event: string; data: any } => "event" in f && f.event === name).map((f) => f.data)
  };
  return k;
}

function parse(frame: string): Frame {
  expect(frame.endsWith("\n\n")).toBe(true);
  const lines = frame.slice(0, -2).split("\n");
  if (lines[0].startsWith(":")) return { comment: lines[0].slice(1).trim() };
  if (lines[0].startsWith("retry: ")) return { retry: Number(lines[0].slice(7)) };
  expect(lines.length).toBe(2);
  expect(lines[0].startsWith("event: ")).toBe(true);
  expect(lines[1].startsWith("data: ")).toBe(true);
  return { event: lines[0].slice(7), data: JSON.parse(lines[1].slice(6)) };
}

const sub = (hub: ReturnType<typeof hubWith>["hub"], o: { ip?: string; world?: string | null; since?: { epoch: string; seq: number } | null; server?: string } = {}) => {
  const k = sink();
  const r = hub.subscribe({ server: o.server ?? "survival", ip: o.ip ?? "10.0.0.1", world: o.world ?? null, since: o.since ?? null, sink: k });
  return { k, r };
};

// ---- pure parts

describe("dots and diffs", () => {
  test("positions are floored to the block, rows not well formed are dropped", () => {
    expect(toDot({ uuid: U(1).toUpperCase(), name: "a", world: "w", x: 10.9, z: -0.5, yaw: 89.6 })).toEqual({ uuid: U(1), name: "a", world: "w", x: 10, z: -1, yaw: 90 });
    expect(toDot({ uuid: U(1), name: "a", world: "w", x: -0.2, z: 0.2, yaw: null })).toEqual({ uuid: U(1), name: "a", world: "w", x: -1, z: 0, yaw: 0 });
    expect(toDot({ uuid: "nope", name: "a", world: "w", x: 1, z: 1, yaw: 0 })).toBeNull();
    expect(toDot({ uuid: U(1), name: "a", world: "w", x: Number.NaN, z: 1, yaw: 0 })).toBeNull();
    expect(toDot({ uuid: U(1), name: 3, world: "w", x: 1, z: 1, yaw: 0 })).toBeNull();
    expect(toDot(null)).toBeNull();
  });

  test("diff: new and moved dots, and the ones that left", () => {
    const d = (n: number, x: number): PlayerDot => ({ uuid: U(n), name: `p${n}`, world: "w", x, z: 0, yaw: 0 });
    const a = new Map([[U(1), d(1, 0)], [U(2), d(2, 0)]]);
    const b = new Map([[U(1), d(1, 0)], [U(2), d(2, 5)], [U(3), d(3, 0)]]);
    expect(diffDots(a, b)).toEqual({ players: [d(2, 5), d(3, 0)], gone: [] });
    expect(diffDots(b, new Map([[U(3), d(3, 0)]]))).toEqual({ players: [], gone: [U(1), U(2)] });
  });
});

// ---- lifecycle

describe("poller lifecycle", () => {
  test("nothing is polled before the first subscriber; the first one starts it at once", async () => {
    const { hub, s, fc } = hubWith();
    await fc.advance(60_000);
    expect(s.calls.length).toBe(0);
    const { r } = sub(hub);
    expect(r.ok).toBe(true);
    await fc.flush();
    expect(s.calls.length).toBe(1);
    expect(hub.stats().hubs.map((h) => h.server)).toEqual(["survival"]);
  });

  test("50 subscribers share one upstream poll per interval, at max(2 s, player_update_ms)", async () => {
    const { hub, s, fc } = hubWith();
    const subs = Array.from({ length: 50 }, (_, i) => sub(hub, { ip: `10.0.${i}.1` }));
    expect(subs.every((x) => x.r.ok)).toBe(true);
    const t0 = fc.now;
    await fc.advance(20_000);
    // player_update_ms 1000 → the 2 s floor: t0, t0+2 s, …, t0+20 s
    expect(s.calls.length).toBe(11);
    const gaps = s.calls.slice(1).map((t, i) => t - s.calls[i]);
    expect(gaps.every((g) => g === 2000)).toBe(true);
    expect(s.calls[0]).toBe(t0);
    // every subscriber has its snapshot
    for (const x of subs) expect(x.k.events("players")[0].players.length).toBe(2);
  });

  test("never polls faster than player_update_ms", async () => {
    const { hub, s, fc } = hubWith();
    s.playerUpdateMs = 5000;
    sub(hub);
    await fc.advance(30_000);
    const gaps = s.calls.slice(1).map((t, i) => t - s.calls[i]);
    expect(gaps.length).toBe(6);
    expect(gaps.every((g) => g === 5000)).toBe(true);
  });

  test("polls never overlap: a slow answer delays the next poll", async () => {
    const { hub, s, fc } = hubWith();
    let release = () => {};
    s.gate = new Promise((r) => (release = r));
    sub(hub);
    await fc.advance(10_000);
    expect(s.calls.length).toBe(1);
    s.gate = null;
    release();
    await fc.advance(0);
    // the late poll is over: the next one starts at once (its interval has passed), then the cadence resumes
    expect(s.calls.length).toBe(2);
    await fc.advance(1_999);
    expect(s.calls.length).toBe(2);
    await fc.advance(1);
    expect(s.calls.length).toBe(3);
    expect(s.maxInFlight).toBe(1);
  });

  test("stops 30 s after the last subscriber leaves; a return within the window keeps it warm", async () => {
    const { hub, s, fc } = hubWith();
    const a = sub(hub);
    const b = sub(hub, { ip: "10.0.0.2" });
    await fc.advance(4_000);
    if (!a.r.ok || !b.r.ok) throw new Error("refused");
    a.r.sub.close();
    await fc.advance(60_000);
    expect(hub.stats().hubs.length).toBe(1); // b still there
    b.r.sub.close();
    await fc.advance(20_000);
    expect(hub.stats().hubs.length).toBe(1); // inside the window, still polling
    const c = sub(hub);
    await fc.advance(40_000);
    expect(hub.stats().hubs.length).toBe(1);
    if (!c.r.ok) throw new Error("refused");
    c.r.sub.close();
    await fc.advance(29_999);
    expect(hub.stats().hubs.length).toBe(1);
    await fc.advance(1);
    expect(hub.stats().hubs.length).toBe(0);
    const n = s.calls.length;
    await fc.advance(120_000);
    expect(s.calls.length).toBe(n);
    expect(fc.pending()).toBe(0);
    expect(hub.stats().streams).toBe(0);
  });
});

// ---- what goes out

describe("frames", () => {
  test("connect: retry, status, full snapshot; then only diffs, and only when something changed", async () => {
    const { hub, s, fc } = hubWith();
    const { k } = sub(hub);
    await fc.flush();
    const f = k.frames();
    expect(f[0]).toEqual({ retry: 5000 });
    expect(f[1]).toEqual({ event: "status", data: { state: "live", as_of: null } });
    const first = k.events("players")[0];
    expect(first.gone).toEqual([]);
    expect(first.players).toEqual([
      { uuid: U(1), name: "p1", world: "minecraft_overworld", x: 10, z: -4, yaw: 0 },
      { uuid: U(2), name: "p2", world: "minecraft_overworld", x: 100, z: 100, yaw: 0 }
    ]);
    // nothing moved (a sub-block move is no move)
    s.players[0].x = 10.9;
    await fc.advance(10_000);
    expect(k.events("players").length).toBe(1);
    // one moves, one leaves, one arrives
    s.players = [{ ...player(1, 12, -4) }, player(3, 0, 0, "minecraft_the_nether")];
    await fc.advance(2_000);
    const ev = k.events("players");
    expect(ev.length).toBe(2);
    expect(ev[1].players.map((p: PlayerDot) => [p.uuid, p.x, p.world])).toEqual([[U(1), 12, "minecraft_overworld"], [U(3), 0, "minecraft_the_nether"]]);
    expect(ev[1].gone).toEqual([U(2)]);
    // a late subscriber gets the full current snapshot, not a diff
    const late = sub(hub, { ip: "10.0.0.9" });
    expect(late.k.events("players")[0].players.map((p: PlayerDot) => p.uuid)).toEqual([U(1), U(3)]);
  });

  test("hidden players are never sent: not in snapshots, diffs or players.json, even when hidden mid-run", async () => {
    const { hub, s, fc } = hubWith();
    s.hidden.add(U(2));
    const { k } = sub(hub);
    await fc.advance(4_000);
    s.players[1].x = 300; // the hidden one moves: still nothing
    await fc.advance(4_000);
    s.hidden.add("p1"); // hidden by name between two polls
    const late = sub(hub, { ip: "10.0.0.2" });
    expect(late.k.raw.join("")).not.toContain(U(1));
    await fc.advance(2_000);
    const snap = await hub.snapshot("survival");
    expect(snap!.players).toEqual([]);
    const all = k.raw.join("") + late.k.raw.join("");
    expect(all).not.toContain(U(2));
    expect(all).not.toContain("p2");
    // p1 was shown before it was hidden: it leaves, and never comes back
    expect(k.events("players").at(-1).gone).toEqual([U(1)]);
    s.players[0].x = 500;
    await fc.advance(10_000);
    expect(k.events("players").at(-1).gone).toEqual([U(1)]);
  });

  test("players on a world /v2/map no longer lists (a mini turned private) stop being sent", async () => {
    const { hub, s, fc } = hubWith();
    const mini = "cakeutils_miniservers_skyblock-1_overworld";
    s.players = [player(1), player(2, 5, 5, mini)];
    s.listed = new Set(["minecraft_overworld", mini]);
    const { k } = sub(hub);
    await fc.flush();
    expect(k.events("players")[0].players.length).toBe(2);
    s.listed = new Set(["minecraft_overworld"]);
    await fc.advance(2_000);
    expect(k.events("players").at(-1).gone).toEqual([U(2)]);
    // /v2/map unreachable: the last known list still holds
    s.listed = null;
    await fc.advance(2_000);
    const late = sub(hub, { ip: "10.0.0.2" });
    expect(late.k.raw.join("")).not.toContain(mini);
  });

  test("untrusted names cannot break the event framing", async () => {
    const { hub, s, fc } = hubWith();
    s.players = [{ ...player(1), name: "evil\n\nevent: status\ndata: {}\r\n" }];
    const { k } = sub(hub);
    await fc.flush();
    for (const f of k.raw) parse(f); // every frame is exactly one event
    expect(k.events("players")[0].players[0].name).toBe("evil\n\nevent: status\ndata: {}\r\n");
  });

  test("a heartbeat comment every 15 s", async () => {
    const { hub, fc } = hubWith();
    const { k } = sub(hub);
    await fc.advance(14_999);
    expect(k.raw.filter((f) => f === HEARTBEAT).length).toBe(0);
    await fc.advance(1);
    expect(k.raw.filter((f) => f === HEARTBEAT).length).toBe(1);
    await fc.advance(45_000);
    expect(k.raw.filter((f) => f === HEARTBEAT).length).toBe(4);
  });

  test("a stream is closed after 30 min and its slot is freed", async () => {
    const { hub, fc } = hubWith({ limits: { perIp: 1 } });
    const { k } = sub(hub);
    await fc.advance(30 * 60_000 - 1);
    expect(k.ended()).toBe(false);
    expect(sub(hub).r.ok).toBe(false);
    await fc.advance(1);
    expect(k.ended()).toBe(true);
    expect(hub.stats().streams).toBe(0);
    expect(sub(hub).r.ok).toBe(true);
  });

  test("a stream that stops reading is closed instead of buffered", async () => {
    const { hub, s, fc } = hubWith();
    const { k } = sub(hub);
    await fc.flush();
    k.setQueued(2 * 1024 * 1024);
    s.players[0].x = 50;
    await fc.advance(2_000);
    expect(k.ended()).toBe(true);
    expect(hub.stats().streams).toBe(0);
  });
});

// ---- limits

describe("limits", () => {
  test("at most 4 streams per address, then refused with Retry-After; other addresses still get in", async () => {
    const { hub } = hubWith();
    const got = Array.from({ length: 4 }, () => sub(hub, { ip: "203.0.113.7" }));
    expect(got.every((g) => g.r.ok)).toBe(true);
    const fifth = sub(hub, { ip: "203.0.113.7" });
    expect(fifth.r).toEqual({ ok: false, reason: "per_ip", retryAfter: 30 });
    expect(fifth.k.raw.length).toBe(0);
    expect(sub(hub, { ip: "203.0.113.8" }).r.ok).toBe(true);
    if (got[0].r.ok) got[0].r.sub.close();
    expect(sub(hub, { ip: "203.0.113.7" }).r.ok).toBe(true);
  });

  test("an IPv6 host is its /64: any address of the prefix counts as the same client (FM-7)", async () => {
    const { hub } = hubWith();
    for (let i = 0; i < 4; i++) expect(sub(hub, { ip: `2001:db8:1:2::${(i + 1).toString(16)}` }).r.ok).toBe(true);
    expect(sub(hub, { ip: "2001:db8:1:2:aaaa:bbbb:cccc:dddd" }).r).toEqual({ ok: false, reason: "per_ip", retryAfter: 30 });
    expect(sub(hub, { ip: "2001:DB8:1:2::99" }).r.ok).toBe(false);
    // the next /64 is another client; so is an IPv4 host
    expect(sub(hub, { ip: "2001:db8:1:3::1" }).r.ok).toBe(true);
    expect(sub(hub, { ip: "198.51.100.4" }).r.ok).toBe(true);
    expect(hub.stats().streams).toBe(6);
  });

  test("an IPv4 address written as IPv6 is the same client as the IPv4 address", async () => {
    const { hub } = hubWith({ limits: { perIp: 2 } });
    const a = sub(hub, { ip: "203.0.113.7" });
    expect(a.r.ok).toBe(true);
    expect(sub(hub, { ip: "::ffff:203.0.113.7" }).r.ok).toBe(true);
    expect(sub(hub, { ip: "::ffff:cb00:7107" }).r).toEqual({ ok: false, reason: "per_ip", retryAfter: 30 });
    // closing frees the slot under the same key
    if (a.r.ok) a.r.sub.close();
    expect(sub(hub, { ip: "::FFFF:203.0.113.7" }).r.ok).toBe(true);
  });

  test("at most `total` streams in all, across servers", async () => {
    const { hub } = hubWith({ limits: { total: 5 } });
    for (let i = 0; i < 5; i++) expect(sub(hub, { ip: `10.1.0.${i}`, server: i % 2 ? "creative" : "survival" }).r.ok).toBe(true);
    expect(sub(hub, { ip: "10.1.0.99" }).r).toEqual({ ok: false, reason: "total", retryAfter: 30 });
    expect(hub.stats().streams).toBe(5);
  });

  test("closing a subscription twice frees one slot only", async () => {
    const { hub } = hubWith({ limits: { total: 2 } });
    const a = sub(hub);
    sub(hub, { ip: "10.0.0.2" });
    if (!a.r.ok) throw new Error("refused");
    a.r.sub.close();
    a.r.sub.close();
    expect(hub.stats().streams).toBe(1);
    expect(sub(hub, { ip: "10.0.0.3" }).r.ok).toBe(true);
    expect(sub(hub, { ip: "10.0.0.4" }).r.ok).toBe(false);
  });
});

// ---- outages

describe("status", () => {
  test("outage: stale while the last answer is under 30 s old, then offline; dots kept; live again on recovery", async () => {
    const { hub, s, fc } = hubWith();
    const { k } = sub(hub);
    await fc.advance(2_000);
    s.mode = "down";
    await fc.advance(2_000);
    expect(k.events("status").map((e) => e.state)).toEqual(["live", "stale"]);
    expect(k.events("status")[1].as_of).toBe(s.calls[1]);
    await fc.advance(40_000);
    expect(k.events("status").map((e) => e.state)).toEqual(["live", "stale", "offline"]);
    // the failures back off to Retry-After (5 s without one), not the 2 s cadence
    const failing = s.calls.filter((t) => t > s.calls[2]);
    expect(failing.slice(1).map((t, i) => t - failing[i]).every((g) => g === 5000)).toBe(true);
    expect(k.events("players").every((e) => e.gone.length === 0)).toBe(true);
    s.mode = "up";
    await fc.advance(5_000);
    expect(k.events("status").at(-1).state).toBe("live");
    const snap = await hub.snapshot("survival");
    expect(snap!.state).toBe("live");
  });

  test("cakeutils' stale copy is stale; 429 waits for Retry-After", async () => {
    const { hub, s, fc } = hubWith();
    const { k } = sub(hub);
    await fc.flush();
    s.mode = "stale";
    await fc.advance(2_000);
    expect(k.events("status").at(-1).state).toBe("stale");
    s.mode = "limited";
    const before = s.calls.length;
    await fc.advance(10_000);
    expect(s.calls.length - before).toBe(1); // one at +2 s (429, Retry-After 9), the next only at +11 s
    await fc.advance(1_000);
    expect(s.calls.length - before).toBe(2);
  });

  test("positions off: no dots, asked again only once a minute", async () => {
    const { hub, s, fc } = hubWith();
    s.mode = "off";
    const { k } = sub(hub);
    await fc.advance(59_000);
    expect(s.calls.length).toBe(1);
    expect(k.events("players")[0].players).toEqual([]);
    await fc.advance(1_000);
    expect(s.calls.length).toBe(2);
  });

  test("a server that becomes hidden ends its streams and is refused from then on", async () => {
    const { hub, s, fc } = hubWith();
    const { k } = sub(hub);
    await fc.advance(2_000);
    s.visible = false;
    await fc.advance(2_000);
    expect(k.ended()).toBe(true);
    expect(hub.stats()).toEqual({ streams: 0, hubs: [] });
    expect(sub(hub).r).toEqual({ ok: false, reason: "hidden", retryAfter: 0 });
    expect(await hub.snapshot("survival")).toBeNull();
  });
});

// ---- tile change logs

describe("tiles", () => {
  const log = (epoch: string, from: number, to: number, dropped = 0): MapChanges => ({
    server: "survival",
    world: "minecraft_overworld",
    epoch,
    seq: to,
    dropped,
    tiles: Array.from({ length: to - from + 1 }, (_, i) => [from + i, 3, i, 0])
  });

  test("the shown world's log: catch-up on connect, then new rows only, every 5 s", async () => {
    const { hub, s, fc } = hubWith();
    s.logs.minecraft_overworld = log("e1", 1, 3);
    const { k } = sub(hub, { world: "minecraft_overworld" });
    const other = sub(hub, { ip: "10.0.0.2" }); // positions only
    await fc.flush();
    expect(k.events("tiles")).toEqual([{ world: "minecraft_overworld", epoch: "e1", tiles: [["e1.1", 3, 0, 0], ["e1.2", 3, 1, 0], ["e1.3", 3, 2, 0]], reset: false }]);
    await fc.advance(10_000);
    expect(k.events("tiles").length).toBe(1); // unchanged log: nothing
    s.logs.minecraft_overworld = log("e1", 1, 5);
    await fc.advance(5_000);
    expect(k.events("tiles")[1]).toEqual({ world: "minecraft_overworld", epoch: "e1", tiles: [["e1.4", 3, 3, 0], ["e1.5", 3, 4, 0]], reset: false });
    expect(other.k.events("tiles")).toEqual([]);
    const gaps = s.changeCalls.slice(1).map((c, i) => c.at - s.changeCalls[i].at);
    expect(gaps.every((g) => g === 5000)).toBe(true);
  });

  test("a new epoch, or the log dropping rows never seen, is a reset with the whole log", async () => {
    const { hub, s, fc } = hubWith();
    s.logs.minecraft_overworld = log("e1", 1, 3);
    const { k } = sub(hub, { world: "minecraft_overworld" });
    await fc.flush();
    s.logs.minecraft_overworld = log("e2", 1, 2);
    await fc.advance(5_000);
    expect(k.events("tiles").at(-1)).toEqual({ world: "minecraft_overworld", epoch: "e2", tiles: [["e2.1", 3, 0, 0], ["e2.2", 3, 1, 0]], reset: true });
    s.logs.minecraft_overworld = log("e2", 10, 12, 9);
    await fc.advance(5_000);
    expect(k.events("tiles").at(-1).reset).toBe(true);
    expect(k.events("tiles").at(-1).tiles.length).toBe(3);
  });

  test("?epoch=&seq= from the page: only newer rows, or a reset when the page's log is gone", async () => {
    const { hub, s, fc } = hubWith();
    s.logs.minecraft_overworld = log("e1", 1, 5, 0);
    const same = sub(hub, { world: "minecraft_overworld", since: { epoch: "e1", seq: 5 } });
    const behind = sub(hub, { ip: "10.0.0.2", world: "minecraft_overworld", since: { epoch: "e1", seq: 3 } });
    const old = sub(hub, { ip: "10.0.0.3", world: "minecraft_overworld", since: { epoch: "e0", seq: 9 } });
    await fc.flush();
    expect(same.k.events("tiles")).toEqual([]);
    expect(behind.k.events("tiles")).toEqual([{ world: "minecraft_overworld", epoch: "e1", tiles: [["e1.4", 3, 3, 0], ["e1.5", 3, 4, 0]], reset: false }]);
    expect(old.k.events("tiles")[0].reset).toBe(true);
    // a late joiner whose page log fell out of the log
    s.logs.minecraft_overworld = log("e1", 4, 8, 3);
    await fc.advance(5_000);
    const gap = sub(hub, { ip: "10.0.0.4", world: "minecraft_overworld", since: { epoch: "e1", seq: 2 } });
    expect(gap.k.events("tiles")[0].reset).toBe(true);
  });

  test("a page ahead of the hub is not reset: it hears only what is newer than its own position (FM-7)", async () => {
    const { hub, s, fc } = hubWith();
    // the hub polled at seq 5; a page loads a moment later, after cakeutils logged 6 and 7
    s.logs.minecraft_overworld = log("e1", 1, 5, 0);
    const early = sub(hub, { world: "minecraft_overworld", since: { epoch: "e1", seq: 5 } });
    await fc.flush();
    const ahead = sub(hub, { ip: "10.0.0.2", world: "minecraft_overworld", since: { epoch: "e1", seq: 7 } });
    await fc.flush();
    expect(ahead.k.events("tiles")).toEqual([]);
    // the hub catches up to 8: the early stream gets 6..8, the page that was ahead only 8
    s.logs.minecraft_overworld = log("e1", 1, 8, 0);
    await fc.advance(5_000);
    expect(early.k.events("tiles")).toEqual([{ world: "minecraft_overworld", epoch: "e1", tiles: [["e1.6", 3, 5, 0], ["e1.7", 3, 6, 0], ["e1.8", 3, 7, 0]], reset: false }]);
    expect(ahead.k.events("tiles")).toEqual([{ world: "minecraft_overworld", epoch: "e1", tiles: [["e1.8", 3, 7, 0]], reset: false }]);
    // a hub that only reaches the page's position later says nothing to it
    const far = sub(hub, { ip: "10.0.0.3", world: "minecraft_overworld", since: { epoch: "e1", seq: 9 } });
    s.logs.minecraft_overworld = log("e1", 1, 9, 0);
    await fc.advance(5_000);
    expect(far.k.events("tiles")).toEqual([]);
    expect(ahead.k.events("tiles").at(-1)).toEqual({ world: "minecraft_overworld", epoch: "e1", tiles: [["e1.9", 3, 8, 0]], reset: false });
  });

  test("the log going backwards inside one epoch reloads every tile, once", async () => {
    const { hub, s, fc } = hubWith();
    s.logs.minecraft_overworld = log("e1", 1, 9, 0);
    const { k } = sub(hub, { world: "minecraft_overworld", since: { epoch: "e1", seq: 9 } });
    await fc.flush();
    s.logs.minecraft_overworld = log("e1", 1, 2, 0);
    await fc.advance(5_000);
    expect(k.events("tiles")).toEqual([{ world: "minecraft_overworld", epoch: "e1", tiles: [["e1.1", 3, 0, 0], ["e1.2", 3, 1, 0]], reset: true }]);
    await fc.advance(5_000);
    expect(k.events("tiles").length).toBe(1);
    s.logs.minecraft_overworld = log("e1", 1, 3, 0);
    await fc.advance(5_000);
    expect(k.events("tiles").at(-1)).toEqual({ world: "minecraft_overworld", epoch: "e1", tiles: [["e1.3", 3, 2, 0]], reset: false });
  });

  test("a stream without a position hears the whole log once, also when it is empty", async () => {
    const { hub, s, fc } = hubWith();
    s.logs.minecraft_overworld = log("e1", 1, 0, 0);
    const { k } = sub(hub, { world: "minecraft_overworld" });
    await fc.flush();
    expect(k.events("tiles")).toEqual([{ world: "minecraft_overworld", epoch: "e1", tiles: [], reset: false }]);
    await fc.advance(10_000);
    expect(k.events("tiles").length).toBe(1);
  });

  test("a world without a log is asked again after 5 min, and polling stops 30 s after its last watcher", async () => {
    const { hub, s, fc } = hubWith();
    s.logs.minecraft_the_nether = "off";
    s.logs.minecraft_overworld = log("e1", 1, 1);
    const n = sub(hub, { world: "minecraft_the_nether" });
    await fc.advance(4 * 60_000);
    expect(s.changeCalls.filter((c) => c.world === "minecraft_the_nether").length).toBe(1);
    expect(n.k.events("tiles")).toEqual([]);
    await fc.advance(60_000);
    expect(s.changeCalls.filter((c) => c.world === "minecraft_the_nether").length).toBe(2);
    const o = sub(hub, { ip: "10.0.0.2", world: "minecraft_overworld" });
    const keep = sub(hub, { ip: "10.0.0.3" });
    await fc.advance(1_000);
    if (!o.r.ok) throw new Error("refused");
    o.r.sub.close();
    await fc.advance(40_000);
    const count = s.changeCalls.filter((c) => c.world === "minecraft_overworld").length;
    await fc.advance(60_000);
    expect(s.changeCalls.filter((c) => c.world === "minecraft_overworld").length).toBe(count);
    expect(hub.stats().hubs[0].worlds).toEqual(["minecraft_the_nether"]);
    expect(keep.r.ok).toBe(true);
  });
});

// ---- players.json

describe("snapshot (players.json)", () => {
  test("a cold call starts the hub, waits for its first answer and keeps it 30 s", async () => {
    const { hub, s, fc } = hubWith();
    const p = hub.snapshot("survival");
    await fc.flush();
    const snap = await p;
    expect(snap).toEqual({ server: "survival", at: s.calls[0], state: "live", players: [
      { uuid: U(1), name: "p1", world: "minecraft_overworld", x: 10, z: -4, yaw: 0 },
      { uuid: U(2), name: "p2", world: "minecraft_overworld", x: 100, z: 100, yaw: 0 }
    ] });
    // polled every 5 s by a page: the hub stays, one upstream poll per interval whatever the page does
    for (let i = 0; i < 6; i++) {
      await fc.advance(5_000);
      await hub.snapshot("survival");
    }
    expect(s.calls.length).toBe(16);
    await fc.advance(30_000);
    expect(hub.stats().hubs.length).toBe(0);
  });

  test("cakeutils down from the start: null after the wait; the last good snapshot is kept for the next start", async () => {
    const { hub, s, fc } = hubWith();
    s.mode = "down";
    const p = hub.snapshot("survival");
    await fc.advance(3_000);
    expect(await p).toBeNull();
    await fc.advance(60_000);
    s.mode = "up";
    await hub.snapshot("survival");
    await fc.advance(60_000);
    expect(hub.stats().hubs.length).toBe(0);
    s.mode = "down";
    const p2 = hub.snapshot("survival");
    await fc.advance(3_000);
    const kept = await p2;
    expect(kept!.players.length).toBe(2);
    expect(kept!.state).toBe("offline");
    // a stream joining now sees the kept dots with a non-live status
    const { k } = sub(hub);
    expect(k.events("status")[0].state).toBe("offline");
    expect(k.events("players")[0].players.length).toBe(2);
  });

  test("stop() ends every stream and timer", async () => {
    const { hub, fc } = hubWith();
    const a = sub(hub, { world: "minecraft_overworld" });
    sub(hub, { ip: "10.0.0.2", server: "creative" });
    await fc.advance(1_000);
    hub.stop();
    expect(a.k.ended()).toBe(true);
    expect(hub.stats()).toEqual({ streams: 0, hubs: [] });
    expect(fc.pending()).toBe(0);
  });
});

// ---- what one client is (address.ts)

describe("addressKey", () => {
  test("IPv4 stays as it is; IPv6 becomes its /64; mapped IPv4 becomes IPv4", () => {
    expect(addressKey("203.0.113.7")).toBe("203.0.113.7");
    expect(addressKey(" 203.0.113.7 ")).toBe("203.0.113.7");
    expect(addressKey("2001:db8:1:2:3:4:5:6")).toBe("2001:db8:1:2::/64");
    expect(addressKey("2001:0DB8:0001:0002::1")).toBe("2001:db8:1:2::/64");
    expect(addressKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(addressKey("::1")).toBe("0:0:0:0::/64");
    expect(addressKey("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
    expect(addressKey("[2001:db8:1:2::1]")).toBe("2001:db8:1:2::/64");
    expect(addressKey("::ffff:192.0.2.1")).toBe("192.0.2.1");
    expect(addressKey("::ffff:c000:201")).toBe("192.0.2.1");
    expect(addressKey("64:ff9b::192.0.2.1")).toBe("64:ff9b:0:0::/64");
  });
  test("anything that is not an address is its own key, never an error", () => {
    expect(addressKey("unknown")).toBe("unknown");
    expect(addressKey("")).toBe("");
    expect(addressKey("1.2.3.999")).toBe("1.2.3.999");
    expect(addressKey("2001:db8:::1")).toBe("2001:db8:::1");
    expect(addressKey("1:2:3:4:5:6:7:8:9")).toBe("1:2:3:4:5:6:7:8:9");
    expect(addressKey("gggg::1")).toBe("gggg::1");
    expect(addressKey("::ffff:1.2.3.999")).toBe("::ffff:1.2.3.999");
  });
});
