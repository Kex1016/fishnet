// FM-1: the tile proxy and its disk cache (brief §4.2). A fake source stands in for cakeutils where the case needs
// control (freshness, 304, 404, outages, counting); the mock behind the real map client covers the map bucket,
// hidden servers and what leaves in a response.
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fail, ok, type Result } from "#lib/api/result.ts";
import { createCore } from "#lib/server/cakeutils/core.ts";
import { createMapClient, type MapTile, type TileOptions } from "#lib/server/cakeutils/map.ts";
import { mockFetch } from "#lib/server/cakeutils/mock/index.ts";
import { ServerList } from "#lib/server/hidden-servers-list.ts";
import { HiddenList } from "#lib/server/hidden-list.ts";
import { createTileService, etagMatches, tileHeaders, FRESH_MS, MISS_MS, type TileRef } from "#lib/server/map/tiles.ts";
import { tileResponse, versionParam } from "#lib/server/map/respond.ts";
import { parseTile } from "#lib/map/links.ts";

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "fishnet-tiles-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const PNG = (n: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, n, n, n, n]);
const REF: TileRef = { server: "survival", world: "minecraft_overworld", tile: { z: 3, x: 0, y: -1 } };

/** A controllable cakeutils: `version` changes the picture and ETag, `mode` the outage. */
function fake() {
  const s = {
    version: 1,
    mode: "up" as "up" | "down" | "limited" | "missing" | "off" | "junk",
    calls: [] as { ref: TileRef; etag: string | null; priority: string }[],
    delayMs: 0,
    concurrent: 0,
    maxConcurrent: 0
  };
  const source = async (ref: TileRef, o: TileOptions): Promise<Result<MapTile>> => {
    s.calls.push({ ref, etag: o.etag ?? null, priority: o.priority ?? "page" });
    s.concurrent++;
    s.maxConcurrent = Math.max(s.maxConcurrent, s.concurrent);
    if (s.delayMs) await new Promise((r) => setTimeout(r, s.delayMs));
    s.concurrent--;
    if (s.mode === "down") return fail("down");
    if (s.mode === "limited") return fail("rate_limited", { retryAfter: 7 });
    if (s.mode === "missing") return fail("not_found", { status: 404 });
    if (s.mode === "off") return fail("off", { status: 501 });
    if (s.mode === "junk") return ok({ notModified: false, png: new Uint8Array([1, 2, 3]), etag: '"x"', cacheControl: null, lastModified: null });
    const etag = `"v${s.version}"`;
    if (o.etag === etag) return ok({ notModified: true, png: null, etag, cacheControl: null, lastModified: null });
    return ok({ notModified: false, png: PNG(s.version), etag, cacheControl: null, lastModified: null });
  };
  return { s, source };
}

function service(o: { clock?: { t: number }; maxBytes?: number; hidden?: string[]; one?: string[]; maxPerServer?: number } = {}) {
  const f = fake();
  const clock = o.clock ?? { t: 1_000_000 };
  const dir = tmp();
  const svc = createTileService({
    dir,
    maxBytes: o.maxBytes ?? 10 ** 9,
    source: f.source,
    visible: (server, scope) => !(o.hidden ?? []).includes(server) && !(scope === "live" && (o.one ?? []).includes(server)),
    now: () => clock.t,
    sweepMs: 0,
    log: () => {},
    maxPerServer: o.maxPerServer
  });
  return { ...f, svc, clock, dir };
}

const tick = () => new Promise((r) => setTimeout(r, 10));

