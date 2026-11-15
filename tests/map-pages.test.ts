// FM-4: the map pages' pure parts (world order and pick, player groups, live merges) and the browser live client
// with a fake EventSource and fake timers.
import { describe, expect, test } from "bun:test";
import { groupPlayers, mergePlayers, pickWorld } from "../src/lib/map/pages.ts";
import { connectLive, MAX_FAILURES, POLL_MS } from "../src/lib/map/liveClient.ts";
import { mapHref, parseMapLink } from "../src/lib/map/links.ts";
import type { PlayerDot } from "../src/lib/map/types.ts";

const dot = (uuid: string, name: string, world = "minecraft_overworld", x = 0, z = 0): PlayerDot => ({ uuid, name, world, x, z, yaw: 0 });

describe("world pick", () => {
  test("pickWorld: the asked one, else the first", () => {
    const list = [{ id: "a" }, { id: "b" }];
    expect(pickWorld(list, "b")?.id).toBe("b");
    expect(pickWorld(list, "gone")?.id).toBe("a");
    expect(pickWorld(list, undefined)?.id).toBe("a");
    expect(pickWorld([], "a")).toBeUndefined();
  });
});

describe("players", () => {
  test("grouped by world, sorted by name", () => {
    const g = groupPlayers([dot("2", "bob"), dot("1", "Alice"), dot("3", "carl", "nether"), dot("4", "Abe", "nether")], "minecraft_overworld");
    expect(g.here.map((p) => p.name)).toEqual(["Alice", "bob"]);
    expect(g.elsewhere.map((p) => p.name)).toEqual(["Abe", "carl"]);
  });
  test("merge: replace, upsert, gone", () => {
    const a = dot("1", "a", "w", 1, 1);
    const b = dot("2", "b");
    expect(mergePlayers([a, b], { players: [dot("1", "a", "w", 9, 9)], gone: ["2"] }, false)).toEqual([dot("1", "a", "w", 9, 9)]);
    expect(mergePlayers([a, b], { players: [b], gone: [] }, true)).toEqual([b]);
  });
});

describe("share links round-trip", () => {
  test("mapHref then parseMapLink gives the view back", () => {
    const href = mapHref("survival", { world: "minecraft_the_nether", x: -120, z: 340, zoom: 2 });
    expect(href).toBe("/map/survival?world=minecraft_the_nether&x=-120&z=340&zoom=2");
    const link = parseMapLink(new URL(href, "https://fishnet.test"));
    expect(link).toEqual({ world: "minecraft_the_nether", x: -120, z: 340, zoom: 2 });
  });
  test("nonsense is left out, never an error", () => {
    expect(parseMapLink(new URL("https://x.test/map/a?world=../../etc&x=1.5&z=2&zoom=-3"))).toEqual({});
  });
});

// ---- the live client

class FakeES {
  static all: FakeES[] = [];
  readyState = 0;
  url: string;
  listeners = new Map<string, ((e: unknown) => void)[]>();
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeES.all.push(this);
  }
  addEventListener(n: string, f: (e: unknown) => void) {
    this.listeners.set(n, [...(this.listeners.get(n) ?? []), f]);
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
  emit(n: string, data?: unknown) {
    for (const f of this.listeners.get(n) ?? []) f({ data: typeof data === "string" ? data : JSON.stringify(data) });
  }
  fail() {
    this.readyState = 2;
    this.emit("error");
  }
}

function harness() {
  FakeES.all = [];
  const timers: { fn: () => void; ms: number; id: number }[] = [];
  let id = 0;
  const calls = { players: [] as PlayerDot[][], tiles: [] as unknown[], status: [] as string[], modes: [] as string[] };
  const fetched: string[] = [];
  const snapshot = { server: "s", at: 5, state: "live", players: [dot("9", "poll")] };
  const deps = {
    EventSource: FakeES as unknown as typeof EventSource,
    fetch: (async (u: string) => {
      fetched.push(u);
      return new Response(JSON.stringify(snapshot), { status: 200 });
    }) as unknown as typeof fetch,
    setTimeout: (fn: () => void, ms: number) => {
      timers.push({ fn, ms, id: ++id });
      return id;
    },
    clearTimeout: (t: unknown) => {
      const i = timers.findIndex((x) => x.id === t);
      if (i >= 0) timers.splice(i, 1);
    }
  };
  const conn = connectLive("s", "minecraft_overworld", { onPlayers: (p) => calls.players.push(p), onTiles: (e) => calls.tiles.push(e), onStatus: (s) => calls.status.push(s), onMode: (m) => calls.modes.push(m) }, deps);
  return { conn, calls, timers, fetched };
}

