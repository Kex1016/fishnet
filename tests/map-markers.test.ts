// FMK-0: the markers contracts. The mock answers match cakeutils v2/map/MARKERS.md §3 (shape, headers, 404s, ETag and
// 304) with geometry that obeys §4; the map client keeps markers in the LRU under their own tier, revalidates with the
// ETag, never asks for a hidden server or a bad id, treats a 404 as "no markers here" and serves the last good list
// while cakeutils is down; markers.json answers the same and 404s before any call; the pure view helpers hold.
import { describe, expect, test } from "bun:test";
import { createCore, type CoreOptions } from "#lib/server/cakeutils/core.ts";
import { createMapClient } from "#lib/server/cakeutils/map.ts";
import { isMapPath, policyFor, swrMs, ttlMs } from "#lib/server/cakeutils/policy.ts";
import { handleMock } from "#lib/server/cakeutils/mock/handler.ts";
import { mockFetch, worldOf, type FetchLike, type World } from "#lib/server/cakeutils/mock/index.ts";
import { STAFF_MARKER_TITLES, bumpMarkers, poleOf, stairTriangle } from "#lib/server/cakeutils/mock/markers.ts";
import { ServerList } from "#lib/server/hidden-servers-list.ts";
import { HiddenList } from "#lib/server/hidden-list.ts";
import { markersResponse } from "#lib/server/map/markers.ts";
import { drawOrder, markerView, markerViews } from "#lib/map/markers/view.ts";
import type { MapMarker, MapMarkers } from "#lib/api/types.ts";

const MOCK = "http://mock.invalid";
const TOKEN = "cu_mock_mock";
const OW = "minecraft_overworld";
const MINI = "cakeutils_miniservers_skyblock-1_overworld";

async function raw(path: string, init: RequestInit = {}, scenario: "busy" | "fresh" = "busy") {
  return mockFetch(scenario)(`${MOCK}${path}`, { ...init, headers: { authorization: `Bearer ${TOKEN}`, ...(init.headers ?? {}) } });
}
const markersOf = async (server: string, world: string, scenario: "busy" | "fresh" = "busy") => (await (await raw(`/v2/map/${server}/worlds/${world}/markers`, {}, scenario)).json()) as MapMarkers;

type Seen = { path: string; inm: string | null };
/** A fetch over the mock (or a clone of its world) that records every request and can be turned off. */
function harness(o: { world?: World; scenario?: "busy" | "fresh"; core?: Partial<CoreOptions>; live?: string[]; owner?: string[] } = {}) {
  const inner: FetchLike = o.world ? (input, init) => handleMock(o.world!, new Request(input, init)) : mockFetch(o.scenario ?? "busy");
  const seen: Seen[] = [];
  const state = { down: false, t: 1_000_000 };
  const fetchImpl: FetchLike = (input, init) => {
    const u = new URL(String(input));
    seen.push({ path: u.pathname + u.search, inm: new Headers(init?.headers).get("if-none-match") });
    if (state.down) return Promise.reject(new Error("connection refused"));
    return inner(input, init);
  };
  const core = createCore({ baseUrl: MOCK, token: TOKEN, fetchImpl, log: () => {}, now: () => state.t, ...o.core });
  const m = createMapClient({
    core,
    now: () => state.t,
    hiddenLive: () => new ServerList(o.live ?? []),
    hiddenServers: () => new ServerList(o.owner ?? []),
    hiddenPlayers: () => new HiddenList([])
  });
  return { m, core, seen, state, markerCalls: () => seen.filter((s) => s.path.endsWith("/markers")) };
}

// ---- MARKERS §4 geometry, checked on every fixture marker