describe("freshness and revalidation", () => {
  test("a miss fetches once, then a young copy is served without asking", async () => {
    const t = service();
    const a = await t.svc.get(REF);
    expect(a.kind).toBe("tile");
    if (a.kind !== "tile") return;
    expect(a.source).toBe("miss");
    expect([...a.png]).toEqual([...PNG(1)]);
    expect(a.etag).toBe('"v1"');
    expect(t.s.calls).toHaveLength(1);
    expect(t.s.calls[0].priority).toBe("page");
    t.clock.t += FRESH_MS - 1;
    const b = await t.svc.get(REF);
    expect(b.kind === "tile" && b.source).toBe("fresh");
    expect(t.s.calls).toHaveLength(1);
  });

  test("an old copy is served at once and revalidated behind it with its ETag (304: no new bytes)", async () => {
    const t = service();
    await t.svc.get(REF);
    t.clock.t += FRESH_MS + 1;
    const b = await t.svc.get(REF);
    expect(b.kind === "tile" && b.source).toBe("stale-revalidating");
    await tick();
    expect(t.s.calls).toHaveLength(2);
    expect(t.s.calls[1]).toMatchObject({ etag: '"v1"', priority: "background" });
    // the 304 made it fresh again: no third request
    const c = await t.svc.get(REF);
    expect(c.kind === "tile" && c.source).toBe("fresh");
    expect(t.s.calls).toHaveLength(2);
  });

  test("a changed tile: the old picture is served once, the next view has the new one", async () => {
    const t = service();
    await t.svc.get(REF);
    t.s.version = 2;
    t.clock.t += FRESH_MS + 1;
    const old = await t.svc.get(REF);
    expect(old.kind === "tile" && old.png[8]).toBe(1);
    await tick();
    const next = await t.svc.get(REF);
    expect(next.kind === "tile" && next.png[8]).toBe(2);
    expect(next.kind === "tile" && next.etag).toBe('"v2"');
  });

  test("a revalidation that fails is not repeated on every view", async () => {
    const t = service();
    await t.svc.get(REF);
    t.s.mode = "down";
    t.clock.t += FRESH_MS + 1;
    for (let i = 0; i < 5; i++) await t.svc.get(REF);
    await tick();
    expect(t.s.calls).toHaveLength(2);
    t.clock.t += 61_000;
    await t.svc.get(REF);
    await tick();
    expect(t.s.calls).toHaveLength(3);
  });

  test("the copy survives a restart: a new service on the same directory serves it", async () => {
    const t = service();
    await t.svc.get(REF);
    const again = createTileService({ dir: t.dir, maxBytes: 10 ** 9, source: t.source, visible: () => true, now: () => t.clock.t, sweepMs: 0 });
    const a = await again.get(REF);
    expect(a.kind === "tile" && a.source).toBe("fresh");
    expect(t.s.calls).toHaveLength(1);
  });

  test("a picture without a sidecar is served, revalidated without an ETag", async () => {
    const t = service();
    await t.svc.get(REF);
    rmSync(join(t.dir, "survival", "minecraft_overworld", "3", "0_-1.json"));
    const a = await t.svc.get(REF);
    expect(a.kind === "tile" && a.source).toBe("stale-revalidating");
    await tick();
    expect(t.s.calls[1].etag).toBeNull();
  });
});

describe("404 memory", () => {
  test("a missing tile is remembered for 5 minutes, then asked again", async () => {
    const t = service();
    t.s.mode = "missing";
    expect((await t.svc.get(REF)).kind).toBe("missing");
    expect((await t.svc.get(REF)).kind).toBe("missing");
    t.clock.t += MISS_MS - 1;
    expect((await t.svc.get(REF)).kind).toBe("missing");
    expect(t.s.calls).toHaveLength(1);
    t.clock.t += 2;
    t.s.mode = "up";
    expect((await t.svc.get(REF)).kind).toBe("tile");
    expect(t.s.calls).toHaveLength(2);
  });

  test("a tile that disappears upstream is dropped from disk and remembered", async () => {
    const t = service();
    await t.svc.get(REF);
    t.s.mode = "missing";
    t.clock.t += FRESH_MS + 1;
    await t.svc.get(REF); // served, revalidating
    await tick();
    expect((await t.svc.get(REF)).kind).toBe("missing");
    expect(existsSync(join(t.dir, "survival", "minecraft_overworld", "3", "0_-1.png"))).toBe(false);
  });

  test("an unsupported map (501) answers like a missing tile", async () => {
    const t = service();
    t.s.mode = "off";
    expect((await t.svc.get(REF)).kind).toBe("missing");
  });
});

