// FM-0: the web map's contracts. The mock answers match cakeutils v2/MAP.md §5 (shapes, headers, errors), the
// map client (src/lib/server/cakeutils/map.ts) hides hidden servers, One Soul servers and hidden players on
// every call, uses its own bucket and keeps tiles, positions and change logs out of the LRU, and the pure
// helpers in src/lib/map/ hold their grammar.
import { describe, expect, test } from "bun:test";
import { createCore, type CoreOptions } from "#lib/server/cakeutils/core.ts";
import { createMapClient, type MapClient } from "#lib/server/cakeutils/map.ts";
import { isMapPath, policyFor } from "#lib/server/cakeutils/policy.ts";
import { mockFetch, worldOf, type FetchLike } from "#lib/server/cakeutils/mock/index.ts";
import { mockMapHidden, moverAt } from "#lib/server/cakeutils/mock/map.ts";
import { ServerList } from "#lib/server/hidden-servers-list.ts";
import { HiddenList, parseHiddenList } from "#lib/server/hidden-list.ts";
import { problemCode } from "#lib/api/result.ts";
import { mapHref, parseMapLink, parseTile, tilePath, roundTilePath, validTile, validWorldId } from "#lib/map/links.ts";
import { liveWorldView, tileOf, tileSpan } from "#lib/map/view.ts";

const MOCK = "http://mock.invalid";
const TOKEN = "cu_mock_mock";

/** A fetch over the mock that records every path it was asked for. */
function counting(scenario: "busy" | "fresh" = "busy") {
  const inner = mockFetch(scenario);
  const paths: string[] = [];
  const fetchImpl: FetchLike = (input, init) => {
    const u = new URL(String(input));
    paths.push(u.pathname + u.search);
    return inner(input, init);
  };
  return { fetchImpl, paths };
}

function client(o: { scenario?: "busy" | "fresh"; live?: string[]; owner?: string[]; players?: string[]; core?: Partial<CoreOptions> } = {}) {
  const { fetchImpl, paths } = counting(o.scenario);
  const core = createCore({ baseUrl: MOCK, token: TOKEN, fetchImpl, log: () => {}, ...o.core });
  const m = createMapClient({
    core,
    hiddenLive: () => new ServerList(o.live ?? []),
    hiddenServers: () => new ServerList(o.owner ?? []),
    hiddenPlayers: () => new HiddenList((o.players ?? []).map((p) => p.toLowerCase().replace(/-/g, "")))
  });
  return { m, core, paths };
}

/** The raw mock, for the shapes cakeutils sends (no client in between). */
async function raw(path: string, init: RequestInit = {}) {
  const res = await mockFetch("busy")(`${MOCK}${path}`, { ...init, headers: { authorization: `Bearer ${TOKEN}`, ...(init.headers ?? {}) } });
  return res;
}

const keys = (o: object) => Object.keys(o).sort();