describe("liveClient", () => {
  test("opens the stream with the world, merges players, passes tiles and status", () => {
    const h = harness();
    const es = FakeES.all[0];
    expect(es.url).toBe("/map/s/live?world=minecraft_overworld");
    es.emit("open");
    es.emit("players", { at: 1, players: [dot("1", "a"), dot("2", "b")], gone: [] });
    es.emit("players", { at: 2, players: [dot("1", "a", "minecraft_overworld", 5, 5)], gone: ["2"] });
    expect(h.calls.players.at(-1)).toEqual([dot("1", "a", "minecraft_overworld", 5, 5)]);
    es.emit("tiles", { world: "minecraft_overworld", epoch: "e", tiles: [["e.1", 3, 0, 0]], reset: false });
    es.emit("status", { state: "stale", as_of: 7 });
    expect(h.calls.tiles).toHaveLength(1);
    expect(h.calls.status).toEqual(["stale"]);
    expect(h.calls.modes).toEqual(["stream"]);
  });
  test("bad frames are dropped, never thrown", () => {
    const h = harness();
    const es = FakeES.all[0];
    es.emit("players", "not json");
    es.emit("players", { players: "nope" });
    es.emit("players", { at: 1, players: [{ uuid: 1 }, dot("1", "ok")], gone: [3] });
    es.emit("tiles", { world: 3 });
    es.emit("status", { state: "weird" });
    expect(h.calls.players).toEqual([[dot("1", "ok")]]);
    expect(h.calls.tiles).toHaveLength(0);
    expect(h.calls.status).toHaveLength(0);
  });
  test("a reconnect starts from a full snapshot", () => {
    const h = harness();
    FakeES.all[0].emit("players", { at: 1, players: [dot("1", "a")], gone: [] });
    FakeES.all[0].fail();
    h.timers[0].fn();
    FakeES.all[1].emit("players", { at: 2, players: [dot("2", "b")], gone: [] });
    expect(h.calls.players.at(-1)).toEqual([dot("2", "b")]);
  });
  test("three closed streams in a row fall back to polling players.json every 5 s", async () => {
    const h = harness();
    for (let i = 0; i < MAX_FAILURES - 1; i++) {
      FakeES.all.at(-1)!.fail();
      h.timers.shift()!.fn();
    }
    FakeES.all.at(-1)!.fail();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(FakeES.all).toHaveLength(MAX_FAILURES);
    expect(h.fetched).toEqual(["/map/s/players.json"]);
    expect(h.calls.modes).toEqual(["poll"]);
    expect(h.calls.players.at(-1)).toEqual([dot("9", "poll")]);
    expect(h.timers.at(-1)?.ms).toBe(POLL_MS);
  });
  test("without EventSource it polls at once; close stops everything", async () => {
    FakeES.all = [];
    const timers: number[] = [];
    const fetched: string[] = [];
    const conn = connectLive("s", "w", { onPlayers: () => {} }, {
      EventSource: undefined,
      fetch: (async (u: string) => (fetched.push(u), new Response(JSON.stringify({ server: "s", at: 1, state: "live", players: [] })))) as unknown as typeof fetch,
      setTimeout: () => timers.push(1),
      clearTimeout: () => {}
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(fetched).toHaveLength(1);
    expect(timers).toHaveLength(1);
    conn.close();
  });
  test("close closes the stream", () => {
    const h = harness();
    h.conn.close();
    expect(FakeES.all[0].closed).toBe(true);
  });
});