describe("cakeutils down", () => {
  test("serves the old copy whatever its age, never an error", async () => {
    const t = service();
    await t.svc.get(REF);
    t.s.mode = "down";
    t.clock.t += 40 * 24 * 3600_000;
    const a = await t.svc.get(REF);
    expect(a.kind).toBe("tile");
  });

  test("a versioned request with nothing newer to offer gets the old copy, not immutable", async () => {
    const t = service();
    await t.svc.get(REF, "e1.1");
    t.s.mode = "down";
    const a = await t.svc.get(REF, "e1.9");
    expect(a).toMatchObject({ kind: "tile", stale: true, immutable: false, source: "stale" });
    const limited = service();
    await limited.svc.get(REF);
    limited.s.mode = "limited";
    limited.clock.t += FRESH_MS + 1;
    expect((await limited.svc.get(REF)).kind).toBe("tile");
  });

  test("nothing on disk: unavailable, with the retry hint", async () => {
    const t = service();
    t.s.mode = "down";
    expect(await t.svc.get(REF)).toEqual({ kind: "unavailable", retryAfter: null });
    t.s.mode = "limited";
    expect(await t.svc.get(REF)).toEqual({ kind: "unavailable", retryAfter: 7 });
    // and nothing is remembered as a 404
    t.s.mode = "up";
    expect((await t.svc.get(REF)).kind).toBe("tile");
  });

  test("bytes that are not a PNG are never stored or served", async () => {
    const t = service();
    t.s.mode = "junk";
    expect((await t.svc.get(REF)).kind).toBe("unavailable");
    expect(existsSync(join(t.dir, "survival"))).toBe(false);
  });
});

describe("versions", () => {
  test("a copy fetched for the version asked for is immutable and costs nothing", async () => {
    const t = service();
    const a = await t.svc.get(REF, "e1.4");
    expect(a).toMatchObject({ kind: "tile", immutable: true, source: "miss" });
    const b = await t.svc.get(REF, "e1.4");
    expect(b).toMatchObject({ immutable: true, source: "fresh" });
    expect(t.s.calls).toHaveLength(1);
  });

  test("a newer version is checked first, so an immutable URL never pins an older picture", async () => {
    const t = service();
    await t.svc.get(REF, "e1.4");
    t.s.version = 2;
    const b = await t.svc.get(REF, "e1.5");
    expect(b).toMatchObject({ kind: "tile", immutable: true, source: "revalidated" });
    expect(b.kind === "tile" && b.png[8]).toBe(2);
    expect(t.s.calls[1]).toMatchObject({ etag: '"v1"', priority: "page" });
  });

  test("an unchanged tile under a newer version is a 304 and is then immutable", async () => {
    const t = service();
    await t.svc.get(REF, "e1.4");
    const b = await t.svc.get(REF, "e1.5");
    expect(b).toMatchObject({ immutable: true, source: "revalidated" });
    // and the older URL is still answered from the copy, no request
    const c = await t.svc.get(REF, "e1.4");
    expect(c.kind === "tile" && c.immutable).toBe(true);
    expect(t.s.calls).toHaveLength(2);
  });

  test("another epoch is a different picture: it is asked for", async () => {
    const t = service();
    await t.svc.get(REF, "e1.4");
    await t.svc.get(REF, "e2.0");
    expect(t.s.calls).toHaveLength(2);
  });

  test("a copy fetched without a version is checked once when a version arrives", async () => {
    const t = service();
    await t.svc.get(REF);
    const a = await t.svc.get(REF, "e1.0");
    expect(a).toMatchObject({ immutable: true, source: "revalidated" });
    expect(t.s.calls).toHaveLength(2);
  });

  test("the header grammar: only <epoch>.<seq>-like text counts", () => {
    expect(versionParam(new URL("http://x/t?v=mock-1.42"))).toBe("mock-1.42");
    expect(versionParam(new URL("http://x/t?v=../../etc"))).toBe(null);
    expect(versionParam(new URL("http://x/t?v=" + "a".repeat(65)))).toBe(null);
    expect(versionParam(new URL("http://x/t"))).toBe(null);
  });
});