type Corner = [number, number];
function geometryProblems(m: MapMarker): string[] {
  const bad: string[] = [];
  if (m.kind === "point") {
    if (!m.point || m.bounds || m.polygon || m.label) bad.push("a point has point and nothing else");
    else if (JSON.stringify(m.bbox) !== JSON.stringify({ min_x: m.point.x, min_z: m.point.z, max_x: m.point.x + 1, max_z: m.point.z + 1 })) bad.push("a point's bbox is its block as corners");
    return bad;
  }
  const p = m.polygon as Corner[] | null;
  if (!p || m.point || !m.label) return ["an area or polygon has a polygon and a label and no point"];
  if (p.length < 4 || p.length > 4096) bad.push("4..4096 vertices");
  const n = p.length;
  for (let i = 0; i < n; i++) {
    const a = p[i];
    const b = p[(i + 1) % n];
    const c = p[(i + 2) % n];
    if (!a.every(Number.isInteger)) bad.push("integer corners");
    if (a[0] !== b[0] && a[1] !== b[1]) bad.push(`edge ${i} is not axis-aligned`);
    if (a[0] === b[0] && a[1] === b[1]) bad.push(`repeated vertex ${i}`);
    if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) bad.push(`collinear vertices at ${(i + 1) % n}`);
  }
  // counter-clockwise as drawn (x right, z down) = a negative shoelace sum over (x, z)
  let twice = 0;
  for (let i = 0; i < n; i++) twice += p[i][0] * p[(i + 1) % n][1] - p[(i + 1) % n][0] * p[i][1];
  if (!(twice < 0)) bad.push("not counter-clockwise as drawn");
  // starts at the lowest-z, then lowest-x corner
  const first = [...p].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
  if (p[0][0] !== first[0] || p[0][1] !== first[1]) bad.push("does not start at the lowest-z then lowest-x corner");
  // simple: no two edges cross or touch except neighbours at their shared vertex
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsTouch(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) bad.push(`edges ${i} and ${j} touch`);
    }
  }
  const xs = p.map((c) => c[0]);
  const zs = p.map((c) => c[1]);
  const box = { min_x: Math.min(...xs), min_z: Math.min(...zs), max_x: Math.max(...xs), max_z: Math.max(...zs) };
  if (JSON.stringify(m.bbox) !== JSON.stringify(box)) bad.push("bbox is the polygon's box");
  if (m.kind === "area") {
    const b = m.bounds;
    if (!b || JSON.stringify(m.polygon) !== JSON.stringify([[b.min_x, b.min_z], [b.min_x, b.max_z + 1], [b.max_x + 1, b.max_z + 1], [b.max_x + 1, b.min_z]])) bad.push("an area's polygon is its 4 corners (§3.2)");
    else {
      const w = b.max_x - b.min_x + 1;
      const d = b.max_z - b.min_z + 1;
      if (m.label!.x !== b.min_x + w / 2 || m.label!.z !== b.min_z + d / 2 || m.label!.r !== Math.min(w, d) / 2) bad.push("an area's label is its centre with r = min(w, d) / 2");
    }
  } else if (m.bounds) bad.push("a polygon has no bounds");
  const l = m.label;
  if (l.r < 0.5) bad.push("label r >= 0.5");
  if (!Number.isInteger(l.x * 1000) || !Number.isInteger(l.z * 1000) || !Number.isInteger(l.r * 1000)) bad.push("label has at most 3 decimals");
  return bad;
}

/** Do two axis-aligned segments share a point? */
function segmentsTouch(a: Corner, b: Corner, c: Corner, d: Corner): boolean {
  const lo = (u: number, v: number) => Math.min(u, v);
  const hi = (u: number, v: number) => Math.max(u, v);
  return lo(a[0], b[0]) <= hi(c[0], d[0]) && hi(a[0], b[0]) >= lo(c[0], d[0]) && lo(a[1], b[1]) <= hi(c[1], d[1]) && hi(a[1], b[1]) >= lo(c[1], d[1]);
}