describe("mock answers match MAP.md §5", () => {
  test("/v2/map: every field, ordered by server id, private max-age=15", async () => {
    const res = await raw("/v2/map");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=15");
    expect(res.headers.get("etag")).toBeTruthy();
    const d = (await res.json()) as { servers: Record<string, unknown>[] };
    expect(keys(d)).toEqual(["servers"]);
    const ids = d.servers.map((s) => s.server as string);
    expect(ids).toEqual([...ids].sort());
    for (const s of d.servers) {
      expect(keys(s)).toEqual(["announced_at", "changes", "display_name", "live_players", "online", "server", "worlds"]);
      for (const w of s.worlds as Record<string, unknown>[]) {
        expect(keys(w)).toEqual(["area", "dimension", "id", "mini", "name", "order"]);
        expect(validWorldId(w.id as string)).toBe(true);
        expect((w.mini === null) === (w.area === null)).toBe(true);
      }
    }
    // the One Soul server and the server without a map are never listed
    expect(ids).not.toContain("onesoul");
    expect(ids).not.toContain("lobby");
  });

  test("world settings: tile_size 512, zoom from 0, stale flag, private max-age=300", async () => {
    const res = await raw("/v2/map/survival/worlds/minecraft_overworld");
    expect(res.headers.get("cache-control")).toBe("private, max-age=300");
    const w = (await res.json()) as Record<string, unknown> & { zoom: Record<string, number> };
    expect(keys(w)).toEqual(["player_update_ms", "server", "spawn", "stale", "tile_size", "updated_at", "world", "zoom"]);
    expect(w.tile_size).toBe(512);
    expect(keys(w.zoom)).toEqual(["default", "extra", "max", "min"]);
    expect(w.zoom.min).toBe(0);
    expect(w.stale).toBe(false);
  });

  test("players: uuid dashed lower case, whole blocks, no y, private max-age=1", async () => {
    const res = await raw("/v2/map/survival/players");
    expect(res.headers.get("cache-control")).toBe("private, max-age=1");
    const d = (await res.json()) as { players: Record<string, unknown>[] } & Record<string, unknown>;
    expect(keys(d)).toEqual(["players", "server", "stale", "updated_at"]);
    expect(d.players.length).toBeGreaterThan(0);
    for (const p of d.players) {
      expect(keys(p)).toEqual(["name", "uuid", "world", "x", "yaw", "z"]);
      expect(p.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      for (const k of ["x", "z", "yaw"]) expect(Number.isInteger(p[k])).toBe(true);
    }
  });

  test("changes: epoch, seq, dropped, [seq, z, x, y] oldest first; 404 not_supported without a log", async () => {
    const res = await raw("/v2/map/survival/worlds/minecraft_overworld/changes");
    expect(res.headers.get("cache-control")).toBe("private, max-age=2");
    const c = (await res.json()) as { epoch: string; seq: number; dropped: number; tiles: number[][] } & Record<string, unknown>;
    expect(keys(c)).toEqual(["dropped", "epoch", "seq", "server", "tiles", "world"]);
    expect(typeof c.epoch).toBe("string");
    expect(c.tiles.every((r) => r.length === 4)).toBe(true);
    expect(c.tiles.map((r) => r[0])).toEqual([...c.tiles.map((r) => r[0])].sort((a, b) => a - b));
    expect(c.tiles.at(-1)![0]).toBe(c.seq);
    expect(c.dropped).toBeLessThan(c.tiles[0][0]);
    const none = await raw("/v2/map/survival/worlds/minecraft_the_nether/changes");
    expect(none.status).toBe(404);
    expect(((await none.json()) as { type: string }).type).toBe("urn:cakeutils:problem:not_supported");
  });

  test("tiles: PNG, public max-age=30 swr=600, ETag → 304, unrendered 404", async () => {
    const res = await raw("/v2/map/survival/tiles/minecraft_overworld/3/0_0.png");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("public, max-age=30, stale-while-revalidate=600");
    const png = new Uint8Array(await res.arrayBuffer());
    expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const etag = res.headers.get("etag")!;
    expect((await raw("/v2/map/survival/tiles/minecraft_overworld/3/0_0.png", { headers: { "if-none-match": etag } })).status).toBe(304);
    expect((await raw("/v2/map/survival/tiles/minecraft_overworld/3/2_0.png")).status).toBe(404);
    expect((await raw("/v2/map/survival/tiles/minecraft_overworld/0/-1_-1.png")).status).toBe(200);
    expect((await raw("/v2/map/survival/tiles/minecraft_overworld/3/00_0.png")).status).toBe(404); // not canonical
  });

  test("errors: 404 off for positions off, 404 for no map, One Soul and unknown worlds", async () => {
    const off = await raw("/v2/map/creative/players");
    expect(off.status).toBe(404);
    expect(((await off.json()) as { type: string }).type).toBe("urn:cakeutils:problem:off");
    for (const p of ["/v2/map/lobby/worlds/minecraft_overworld", "/v2/map/onesoul/players", "/v2/map/nope/players", "/v2/map/survival/worlds/minecraft_moon"]) {
      expect((await raw(p)).status).toBe(404);
    }
  });

  test("finished rounds: world settings and immutable-ish tiles", async () => {
    const w = await raw("/v2/onesoul/rounds/1/map/worlds/minecraft_overworld?server=onesoul");
    expect(w.status).toBe(200);
    expect(keys((await w.json()) as object)).toEqual(["cycle", "server", "spawn", "tile_size", "updated_at", "world", "zoom"]);
    const t = await raw("/v2/onesoul/rounds/1/map/tiles/minecraft_overworld/3/0_-1.png?server=onesoul");
    expect(t.status).toBe(200);
    expect(t.headers.get("cache-control")).toBe("public, max-age=86400");
    // a finished round has no live positions
    expect((await raw("/v2/onesoul/rounds/1/map/players?server=onesoul")).status).toBe(404);
  });

  test("the round in play (TH-31): explored tiles only, short caching, the living soul alone", async () => {
    const os = worldOf("busy").onesoul!;
    const souls = os.souls.filter((s) => s.cycle === 2);
    const playing = souls.find((s) => s.outcome === "playing")!;
    const w = await raw("/v2/onesoul/rounds/2/map/worlds/minecraft_overworld?server=onesoul");
    expect(w.status).toBe(200);
    expect(w.headers.get("cache-control")).toBe("private, max-age=15");
    // tiles: only near where a soul of the round has been; the same rendered area elsewhere is 404 (an unfound stronghold never shows)
    const near = (x: number, y: number) =>
      souls.some((s) => s.trail.some((t) => t.dim === "minecraft:overworld" && t.points.some(([, bx, , bz]) => bx + 256 >= x * 512 && bx - 256 < (x + 1) * 512 && bz + 256 >= y * 512 && bz - 256 < (y + 1) * 512)));
    let served = 0;
    for (const x of [-1, 0, 1]) {
      for (const y of [-1, 0, 1]) {
        const t = await raw(`/v2/onesoul/rounds/2/map/tiles/minecraft_overworld/3/${x}_${y}.png?server=onesoul`);
        expect(t.status).toBe(near(x, y) ? 200 : 404);
        if (t.status === 200) {
          served++;
          expect(t.headers.get("cache-control")).toBe("private, max-age=30");
        }
      }
    }
    expect(served).toBeGreaterThan(0);
    // players: the living soul only, whole blocks, in their world; nobody when they are offline
    const p = await raw("/v2/onesoul/rounds/2/map/players?server=onesoul");
    expect(p.status).toBe(200);
    expect(p.headers.get("cache-control")).toBe("private, max-age=1");
    const body = (await p.json()) as { cycle: number; players: { uuid: string; world: string; x: number; z: number }[] };
    expect(body.cycle).toBe(2);
    expect(body.players.map((x) => x.uuid)).toEqual([playing.uuid]);
    expect(body.players[0].world).toBe("minecraft_the_nether");
    expect(Number.isInteger(body.players[0].x) && Number.isInteger(body.players[0].z)).toBe(true);
    const was = os.current!.online;
    os.current!.online = false;
    try {
      expect(((await (await raw("/v2/onesoul/rounds/2/map/players?server=onesoul")).json()) as { players: unknown[] }).players).toEqual([]);
    } finally {
      os.current!.online = was;
    }
  });

  test("the round in play through the client: one well-formed soul or nobody, map-direct, in the map bucket", async () => {
    expect(policyFor("/v2/onesoul/rounds/2/map/players?server=onesoul").cls).toBe("map-direct");
    expect(isMapPath("/v2/onesoul/rounds/2/map/players?server=onesoul")).toBe(true);
    const { m } = client();
    const r = await m.roundMapPlayers(2, "onesoul");
    expect(r.ok && r.data.players.length === 1 && r.data.cycle === 2).toBe(true);
    // a hidden server, a bad cycle: not asked
    const hidden = client({ owner: ["onesoul"] });
    expect((await hidden.m.roundMapPlayers(2, "onesoul")).ok).toBe(false);
    expect(hidden.paths).toHaveLength(0);
    expect((await m.roundMapPlayers(0, "onesoul")).ok).toBe(false);
    // an answer with more than one entry or a bad one (a proxy bug): nobody is drawn
    const bad = (players: unknown[]) =>
      createMapClient({
        core: createCore({ baseUrl: MOCK, token: TOKEN, log: () => {}, fetchImpl: async () => new Response(JSON.stringify({ server: "onesoul", cycle: 2, players }), { headers: { "content-type": "application/json" } }) }),
        hiddenLive: () => new ServerList(),
        hiddenServers: () => new ServerList(),
        hiddenPlayers: () => new HiddenList()
      }).roundMapPlayers(2, "onesoul");
    const dot = { uuid: "11111111-1111-1111-1111-111111111111", name: "Alex", world: "minecraft_overworld", x: 1.4, z: -2.6, yaw: 90 };
    const one = await bad([dot]);
    expect(one.ok && one.data.players).toEqual([{ ...dot, x: 1, z: -3 }]);
    for (const list of [[dot, { ...dot, uuid: "22222222-2222-2222-2222-222222222222" }], [{ ...dot, world: "../x" }], [{ ...dot, x: "1" }], [{ ...dot, z: null }], [null]]) {
      const r2 = await bad(list);
      expect(r2.ok && r2.data.players).toEqual([]);
    }
  });

  test("fresh: no server has a map", async () => {
    const { m } = client({ scenario: "fresh" });
    const r = await m.mapServers();
    expect(r.ok && r.data.servers.length === 0 && r.empty).toBe(true);
    expect(await m.mapEnabled()).toBe(true);
    const w = await m.mapWorld("survival", "minecraft_overworld");
    expect(w.ok ? "ok" : w.kind).toBe("not_found");
  });

  test("players move: the same mover is somewhere else 5 s later", () => {
    const mv = worldOf("busy").map!.movers[0];
    const a = moverAt(mv, 1_000_000);
    const b = moverAt(mv, 1_005_000);
    expect(a.x !== b.x || a.z !== b.z).toBe(true);
  });
});

describe("the hide wrapper on every map call", () => {
  const hidden = mockMapHidden(worldOf("busy"));

  test("the busy fixtures carry a hidden server and a hidden player the raw API does send", async () => {
    expect(hidden.servers).toEqual(["staff"]);
    expect(hidden.players.length).toBe(1);
    const idx = (await (await raw("/v2/map")).json()) as { servers: { server: string }[] };
    expect(idx.servers.map((s) => s.server)).toContain("staff");
    const pl = (await (await raw("/v2/map/survival/players")).json()) as { players: { uuid: string }[] };
    expect(pl.players.map((p) => p.uuid)).toContain(hidden.players[0]);
  });

  test("mapServers drops hidden and One Soul servers", async () => {
    const { m } = client({ live: ["staff", "onesoul", "creative"] });
    const r = await m.mapServers();
    expect(r.ok && r.data.servers.map((s) => s.server)).toEqual(["survival"]);
  });

  test("every per-server call on a hidden server is not_found without asking cakeutils", async () => {
    const { m, paths } = client({ live: ["staff", "survival"] });
    const t = { z: 3, x: 0, y: 0 };
    for (const r of [
      await m.mapWorld("survival", "minecraft_overworld"),
      await m.mapTile("survival", "minecraft_overworld", t),
      await m.mapChanges("survival", "minecraft_overworld"),
      await m.mapPlayers("survival"),
      await m.mapPlayers("staff"),
      await m.mapWorld("staff", "minecraft_overworld")
    ])
      expect(r.ok ? "ok" : r.kind).toBe("not_found");
    expect(paths).toEqual([]);
  });

  test("hidden players leave every positions answer (by uuid or by name)", async () => {
    const byUuid = await client({ players: hidden.players }).m.mapPlayers("survival");
    expect(byUuid.ok && byUuid.data.players.some((p) => p.uuid === hidden.players[0])).toBe(false);
    expect(byUuid.ok && byUuid.data.players.length).toBeGreaterThan(0);
    const byName = await client({ players: ["koi_pond"] }).m.mapPlayers("survival");
    expect(byName.ok && byName.data.players.some((p) => p.name === "koi_pond")).toBe(false);
    // the real list file's parser feeds the same check
    const fromFile = createMapClient({ core: createCore({ baseUrl: MOCK, token: TOKEN, fetchImpl: mockFetch("busy") }), hiddenLive: () => new ServerList(), hiddenServers: () => new ServerList(), hiddenPlayers: () => parseHiddenList("# opted out\nquietgill\n") });
    const f = await fromFile.mapPlayers("survival");
    expect(f.ok && f.data.players.some((p) => p.name === "quietgill")).toBe(false);
  });

  test("round routes hide the owner's hidden servers, not One Soul ones", async () => {
    const shown = await client({ live: ["onesoul"] }).m.roundMapWorld(1, "minecraft_overworld", "onesoul");
    expect(shown.ok).toBe(true);
    const { m, paths } = client({ owner: ["onesoul"] });
    const r = await m.roundMapWorld(1, "minecraft_overworld", "onesoul");
    const t = await m.roundMapTile(1, "minecraft_overworld", { z: 3, x: 0, y: 0 }, "onesoul");
    expect([r.ok ? "ok" : r.kind, t.ok ? "ok" : t.kind]).toEqual(["not_found", "not_found"]);
    expect(paths).toEqual([]);
  });

  test("bad ids, zooms, coordinates and cycles never reach cakeutils", async () => {
    const { m, paths } = client();
    for (const r of [
      await m.mapWorld("survival", "../etc"),
      await m.mapWorld("survival", "Minecraft_Overworld"),
      await m.mapWorld("sur vival", "minecraft_overworld"),
      await m.mapTile("survival", "minecraft_overworld", { z: 16, x: 0, y: 0 }),
      await m.mapTile("survival", "minecraft_overworld", { z: 3, x: 0.5, y: 0 }),
      await m.mapTile("survival", "minecraft_overworld", { z: 3, x: 2 ** 25, y: 0 }),
      await m.roundMapWorld(0, "minecraft_overworld", "onesoul"),
      await m.roundMapWorld(1_000_000, "minecraft_overworld", "onesoul")
    ])
      expect(r.ok ? "ok" : r.kind).toBe("not_found");
    expect(paths).toEqual([]);
  });
});

describe("transport: tiers, map bucket, no LRU for live data", () => {
  test("policy tiers", () => {
    expect(policyFor("/v2/map").cls).toBe("live");
    expect(policyFor("/v2/map/survival/worlds/minecraft_overworld").cls).toBe("map-world");
    expect(policyFor("/v2/map/survival/worlds/minecraft_overworld").floorMs).toBe(300_000);
    expect(policyFor("/v2/map/survival/worlds/minecraft_overworld").swrMs).toBe(3_600_000);
    expect(policyFor("/v2/map/survival/worlds/minecraft_overworld/changes").cls).toBe("map-direct");
    expect(policyFor("/v2/map/survival/players").cls).toBe("map-direct");
    expect(policyFor("/v2/map/survival/tiles/minecraft_overworld/3/0_0.png").cls).toBe("map-direct");
    expect(policyFor("/v2/onesoul/rounds/1/map/worlds/minecraft_overworld?server=onesoul").cls).toBe("catalogue");
    expect(policyFor("/v2/onesoul/rounds/1/map/tiles/minecraft_overworld/3/0_0.png?server=onesoul").cls).toBe("map-direct");
    expect(policyFor("/v2/onesoul/rounds/1").cls).toBe("feed");
    expect(isMapPath("/v2/map")).toBe(true);
    expect(isMapPath("/v2/onesoul/rounds/1/map/worlds/x")).toBe(true);
    expect(isMapPath("/v2/onesoul/map")).toBe(false);
    expect(isMapPath("/v2/mapping")).toBe(false);
  });

  test("tiles, positions and changes are asked every time; the index and world settings are cached", async () => {
    const { m, paths } = client();
    await m.mapServers();
    await m.mapServers();
    await m.mapWorld("survival", "minecraft_overworld");
    await m.mapWorld("survival", "minecraft_overworld");
    expect(paths.length).toBe(2);
    await m.mapPlayers("survival");
    await m.mapPlayers("survival");
    await m.mapChanges("survival", "minecraft_overworld");
    await m.mapChanges("survival", "minecraft_overworld");
    await m.mapTile("survival", "minecraft_overworld", { z: 3, x: 0, y: 0 });
    await m.mapTile("survival", "minecraft_overworld", { z: 3, x: 0, y: 0 });
    expect(paths.length).toBe(8);
  });

  test("a tile with the copy's ETag comes back 304 without bytes", async () => {
    const { m } = client();
    const t = { z: 2, x: -1, y: 0 };
    const a = await m.mapTile("survival", "minecraft_overworld", t);
    if (!a.ok || a.data.notModified) throw new Error("tile");
    expect(a.data.png.byteLength).toBeGreaterThan(100);
    const b = await m.mapTile("survival", "minecraft_overworld", t, { etag: a.data.etag, priority: "background" });
    expect(b.ok && b.data.notModified && b.data.png === null).toBe(true);
  });

  test("the map bucket is its own: when it is empty, map calls wait or fail, pages do not", async () => {
    const { m } = client({ core: { ratePerMinute: 1, burst: 2 } });
    const t = (x: number) => m.mapTile("survival", "minecraft_overworld", { z: 3, x, y: 0 }, { waitMs: 0 });
    expect((await t(0)).ok).toBe(true);
    expect((await t(1)).ok).toBe(true);
    const third = await t(-1);
    expect(third.ok ? "ok" : third.kind).toBe("rate_limited");
    // the page client's core (a different bucket) is untouched
    const pages = createCore({ baseUrl: MOCK, token: TOKEN, fetchImpl: mockFetch("busy"), ratePerMinute: 1, burst: 2 });
    expect((await pages.get({ path: "/v2/network" }, "page")).ok).toBe(true);
  });

  test("503 map_offline is down for that server only; 501 is off; neither marks cakeutils unreachable", async () => {
    const logs: string[] = [];
    const fetchImpl: FetchLike = async (input) => {
      const p = new URL(String(input)).pathname;
      const problem = (status: number, code: string, extra: Record<string, string> = {}) =>
        new Response(JSON.stringify({ type: `urn:cakeutils:problem:${code}`, title: "x", status }), { status, headers: { "content-type": "application/problem+json", ...extra } });
      if (p.startsWith("/v2/map/down/")) return problem(503, "map_offline", { "retry-after": "5" });
      if (p.startsWith("/v2/map/old/")) return problem(501, "map_format_unsupported");
      return problem(404, "not_found");
    };
    const core = createCore({ baseUrl: MOCK, token: TOKEN, fetchImpl, log: (l) => logs.push(l) });
    const m = createMapClient({ core, hiddenLive: () => new ServerList(), hiddenServers: () => new ServerList(), hiddenPlayers: () => new HiddenList() });
    const down = await m.mapPlayers("down");
    expect(!down.ok && down.kind === "down" && down.retryAfter === 5 && problemCode(down) === "map_offline").toBe(true);
    const tile = await m.mapTile("down", "minecraft_overworld", { z: 3, x: 0, y: 0 });
    expect(tile.ok ? "ok" : tile.kind).toBe("down");
    const world = await m.mapWorld("old", "minecraft_overworld");
    expect(!world.ok && world.kind === "off" && problemCode(world) === "map_format_unsupported").toBe(true);
    expect(core.status().reachable).toBe(true);
    expect(logs).toEqual([]);
  });

  test("a proxy without the map, or a token without read:map, is off", async () => {
    const for404: FetchLike = async () => new Response(JSON.stringify({ type: "urn:cakeutils:problem:not_found", status: 404 }), { status: 404, headers: { "content-type": "application/problem+json" } });
    const for403: FetchLike = async () => new Response(JSON.stringify({ type: "urn:cakeutils:problem:forbidden", status: 403 }), { status: 403, headers: { "content-type": "application/problem+json" } });
    for (const fetchImpl of [for404, for403]) {
      const m = createMapClient({ core: createCore({ baseUrl: MOCK, token: TOKEN, fetchImpl, log: () => {} }), hiddenLive: () => new ServerList(), hiddenServers: () => new ServerList(), hiddenPlayers: () => new HiddenList() });
      const r = await m.mapServers();
      expect(r.ok ? "ok" : r.kind).toBe("off");
      expect(await m.mapEnabled()).toBe(false);
    }
  });
});

describe("links and views", () => {
  test("tile paths: canonical numbers only", () => {
    expect(parseTile("3", "0_-1.png")).toEqual({ z: 3, x: 0, y: -1 });
    for (const [z, f] of [["16", "0_0.png"], ["03", "0_0.png"], ["3", "+1_0.png"], ["3", "-0_0.png"], ["3", "0_0.jpg"], ["3", "1_2_3.png"], ["-1", "0_0.png"]]) expect(parseTile(z, f)).toBeNull();
    expect(validTile({ z: 3, x: 2 ** 24, y: -(2 ** 24) })).toBe(true);
    expect(validTile({ z: 3, x: 2 ** 24 + 1, y: 0 })).toBe(false);
    expect(tilePath("survival", "minecraft_overworld", { z: 3, x: -1, y: 0 }, "mock-1.42")).toBe("/map/t/survival/minecraft_overworld/3/-1_0.png?v=mock-1.42");
    expect(roundTilePath("onesoul", 1, "minecraft_the_nether", { z: 0, x: 0, y: 0 })).toBe("/map/t/onesoul/round/1/minecraft_the_nether/0/0_0.png");
  });

  test("world ids follow MAP §3.2", () => {
    for (const ok of ["minecraft_overworld", "minecraft_the_nether", "twilightforest_twilight_forest", "a.b-c"]) expect(validWorldId(ok)).toBe(true);
    for (const bad of ["", ".hidden", "trail.", "a..b", "Minecraft", "a/b", "a:b", "x".repeat(65)]) expect(validWorldId(bad)).toBe(false);
  });

  test("share links round-trip; junk is left out", () => {
    const href = mapHref("survival", { world: "minecraft_the_nether", x: 12.4, z: -88, zoom: 4, follow: "c478b64a-c578-47dd-a278-b324c378b4b7" });
    expect(href).toBe("/map/survival?world=minecraft_the_nether&x=12&z=-88&zoom=4&follow=c478b64a-c578-47dd-a278-b324c378b4b7");
    const u = new URL(`http://x${href}`);
    expect(parseMapLink(u)).toEqual({ world: "minecraft_the_nether", x: 12, z: -88, zoom: 4, follow: "c478b64a-c578-47dd-a278-b324c378b4b7" });
    expect(parseMapLink(new URL("http://x/map/s?world=../x&x=1&zoom=-2&follow=bob"))).toEqual({});
    expect(mapHref("survival")).toBe("/map/survival");
  });

  test("a world view from the answers; tile maths of MAP §5.2", async () => {
    const { m } = client();
    const idx = await m.mapServers();
    const s = idx.ok ? idx.data.servers.find((x) => x.server === "survival")! : null;
    const w = await m.mapWorld("survival", "minecraft_overworld");
    const c = await m.mapChanges("survival", "minecraft_overworld");
    if (!s || !w.ok || !c.ok) throw new Error("mock");
    const v = liveWorldView("survival", s.worlds[0], w.data, c.data);
    expect(v.tiles.template).toBe("/map/t/survival/minecraft_overworld/{z}/{x}_{y}.png");
    expect(v.tiles.epoch).toBe(c.data.epoch);
    const last = c.data.tiles.at(-1)!;
    expect(v.tiles.versions[`${last[1]}/${last[2]}/${last[3]}`]).toBe(last[0]);
    expect(tileSpan(3, 3)).toBe(512);
    expect(tileSpan(3, 0)).toBe(4096);
    expect(tileOf(3, 3, { x: -1, z: 511 })).toEqual({ z: 3, x: -1, y: 0 });
    expect(tileOf(3, 1, { x: 2048, z: -2049 })).toEqual({ z: 1, x: 1, y: -2 });
  });
});

describe("the token stays on the server", () => {
  test("no map answer or failure carries the token", async () => {
    const secret = "cu_fishnet_S3CRETs3cret";
    const { fetchImpl } = counting();
    const m = createMapClient({ core: createCore({ baseUrl: MOCK, token: secret, fetchImpl, log: () => {} }), hiddenLive: () => new ServerList(), hiddenServers: () => new ServerList(), hiddenPlayers: () => new HiddenList() });
    const all = [
      await m.mapServers(),
      await m.mapWorld("survival", "minecraft_overworld"),
      await m.mapPlayers("survival"),
      await m.mapPlayers("creative"),
      await m.mapChanges("survival", "minecraft_overworld"),
      await m.roundMapWorld(2, "minecraft_overworld", "onesoul")
    ];
    expect(JSON.stringify(all)).not.toContain("S3CRET");
  });
});