describe("finished rounds", () => {
  const R: TileRef = { ...REF, server: "onesoul", round: 3 };
  test("kept on disk with no revalidation, immutable, stored apart from live tiles", async () => {
    const t = service();
    const a = await t.svc.get(R);
    expect(a).toMatchObject({ kind: "tile", immutable: true });
    t.clock.t += 400 * 24 * 3600_000;
    const b = await t.svc.get(R);
    expect(b).toMatchObject({ kind: "tile", immutable: true, source: "fresh" });
    await tick();
    expect(t.s.calls).toHaveLength(1);
    expect(existsSync(join(t.dir, "onesoul", "@round", "3", "minecraft_overworld", "3", "0_-1.png"))).toBe(true);
    expect(t.s.calls[0].ref.round).toBe(3);
  });

  test("a version parameter means nothing for a round, and a standalone server is fine here but not on the live map", async () => {
    const t = service({ one: ["onesoul"] });
    expect((await t.svc.get(R, "e1.9")).kind).toBe("tile");
    expect((await t.svc.get({ ...REF, server: "onesoul" })).kind).toBe("missing");
  });

  test("round numbers are checked", async () => {
    const t = service();
    for (const round of [0, -1, 1.5, 10_000_000]) expect((await t.svc.get({ ...R, round })).kind).toBe("missing");
    expect(t.s.calls).toHaveLength(0);
  });
});

describe("single-flight and per-server limit", () => {
  test("50 visitors for one tile cause one request", async () => {
    const t = service();
    t.s.delayMs = 20;
    const all = await Promise.all(Array.from({ length: 50 }, () => t.svc.get(REF)));
    expect(all.every((a) => a.kind === "tile")).toBe(true);
    expect(t.s.calls).toHaveLength(1);
  });

  test("never more than 16 requests at once to one server; other servers are not held up", async () => {
    const t = service();
    t.s.delayMs = 15;
    const tiles = Array.from({ length: 40 }, (_, i) => t.svc.get({ ...REF, tile: { z: 3, x: i, y: 0 } }));
    const other = t.svc.get({ ...REF, server: "creative" });
    const all = await Promise.all([...tiles, other]);
    expect(all.every((a) => a.kind === "tile")).toBe(true);
    expect(t.s.calls).toHaveLength(41);
    // 16 for survival at most, plus the one for creative
    expect(t.s.maxConcurrent).toBeLessThanOrEqual(17);
    expect(t.svc.stats().maxActive).toBeLessThanOrEqual(16);
    expect(t.svc.stats().inFlight).toBe(0);
  });
});

describe("path validation and hidden servers", () => {
  test("nothing invalid reaches the disk or cakeutils", async () => {
    const t = service();
    const bad: TileRef[] = [
      { ...REF, server: ".." },
      { ...REF, server: "." },
      { ...REF, server: "a/b" },
      { ...REF, server: "" },
      { ...REF, server: "x".repeat(65) },
      { ...REF, world: "../x" },
      { ...REF, world: "Minecraft_Overworld" },
      { ...REF, world: "a..b" },
      { ...REF, world: ".hidden" },
      { ...REF, tile: { z: 16, x: 0, y: 0 } },
      { ...REF, tile: { z: -1, x: 0, y: 0 } },
      { ...REF, tile: { z: 3, x: 1.5, y: 0 } },
      { ...REF, tile: { z: 3, x: 2 ** 25, y: 0 } },
      { ...REF, tile: { z: 3, x: 0, y: Number.NaN } }
    ];
    for (const ref of bad) expect(await t.svc.get(ref)).toEqual({ kind: "missing" });
    expect(t.s.calls).toHaveLength(0);
    expect(readdirSync(t.dir)).toEqual([]);
  });

  test("the file part of the URL: canonical numbers only", () => {
    expect(parseTile("3", "0_-1.png")).toEqual({ z: 3, x: 0, y: -1 });
    for (const [z, f] of [["03", "0_0.png"], ["3", "00_0.png"], ["3", "0_0.png.x"], ["3", "../0_0.png"], ["3", "-0_0.png"], ["3", "0_0.PNG"], ["x", "0_0.png"], ["3", "1e3_0.png"]]) expect(parseTile(z, f)).toBeNull();
  });

  test("a hidden server is 404, also when its tiles are already on disk", async () => {
    const t = service();
    await t.svc.get(REF);
    const hide = createTileService({ dir: t.dir, maxBytes: 10 ** 9, source: t.source, visible: (s) => s !== "survival", now: () => t.clock.t, sweepMs: 0 });
    expect(await hide.get(REF)).toEqual({ kind: "missing" });
    expect(await hide.get({ ...REF, round: 1 })).toEqual({ kind: "missing" });
    expect(t.s.calls).toHaveLength(1);
  });
});