/** Is the label point inside the polygon, not on its edge? */
function labelInside(m: MapMarker): boolean {
  const p = m.polygon as Corner[];
  let n = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, z1] = p[i];
    const [x2, z2] = p[(i + 1) % p.length];
    if (x1 === x2 && m.label!.x < x1 && m.label!.z >= Math.min(z1, z2) && m.label!.z < Math.max(z1, z2)) n++;
  }
  return n % 2 === 1;
}

const KEYS = ["bbox", "bounds", "color", "color_auto", "created_at", "id", "kind", "label", "point", "polygon", "revision", "subtitle", "title", "updated_at"];

describe("mock answers match MARKERS.md §3", () => {
  test("fresh: 200 with no markers anywhere, rev 0, every world a map lists; unknown servers and worlds stay 404", async () => {
    // fresh has no map server at all (the index is empty), so every per-server route is 404 like any other map route
    const res = await raw(`/v2/map/survival/worlds/${OW}/markers`, {}, "fresh");
    expect(res.status).toBe(404);
    expect(((await res.json()) as { type: string }).type).toBe("urn:cakeutils:problem:not_found");
  });

  test("busy: a world with markers answers 200, ordered by id, every field always present, exact keys", async () => {
    const res = await raw(`/v2/map/survival/worlds/${OW}/markers`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=30");
    const d = (await res.json()) as MapMarkers;
    expect(Object.keys(d).sort()).toEqual(["markers", "rev", "server", "world"]);
    expect(d.server).toBe("survival");
    expect(d.world).toBe(OW);
    expect(res.headers.get("etag")).toBe(`"m${d.rev}"`);
    expect(d.rev).toBeGreaterThan(0);
    expect(d.markers.map((m) => m.id)).toEqual([...d.markers.map((m) => m.id)].sort((a, b) => a - b));
    for (const m of d.markers) {
      expect(Object.keys(m).sort()).toEqual(KEYS);
      expect(["point", "area", "poly"]).toContain(m.kind);
      expect(m.title.length).toBeGreaterThanOrEqual(1);
      expect(m.title.length).toBeLessThanOrEqual(64);
      expect(m.title).not.toContain("\n");
      expect(m.subtitle === null || (m.subtitle.length >= 1 && m.subtitle.length <= 256 && m.subtitle.split("\n").length <= 4)).toBe(true);
      expect(m.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(typeof m.color_auto).toBe("boolean");
      expect(m.revision).toBeGreaterThanOrEqual(1);
      expect(m.updated_at).toBeGreaterThanOrEqual(m.created_at);
    }
  });

  test("a world without markers is 200 with markers: [] and rev 0 (the end of survival is mapped and empty)", async () => {
    const d = await markersOf("survival", "minecraft_the_end");
    expect(d).toEqual({ server: "survival", world: "minecraft_the_end", rev: 0, markers: [] });
    const res = await raw("/v2/map/creative/worlds/minecraft_overworld/markers");
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe('"m0"');
  });

  test("the busy overworld holds what FMK-0 promised", async () => {
    const d = await markersOf("survival", OW);
    const by = (k: string) => d.markers.filter((m) => m.kind === k);
    expect(by("point")).toHaveLength(3);
    expect(by("area").length).toBeGreaterThanOrEqual(4); // two rectangles, the tiny one, the long title
    const rect = d.markers.filter((m) => m.kind === "area" && m.bbox.max_x - m.bbox.min_x > 4);
    expect(rect.length).toBeGreaterThanOrEqual(2);
    expect(by("poly")).toHaveLength(1);
    // the zig-zag: a staircase edge means many vertices for a triangle
    expect((by("poly")[0].polygon ?? []).length).toBeGreaterThan(20);
    // a tiny area whose title never fits
    expect(d.markers.some((m) => m.kind === "area" && m.bbox.max_x - m.bbox.min_x <= 2 && m.bbox.max_z - m.bbox.min_z <= 2)).toBe(true);
    // a long title, a very light and a very dark colour, one generated colour, a subtitle of 4 lines
    expect(Math.max(...d.markers.map((m) => m.title.length))).toBeGreaterThanOrEqual(60);
    const lum = (c: string) => (parseInt(c.slice(1, 3), 16) + parseInt(c.slice(3, 5), 16) + parseInt(c.slice(5, 7), 16)) / 3;
    expect(d.markers.some((m) => lum(m.color) > 235)).toBe(true);
    expect(d.markers.some((m) => lum(m.color) < 30)).toBe(true);
    expect(d.markers.filter((m) => m.color_auto)).toHaveLength(1);
    expect(d.markers.some((m) => m.subtitle?.split("\n").length === 4)).toBe(true);
    // markup and colour codes stay literal characters
    expect(d.markers.some((m) => m.title === "<b>Shop</b> & §cRed")).toBe(true);
    // a small area inside a big one (draw order, FMK-2)
    const big = d.markers.find((m) => m.id === 4)!;
    const small = d.markers.find((m) => m.id === 5)!;
    expect(small.bbox.min_x >= big.bbox.min_x && small.bbox.max_x <= big.bbox.max_x && small.bbox.min_z >= big.bbox.min_z && small.bbox.max_z <= big.bbox.max_z).toBe(true);
    // the market is the 31 × 18 blocks of the brief's example
    expect([small.bbox.max_x - small.bbox.min_x, small.bbox.max_z - small.bbox.min_z]).toEqual([31, 18]);
  });

  test("the nether has one area, the public mini world one point", async () => {
    const nether = await markersOf("survival", "minecraft_the_nether");
    expect(nether.markers.map((m) => m.kind)).toEqual(["area"]);
    const mini = await markersOf("survival", MINI);
    expect(mini.markers.map((m) => m.kind)).toEqual(["point"]);
  });

  test("every marker obeys §4: corners counter-clockwise as drawn from the lowest-z then lowest-x corner, axis-aligned, no collinear vertices, simple", async () => {
    for (const [s, w] of [["survival", OW], ["survival", "minecraft_the_nether"], ["survival", MINI], ["staff", OW]] as const) {
      for (const m of (await markersOf(s, w)).markers) {
        expect({ id: m.id, problems: geometryProblems(m) }).toEqual({ id: m.id, problems: [] });
        if (m.label) expect({ id: m.id, inside: labelInside(m) }).toEqual({ id: m.id, inside: true });
      }
    }
  });

  test("the zig-zag polygon's label is the point farthest from every edge", async () => {
    const poly = (await markersOf("survival", OW)).markers.find((m) => m.kind === "poly")!;
    expect(poly.label).toEqual(poleOf(poly.polygon as Corner[]));
    // nothing on the 0.5 grid inside is farther from the edge than r (the scan found the best, ties to the lower z, then x)
    const r = poly.label!.r;
    expect(r).toBeGreaterThanOrEqual(3);
    expect(stairTriangle(0, 0, 3)).toEqual([[0, 0], [0, 3], [3, 3], [3, 2], [2, 2], [2, 1], [1, 1], [1, 0]]);
  });

  test("§3.3: an unknown server, an unannounced world and a standalone server are all the same 404", async () => {
    const bodies: string[] = [];
    for (const p of [`/v2/map/nope/worlds/${OW}/markers`, "/v2/map/survival/worlds/minecraft_nope/markers", `/v2/map/onesoul/worlds/${OW}/markers`, `/v2/map/survival/worlds/..%2Fx/markers`]) {
      const res = await raw(p);
      expect(res.status).toBe(404);
      expect(res.headers.get("etag")).toBeNull();
      const j = (await res.json()) as { type: string; status: number };
      expect(j.type).toBe("urn:cakeutils:problem:not_found");
      bodies.push(j.type);
    }
    expect(new Set(bodies).size).toBe(1);
  });

  test("§3.4: If-None-Match with the tag (or *) is 304 with the same ETag and Cache-Control and no body; another tag is 200", async () => {
    const first = await raw(`/v2/map/survival/worlds/${OW}/markers`);
    const etag = first.headers.get("etag")!;
    for (const inm of [etag, "*", `"m0", ${etag}`]) {
      const res = await raw(`/v2/map/survival/worlds/${OW}/markers`, { headers: { "if-none-match": inm } });
      expect(res.status).toBe(304);
      expect(res.headers.get("etag")).toBe(etag);
      expect(res.headers.get("cache-control")).toBe("private, max-age=30");
      expect(await res.text()).toBe("");
    }
    expect((await raw(`/v2/map/survival/worlds/${OW}/markers`, { headers: { "if-none-match": '"m1"' } })).status).toBe(200);
  });

  test("rev moves when a marker changes (bumpMarkers on a clone), and so does the ETag", async () => {
    const world = structuredClone(worldOf("busy"));
    const h = (inm?: string) => handleMock(world, new Request(`${MOCK}/v2/map/survival/worlds/${OW}/markers`, { headers: { authorization: `Bearer ${TOKEN}`, ...(inm ? { "if-none-match": inm } : {}) } }));
    const a = await h();
    const tag = a.headers.get("etag")!;
    expect((await h(tag)).status).toBe(304);
    const rev = bumpMarkers(world.map!.markers, "survival", OW, (l) => l.filter((m) => m.id !== 6));
    const b = await h(tag);
    expect(b.status).toBe(200);
    expect(b.headers.get("etag")).toBe(`"m${rev}"`);
    expect(((await b.json()) as MapMarkers).markers.some((m) => m.id === 6)).toBe(false);
  });

  test("the hidden server's markers are in the fixture so the site can prove it never shows them", async () => {
    const d = await markersOf("staff", OW);
    expect(d.markers.map((m) => m.title)).toEqual([...STAFF_MARKER_TITLES]);
  });
});

describe("policy: the map-markers tier", () => {
  const path = `/v2/map/survival/worlds/${OW}/markers`;
  test("30 s floor, 10 min while refreshing, last good served, counted in the map bucket", () => {
    const p = policyFor(path);
    expect(p.cls).toBe("map-markers");
    expect(p.floorMs).toBe(30_000);
    expect(p.swrMs).toBe(600_000);
    expect(p.staleOk).toBe(true);
    expect(isMapPath(path)).toBe(true);
    expect(ttlMs(p, "private, max-age=30")).toBe(30_000);
    expect(ttlMs(p, "private, max-age=5")).toBe(30_000);
    expect(swrMs(p, 30_000)).toBe(600_000);
  });
  test("its neighbours keep their tiers", () => {
    expect(policyFor(`/v2/map/survival/worlds/${OW}`).cls).toBe("map-world");
    expect(policyFor(`/v2/map/survival/worlds/${OW}/changes`).cls).toBe("map-direct");
    expect(policyFor("/v2/map").cls).toBe("live");
  });
});

describe("MapClient.markers", () => {
  test("returns the site's Result, in the LRU: a second call inside 30 s makes no request", async () => {
    const { m, seen, markerCalls } = harness();
    const a = await m.markers("survival", OW);
    expect(a.ok && a.data.markers.length).toBeGreaterThan(5);
    const b = await m.markers("survival", OW);
    expect(b.ok && b.data.rev).toBe(a.ok ? a.data.rev : -1);
    expect(markerCalls()).toHaveLength(1);
    expect(seen.every((s) => s.path.startsWith("/v2/map/"))).toBe(true);
  });

  test("past the floor it revalidates with the ETag and a 304 keeps the list (one request, no new body)", async () => {
    const { m, state, markerCalls } = harness();
    const a = await m.markers("survival", OW);
    expect(a.ok).toBe(true);
    state.t += 31_000;
    const b = await m.markers("survival", OW, { priority: "background" });
    expect(b.ok && !b.stale).toBe(true);
    const calls = markerCalls();
    expect(calls).toHaveLength(2);
    expect(calls[0].inm).toBeNull();
    expect(calls[1].inm).toBe(a.ok ? `"m${a.data.rev}"` : "");
    expect(b.ok && a.ok && b.data === a.data).toBe(true);
    expect(b.ok && b.asOf).toBe(state.t);
  });

  test("a changed world comes back whole with the new rev", async () => {
    const world = structuredClone(worldOf("busy"));
    const { m, state } = harness({ world });
    const a = await m.markers("survival", OW);
    bumpMarkers(world.map!.markers, "survival", OW, (l) => [...l, ...l.slice(0, 1).map((x) => ({ ...x, id: 99 }))]);
    state.t += 31_000;
    const b = await m.markers("survival", OW, { priority: "background" });
    expect(a.ok && b.ok && b.data.rev === a.data.rev + 1 && b.data.markers.some((x) => x.id === 99)).toBe(true);
  });

  test("a world with no markers is ok and empty (flagged empty), not a failure", async () => {
    const { m } = harness();
    const r = await m.markers("survival", "minecraft_the_end");
    expect(r.ok && r.data.markers).toEqual([]);
    expect(r.ok && r.empty).toBe(true);
  });

  test("404 is 'no markers here': not_found, remembered for 30 s so a refresh does not ask again, never down", async () => {
    const { m, state, markerCalls, core } = harness();
    const r = await m.markers("survival", "minecraft_nope");
    expect(!r.ok && r.kind).toBe("not_found");
    await m.markers("survival", "minecraft_nope");
    expect(markerCalls()).toHaveLength(1);
    state.t += 31_000;
    await m.markers("survival", "minecraft_nope");
    expect(markerCalls()).toHaveLength(2);
    expect(core.status().reachable).toBe(true);
  });

  test("a hidden server is refused before any call, so are bad ids; One Soul servers (the live hide list) too", async () => {
    const { m, seen } = harness({ live: ["staff", "onesoul"] });
    for (const [s, w] of [["staff", OW], ["onesoul", OW], ["survival", "../x"], ["survival", ""], ["survival", "UPPER"], ["surv/ival", OW], ["", OW], ["survival", "a".repeat(65)], ["survival", ".hidden"]] as const) {
      const r = await m.markers(s, w);
      expect({ s, w, kind: !r.ok && r.kind }).toEqual({ s, w, kind: "not_found" });
    }
    expect(seen).toHaveLength(0);
    expect((await m.markers("survival", OW)).ok).toBe(true);
    expect(seen).toHaveLength(1);
  });

  test("cakeutils down: the last good list with asOf and stale, up to 24 h; with nothing kept, down", async () => {
    const { m, state } = harness();
    const a = await m.markers("survival", OW);
    expect(a.ok).toBe(true);
    const asOf = a.ok ? a.asOf : 0;
    state.down = true;
    state.t += 11 * 60_000; // past the window in which a page is served the old list while it refreshes
    const b = await m.markers("survival", OW);
    expect(b.ok && b.stale).toBe(true);
    expect(b.ok && b.asOf).toBe(asOf);
    expect(b.ok && b.data.markers.length).toBe(a.ok ? a.data.markers.length : -1);
    state.t += 23 * 3_600_000;
    const c = await m.markers("survival", OW);
    expect(c.ok && c.stale).toBe(true);
    state.t += 2 * 3_600_000; // past 24 h
    const d = await m.markers("survival", OW);
    expect(!d.ok && d.kind).toBe("down");
    expect(!d.ok && d.asOf).toBe(asOf);
    const never = await m.markers("survival", "minecraft_the_nether");
    expect(!never.ok && never.kind).toBe("down");
  });

  test("a body that is not the contract's shape is down, never a crash", async () => {
    const fetchImpl: FetchLike = async () => new Response(JSON.stringify({ server: "survival", world: OW, rev: 1, markers: "nope" }), { headers: { "content-type": "application/json" } });
    const core = createCore({ baseUrl: MOCK, token: TOKEN, fetchImpl, log: () => {} });
    const m = createMapClient({ core, hiddenLive: () => new ServerList([]), hiddenServers: () => new ServerList([]), hiddenPlayers: () => new HiddenList([]) });
    const r = await m.markers("survival", OW);
    expect(!r.ok && r.kind).toBe("down");
  });
});

describe("markers.json", () => {
  const get = async (h: ReturnType<typeof harness>, server: string, world: string, inm: string | null = null) => markersResponse(h.m, server, world, inm);

  test("200 with cakeutils' shape, private max-age=15 and the ETag", async () => {
    const h = harness();
    const res = await get(h, "survival", OW);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=15");
    expect(res.headers.get("content-type")).toBe("application/json");
    const { uni, ...d } = (await res.json()) as MapMarkers & { uni: Record<string, unknown> };
    expect(res.headers.get("etag")).toBe(`"m${d.rev}"`);
    expect(d).toEqual(await markersOf("survival", OW)); // cakeutils' shape, untouched; `uni` is the site's own (FMK-2)
    expect(uni).toEqual({}); // every busy title is in the bitmap fonts
    expect(res.headers.get("x-stale")).toBeNull();
  });

  test("304 round trip: the tag from the first answer gets 304 with no body (and no second upstream call inside the floor)", async () => {
    const h = harness();
    const first = await get(h, "survival", OW);
    const tag = first.headers.get("etag")!;
    const again = await get(h, "survival", OW, tag);
    expect(again.status).toBe(304);
    expect(await again.text()).toBe("");
    expect(again.headers.get("etag")).toBe(tag);
    expect(again.headers.get("cache-control")).toBe("private, max-age=15");
    expect((await get(h, "survival", OW, `W/${tag}`)).status).toBe(304);
    expect((await get(h, "survival", OW, "*")).status).toBe(304);
    expect((await get(h, "survival", OW, '"m1"')).status).toBe(200);
    expect(h.markerCalls()).toHaveLength(1);
  });

  test("a changed world: the old tag gets the new list with the new tag", async () => {
    const world = structuredClone(worldOf("busy"));
    const h = harness({ world });
    const tag = (await get(h, "survival", OW)).headers.get("etag")!;
    bumpMarkers(world.map!.markers, "survival", OW);
    h.state.t += 11 * 60_000; // past the 10 min a page is served the old list while it refreshes
    const res = await get(h, "survival", OW, tag);
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).not.toBe(tag);
  });

  test("a bad world param is 404 with no upstream call, whatever the server", async () => {
    const h = harness();
    for (const w of ["", "UPPER", "a b", "../etc", "x".repeat(65), ".dot", "a..b", "a/b", "%2e%2e", "minecraft_overworld;x", "é"]) expect({ w, status: (await get(h, "survival", w)).status }).toEqual({ w, status: 404 });
    for (const s of ["", "a/b", "s".repeat(65), "sp ace"]) expect({ s, status: (await get(h, s, OW)).status }).toEqual({ s, status: 404 });
    expect(h.seen).toHaveLength(0);
  });

  test("a hidden server is 404 with no upstream call; so is an unknown world (after one call, remembered)", async () => {
    const h = harness({ live: ["staff"] });
    expect((await get(h, "staff", OW)).status).toBe(404);
    expect(h.seen).toHaveLength(0);
    expect((await get(h, "survival", "minecraft_nope")).status).toBe(404);
    expect((await get(h, "nope", OW)).status).toBe(404);
  });

  test("the hidden server's titles are in no answer the site gives", async () => {
    const h = harness({ live: ["staff"] });
    const texts: string[] = [];
    for (const [s, w] of [["staff", OW], ["survival", OW], ["survival", "minecraft_the_nether"], ["survival", MINI]] as const) texts.push(await (await get(h, s, w)).text());
    for (const t of STAFF_MARKER_TITLES) expect(texts.join("\n")).not.toContain(t);
  });

  test("cakeutils down: the last good list flagged stale with x-as-of and never a 304; with nothing kept, 503", async () => {
    const h = harness();
    const first = await get(h, "survival", OW);
    const tag = first.headers.get("etag")!;
    h.state.down = true;
    h.state.t += 11 * 60_000;
    const res = await get(h, "survival", OW, tag);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-stale")).toBe("1");
    expect(Number(res.headers.get("x-as-of"))).toBe(1_000_000);
    expect(res.headers.get("etag")).toBe(tag);
    expect(res.headers.get("cache-control")).toBe("private, max-age=5");
    const none = await get(h, "survival", "minecraft_the_nether");
    expect(none.status).toBe(503);
    expect(none.headers.get("retry-after")).toBeTruthy();
    expect(none.headers.get("cache-control")).toBe("no-store");
  });
});

describe("view helpers", () => {
  const rows = async () => (await markersOf("survival", OW)).markers;

  test("every fixture marker becomes a view; a point has its block and height, an area its corners, label and size", async () => {
    const list = await rows();
    const views = markerViews(list);
    expect(views).toHaveLength(list.length);
    const spawn = views.find((v) => v.id === 1)!;
    expect(spawn).toMatchObject({ kind: "point", point: { x: 64, y: 72, z: -32 }, polygon: null, label: null, size: { w: 1, d: 1 }, colorAuto: false });
    const market = views.find((v) => v.id === 5)!;
    expect(market.kind).toBe("area");
    expect(market.size).toEqual({ w: 31, d: 18 });
    expect(market.polygon).toEqual([[20, -60], [20, -42], [51, -42], [51, -60]]);
    expect(market.label).toEqual({ x: 35.5, z: -51, r: 9 });
    expect(market.bbox).toEqual({ minX: 20, minZ: -60, maxX: 51, maxZ: -42 });
    expect(views.find((v) => v.id === 2)!.colorAuto).toBe(true);
  });

  test("text passes through untouched: markup, colour codes and entities stay literal", async () => {
    const v = markerViews(await rows()).find((x) => x.id === 3)!;
    expect(v.title).toBe("<b>Shop</b> & §cRed");
    expect(v.subtitle).toBe("Prices in diamonds: 3 per stack & a smile");
  });

  test("draw order: points last, larger areas before smaller ones, ties by id", async () => {
    const order = drawOrder(markerViews(await rows())).map((v) => v.id);
    expect(order.indexOf(4)).toBeLessThan(order.indexOf(5));
    expect(order.indexOf(5)).toBeLessThan(order.indexOf(6));
    for (const p of [1, 2, 3]) for (const a of [4, 5, 6, 7, 8]) expect(order.indexOf(p)).toBeGreaterThan(order.indexOf(a));
    expect(order.slice(-3)).toEqual([1, 2, 3]);
  });

  test("rows the site cannot draw are left out, unknown kinds are drawn by their geometry, nothing throws", async () => {
    const [point, , , area] = await rows();
    const junk = [
      { ...point, id: 1000, bbox: null },
      { ...point, id: 1001, bbox: { min_x: 0, min_z: 0, max_x: 0, max_z: 1 } },
      { ...point, id: 1002, point: null, polygon: null },
      { ...area, id: 1003, polygon: [[0, 0], [1, 0]] },
      { ...area, id: 1004, polygon: [[0, 0], [0, 1], [1.5, 1], [1, 0]] },
      null,
      {},
      { ...point, id: 1005, kind: "hexagon" },
      { ...area, id: 1006, kind: "blob", color: "red", subtitle: "" },
      { ...point, id: 1007, title: 5 }
    ] as unknown as MapMarker[];
    const views = markerViews(junk);
    expect(views.map((v) => [v.id, v.kind])).toEqual([[1005, "point"], [1006, "poly"]]);
    expect(views[1].color).toBe("#808080");
    expect(views[1].subtitle).toBeNull();
    expect(markerView(null as unknown as MapMarker)).toBeNull();
  });
});