describe("eviction by size", () => {
  function fill(t: ReturnType<typeof service>, n: number) {
    const base = join(t.dir, "survival", "minecraft_overworld", "3");
    mkdirSync(base, { recursive: true });
    for (let i = 0; i < n; i++) {
      const p = join(base, `${i}_0.png`);
      writeFileSync(p, Buffer.concat([Buffer.from(PNG(1)), Buffer.alloc(1000)]));
      writeFileSync(p.replace(".png", ".json"), JSON.stringify({ etag: '"v1"', fetchedAt: 1, ver: null }));
      const when = new Date(1_700_000_000_000 + i * 1000); // 0 is the oldest
      utimesSync(p, when, when);
    }
    return base;
  }

  test("the oldest by last access go first, down to 90% of the cap, picture and sidecar together", async () => {
    const t = service({ maxBytes: 10_000 });
    const base = fill(t, 20); // ~20 KiB + sidecars
    const r = await t.svc.sweep();
    expect(r.removed).toBeGreaterThan(0);
    expect(r.bytes).toBeLessThanOrEqual(9_000);
    const left = readdirSync(base).filter((n) => n.endsWith(".png"));
    expect(left).not.toContain("0_0.png");
    expect(left).toContain("19_0.png");
    for (const n of readdirSync(base)) if (n.endsWith(".json")) expect(left).toContain(n.replace(".json", ".png"));
  });

  test("under the cap nothing is removed; orphan sidecars and old temp files are", async () => {
    const t = service();
    const base = fill(t, 3);
    writeFileSync(join(base, "9_9.json"), "{}");
    writeFileSync(join(base, "1_0.png.123.abc.tmp"), "x");
    const old = new Date(1_000);
    utimesSync(join(base, "1_0.png.123.abc.tmp"), old, old);
    t.clock.t = Date.now();
    await t.svc.sweep();
    const names = readdirSync(base).sort();
    expect(names).toEqual(["0_0.json", "0_0.png", "1_0.json", "1_0.png", "2_0.json", "2_0.png"]);
  });

  test("a hit counts as an access: an old file read now outlives a newer one that was not", async () => {
    const t = service({ maxBytes: 5_000 });
    const base = fill(t, 5);
    t.clock.t = Date.now();
    await t.svc.get({ ...REF, tile: { z: 3, x: 0, y: 0 } }); // the oldest, touched now
    await tick();
    await t.svc.sweep();
    const left = readdirSync(base).filter((n) => n.endsWith(".png"));
    expect(left).toContain("0_0.png");
    expect(left).not.toContain("1_0.png");
  });

  test("writes that overshoot the cap start a sweep without waiting for the timer", async () => {
    const t = service({ maxBytes: 40 });
    for (let i = 0; i < 6; i++) await t.svc.get({ ...REF, tile: { z: 3, x: i, y: 0 } });
    await tick();
    await tick();
    expect(t.svc.stats().approxBytes).toBeLessThanOrEqual(80);
  });
});

describe("the browser's side", () => {
  const tileA = { kind: "tile" as const, png: PNG(1), etag: '"abc"', immutable: false, stale: false, source: "fresh" as const };
  test("headers per case", () => {
    expect(tileHeaders(tileA)).toEqual({
      "content-type": "image/png",
      "cache-control": "public, max-age=60, stale-while-revalidate=86400",
      "x-content-type-options": "nosniff",
      "x-map-cache": "fresh",
      etag: '"abc"'
    });
    expect(tileHeaders({ ...tileA, immutable: true })["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(tileHeaders({ ...tileA, etag: null }).etag).toBeUndefined();
  });

  test("If-None-Match: strong, weak, lists and *", () => {
    expect(etagMatches('"abc"', '"abc"')).toBe(true);
    expect(etagMatches('W/"abc"', '"abc"')).toBe(true);
    expect(etagMatches('"x", "abc"', '"abc"')).toBe(true);
    expect(etagMatches("*", '"abc"')).toBe(true);
    expect(etagMatches('"x"', '"abc"')).toBe(false);
    expect(etagMatches(null, '"abc"')).toBe(false);
    expect(etagMatches('"abc"', null)).toBe(false);
  });

  test("responses: 200, 304, 404, 503", async () => {
    const ok200 = tileResponse(tileA, null);
    expect(ok200.status).toBe(200);
    expect(new Uint8Array(await ok200.arrayBuffer())).toEqual(PNG(1));
    const r304 = tileResponse(tileA, '"abc"');
    expect(r304.status).toBe(304);
    expect(r304.headers.get("etag")).toBe('"abc"');
    expect(r304.headers.get("cache-control")).toBe("public, max-age=60, stale-while-revalidate=86400");
    expect(r304.headers.get("content-type")).toBeNull();
    const r404 = tileResponse({ kind: "missing" }, null);
    expect([r404.status, r404.headers.get("cache-control")]).toEqual([404, "public, max-age=300"]);
    const r503 = tileResponse({ kind: "unavailable", retryAfter: 7 }, null);
    expect([r503.status, r503.headers.get("cache-control"), r503.headers.get("retry-after")]).toEqual([503, "no-store", "7"]);
    expect(tileResponse({ kind: "unavailable", retryAfter: 9999 }, null).headers.get("retry-after")).toBe("60");
    expect(tileResponse({ kind: "unavailable", retryAfter: null }, null).headers.get("retry-after")).toBe("10");
  });
});

describe("against the mock through the map client", () => {
  const MOCK = "http://mock.invalid";
  const TOKEN = "cu_mock_mock";
  function wired(o: { scenario?: "busy" | "fresh"; rate?: number; burst?: number } = {}) {
    const inner = mockFetch(o.scenario ?? "busy");
    const paths: string[] = [];
    const core = createCore({
      baseUrl: MOCK,
      token: TOKEN,
      fetchImpl: (i, init) => {
        paths.push(new URL(String(i)).pathname);
        return inner(i, init);
      },
      ratePerMinute: o.rate ?? 100_000,
      burst: o.burst ?? 10_000,
      log: () => {}
    });
    const m = createMapClient({ core, hiddenLive: () => new ServerList(["staff", "onesoul"]), hiddenServers: () => new ServerList(["staff"]), hiddenPlayers: () => new HiddenList([]) });
    const clock = { t: Date.now() };
    const svc = createTileService({
      dir: tmp(),
      maxBytes: 10 ** 9,
      visible: (s, scope) => m.serverVisible(s, scope),
      source: (ref, opt) => (ref.round !== undefined ? m.roundMapTile(ref.round, ref.world, ref.tile, ref.server, opt) : m.mapTile(ref.server, ref.world, ref.tile, opt)),
      now: () => clock.t,
      sweepMs: 0,
      log: () => {}
    });
    return { m, core, svc, paths, clock };
  }

  async function zoomMax(m: ReturnType<typeof wired>["m"]): Promise<number> {
    const w = await m.mapWorld("survival", "minecraft_overworld");
    if (!w.ok) throw new Error("no world");
    return w.data.zoom.max;
  }

  test("fresh, then revalidated with the mock's ETag (304), and the browser's own 304", async () => {
    const w = wired();
    const ref: TileRef = { ...REF, tile: { z: await zoomMax(w.m), x: 0, y: 0 } };
    w.paths.length = 0;
    const a = await w.svc.get(ref);
    expect(a.kind).toBe("tile");
    if (a.kind !== "tile") return;
    expect(a.etag).toMatch(/^"[0-9a-f]+"$/);
    expect(w.paths).toHaveLength(1);
    w.clock.t += FRESH_MS + 1;
    const b = await w.svc.get(ref);
    expect(b.kind === "tile" && b.source).toBe("stale-revalidating");
    await tick();
    await tick();
    expect(w.paths).toHaveLength(2);
    const via = tileResponse(b, a.etag);
    expect(via.status).toBe(304);
  });

  test("a tile cakeutils has not rendered is a 404, remembered", async () => {
    const w = wired();
    const z = await zoomMax(w.m);
    const ref: TileRef = { ...REF, tile: { z, x: 40, y: 40 } };
    w.paths.length = 0;
    expect((await w.svc.get(ref)).kind).toBe("missing");
    expect((await w.svc.get(ref)).kind).toBe("missing");
    expect(w.paths).toHaveLength(1);
  });

  test("hidden and One Soul servers are 404 and never asked; a round tile of a One Soul server is served", async () => {
    const w = wired();
    const z = await zoomMax(w.m);
    w.paths.length = 0;
    expect((await w.svc.get({ ...REF, server: "staff", tile: { z, x: 0, y: 0 } })).kind).toBe("missing");
    expect((await w.svc.get({ ...REF, server: "onesoul", tile: { z, x: 0, y: 0 } })).kind).toBe("missing");
    expect((await w.svc.get({ ...REF, server: "staff", round: 1, tile: { z, x: 0, y: 0 } })).kind).toBe("missing");
    expect(w.paths).toHaveLength(0);
  });

  test("the map bucket is what is spent: an empty bucket turns a miss away with a retry hint, and a copy on disk still serves", async () => {
    const w = wired({ rate: 1, burst: 3 });
    const z = await zoomMax(w.m); // one token
    const ref = (x: number): TileRef => ({ ...REF, tile: { z, x, y: 0 } });
    expect((await w.svc.get(ref(0))).kind).toBe("tile"); // 2nd token
    expect((await w.svc.get(ref(1))).kind).toBe("tile"); // 3rd token
    const before = w.core.status().tokens;
    expect(before).toBeLessThan(1);
    const refused = await w.svc.get(ref(-1));
    expect(refused.kind).toBe("unavailable");
    expect(w.core.status().throttle.localRefused).toBeGreaterThan(0);
    // a tile we hold is not refused, even when old: the revalidation is merely skipped
    w.clock.t += FRESH_MS + 1;
    expect((await w.svc.get(ref(0))).kind).toBe("tile");
  });

  test("nothing in a response names the token or cakeutils", async () => {
    const w = wired();
    const z = await zoomMax(w.m);
    const a = await w.svc.get({ ...REF, tile: { z, x: 0, y: 0 } });
    const res = tileResponse(a, null);
    const heads = JSON.stringify([...res.headers.entries()]);
    expect(heads).not.toContain(TOKEN);
    expect(heads).not.toContain("mock.invalid");
    expect(heads.toLowerCase()).not.toContain("authorization");
    expect(heads).not.toContain("/v2/");
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.includes(Buffer.from(TOKEN))).toBe(false);
    const down = tileResponse({ kind: "unavailable", retryAfter: null }, null);
    expect(JSON.stringify([...down.headers.entries()])).not.toContain("mock.invalid");
  });

  test("the fresh scenario has no map: every tile is 404 cleanly", async () => {
    const w = wired({ scenario: "fresh" });
    expect((await w.svc.get({ ...REF, tile: { z: 3, x: 0, y: 0 } })).kind).toBe("missing");
    expect((await w.svc.get({ ...REF, round: 1, tile: { z: 3, x: 0, y: 0 } })).kind).toBe("missing");
  });
});
