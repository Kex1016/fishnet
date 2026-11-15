// FM-3: the map canvas's pure parts: the frame (crs.ts), tile versions and revalidation (tiles.ts), glides (players.ts).
import { describe, expect, test } from "bun:test";
import { centreLatLng, clampZoom, coord, faceSrc, openingView, pixelsPerBlock, readout, stillOffset, stillTiles, toBlock, toLatLng, toRaw, turn } from "#lib/map/crs.ts";
import { glideAt, nextGlide, TELEPORT_BLOCKS } from "#lib/map/players.ts";
import { Revalidator, TileBook, tileKey, token } from "#lib/map/tiles.ts";
import { tileOf } from "#lib/map/view.ts";
import type { MapWorldView } from "#lib/map/types.ts";

const world = (over: Partial<MapWorldView> = {}): MapWorldView => ({
  server: "survival",
  id: "minecraft_overworld",
  name: "Overworld",
  dimension: "minecraft:overworld",
  order: 0,
  cycle: null,
  tileSize: 512,
  zoom: { min: 0, max: 3, default: 3, extra: 2 },
  spawn: { x: 64, z: -32 },
  tiles: { template: "/map/t/survival/minecraft_overworld/{z}/{x}_{y}.png", epoch: null, versions: {}, frozen: false },
  updatedAt: 0,
  ...over
});

describe("crs", () => {
  test("a block is squaremap's latLng and comes back", () => {
    expect(toLatLng(3, 64, -32)).toEqual([4, 8]);
    expect(toLatLng(3, 0, 0)).toEqual([0, 0]);
    expect(Object.is(toLatLng(3, 0, 0)[0], -0)).toBe(false);
    expect(toRaw(3, 4, 8)).toEqual({ x: 64, z: -32 });
    expect(toBlock(3, -0.01, -0.01)).toEqual({ x: -1, z: 0 });
    expect(centreLatLng(3, { x: 0, z: 0 })).toEqual([-0.0625, 0.0625]);
  });

  test("the pixel of a block is in the tile squaremap puts it in, at every zoom", () => {
    for (const max of [1, 3, 5])
      for (let zoom = 0; zoom <= max; zoom++)
        for (const [x, z] of [[64, -32], [-1, -1], [1023, -512], [-4097, 4096], [0, 0]]) {
          const [lat, lng] = toLatLng(max, x, z);
          // L.CRS.Simple: pixel = (lng · 2^zoom, −lat · 2^zoom); Leaflet's tile = floor(pixel / 512)
          const px = lng * 2 ** zoom;
          const py = -lat * 2 ** zoom;
          expect({ z: zoom, x: Math.floor(px / 512) || 0, y: Math.floor(py / 512) || 0 }).toEqual(tileOf(max, zoom, { x, z }));
          expect(px).toBe(x * pixelsPerBlock(max, zoom));
        }
  });

  test("zoom is clamped to native plus extra; the opening view defaults to spawn", () => {
    const w = world();
    expect(clampZoom(w.zoom, 9)).toBe(5);
    expect(clampZoom(w.zoom, -2)).toBe(0);
    expect(openingView(w)).toEqual({ world: w.id, x: 64, z: -32, zoom: 3 });
    expect(openingView(w, { x: 10.7, z: -3.2, zoom: 7 })).toEqual({ world: w.id, x: 10, z: -4, zoom: 5 });
    expect(openingView(w, { x: 10 })).toEqual({ world: w.id, x: 64, z: -32, zoom: 3 }); // half a position is none
    expect(openingView(w, { zoom: Number.NaN }).zoom).toBe(3);
  });

  test("the still frame is the same grid: tile offsets put the centre block at the centre", () => {
    const w = world();
    for (const zoom of [0, 1, 3, 5]) {
      const v = { world: w.id, x: 64, z: -32, zoom };
      const tiles = stillTiles(w, v);
      expect(tiles).toHaveLength(15);
      const ppb = pixelsPerBlock(3, zoom);
      for (const t of tiles) {
        const span = 512 * 2 ** (3 - t.z);
        expect(t.z).toBe(Math.min(3, zoom));
        expect(t.size).toBe(span * ppb);
        // the tile's first block, seen from the centre of block (64, −32)
        expect(t.left).toBe((t.x * span - 64.5) * ppb);
        expect(t.top).toBe((t.y * span + 31.5) * ppb);
      }
      const home = tiles.find((t) => t.left <= 0 && t.left + t.size > 0 && t.top <= 0 && t.top + t.size > 0)!;
      expect({ z: home.z, x: home.x, y: home.y }).toEqual(tileOf(3, home.z, { x: 64, z: -32 }));
      expect(stillOffset(w, v, { x: 74, z: -32 })).toEqual({ left: 10 * ppb, top: 0 });
    }
  });

  test("readout, yaw and faces", () => {
    expect(coord(-388)).toBe("−388");
    expect(coord(-0.4)).toBe("−1");
    expect(coord(0)).toBe("0");
    expect(readout({ x: 1204, z: -388 })).toBe("x 1204, z −388");
    expect(turn(170, -170)).toBe(20);
    expect(turn(-170, 170)).toBe(-20);
    expect(turn(0, 180)).toBe(180);
    expect(turn(350, 370)).toBe(20);
    expect(faceSrc("C478B64A-c578-47dd-a278-b324c378b4b7")).toBe("/img/face/c478b64a-c578-47dd-a278-b324c378b4b7.png");
    expect(faceSrc("../../etc")).toBeNull();
    expect(faceSrc('x" onerror="y')).toBeNull();
  });
});

describe("TileBook", () => {
  const T = "/map/t/s/w/{z}/{x}_{y}.png";

  test("a world with a log: every URL has ?v=, listed tiles their seq, the rest seq 0", () => {
    const b = new TileBook({ template: T, epoch: "e1", versions: { "3/0/-1": 41 }, frozen: false });
    expect(b.versioned).toBe(true);
    expect(b.url(3, 0, -1)).toBe("/map/t/s/w/3/0_-1.png?v=e1.41");
    expect(b.url(2, 0, 0)).toBe("/map/t/s/w/2/0_0.png?v=e1.0");
    expect(b.plain(3, 0, -1)).toBe("/map/t/s/w/3/0_-1.png");
  });

  test("a tiles event names what changed; the same event twice changes nothing", () => {
    const b = new TileBook({ template: T, epoch: "e1", versions: { "3/0/-1": 41 }, frozen: false });
    const ev = { epoch: "e1", reset: false, tiles: [["e1.42", 3, 0, -1], ["e1.41", 3, 1, 1]] as [string, number, number, number][] };
    expect(b.apply(ev)).toEqual([tileKey(3, 0, -1), tileKey(3, 1, 1)]);
    expect(b.url(3, 0, -1)).toBe("/map/t/s/w/3/0_-1.png?v=e1.42");
    expect(b.apply(ev)).toEqual([]);
    // malformed rows are skipped
    expect(b.apply({ epoch: "e1", reset: false, tiles: [["e1.50", 3, 0] as never, [50 as never, 3, 0, 0], ["e1.50", 3, 0.5, 0]] })).toEqual([]);
  });

  test("a new epoch or a reset asks for everything again", () => {
    const b = new TileBook({ template: T, epoch: "e1", versions: { "3/0/-1": 41 }, frozen: false });
    expect(b.apply({ epoch: "e2", reset: false, tiles: [["e2.1", 3, 1, 1]] })).toBe("reset");
    expect(b.url(3, 0, -1)).toBe("/map/t/s/w/3/0_-1.png?v=e2.0");
    expect(b.url(3, 1, 1)).toBe("/map/t/s/w/3/1_1.png?v=e2.1");
    expect(b.apply({ epoch: "e2", reset: true, tiles: [] })).toBe("reset");
    expect(b.url(3, 1, 1)).toBe("/map/t/s/w/3/1_1.png?v=e2.0");
  });

  test("no log: no query until a tile's ETag moved; frozen never changes", () => {
    const b = new TileBook({ template: T, epoch: null, versions: {}, frozen: false });
    expect(b.versioned).toBe(false);
    expect(b.url(3, 0, 0)).toBe("/map/t/s/w/3/0_0.png");
    b.setBust(tileKey(3, 0, 0), '"abc"');
    expect(b.url(3, 0, 0)).toBe(`/map/t/s/w/3/0_0.png?r=${token('"abc"')}`);
    expect(token('"abc"')).toMatch(/^[a-z0-9]+$/);
    const f = new TileBook({ template: T, epoch: null, versions: {}, frozen: true });
    expect(f.apply({ epoch: "e9", reset: true, tiles: [["e9.1", 3, 0, 0]] })).toEqual([]);
    expect(f.url(3, 0, 0)).toBe("/map/t/s/w/3/0_0.png");
  });
});

describe("Revalidator", () => {
  function site(etags: Record<string, string | null>) {
    const calls: { url: string; cache: string }[] = [];
    const fetchFn = async (url: string, init: { cache: RequestCache }) => {
      calls.push({ url, cache: init.cache });
      const tag = etags[url];
      if (tag === undefined) return { ok: false, status: 404, headers: { get: () => null } };
      return { ok: true, status: 200, headers: { get: (n: string) => (n === "etag" ? tag : null) } };
    };
    return { calls, fetchFn };
  }

  test("a tile is swapped only when its ETag moved after it was drawn", async () => {
    const etags: Record<string, string | null> = { "/t/a": '"1"' };
    const s = site(etags);
    const r = new Revalidator(s.fetchFn);
    await r.seen("a", "/t/a");
    await r.seen("a", "/t/a");
    expect(s.calls).toEqual([{ url: "/t/a", cache: "force-cache" }]); // the browser's copy, once
    expect(await r.check("a", "/t/a")).toBeNull();
    expect(s.calls.at(-1)).toEqual({ url: "/t/a", cache: "no-cache" }); // a conditional request
    etags["/t/a"] = '"2"';
    expect(await r.check("a", "/t/a")).toBe('"2"');
    expect(await r.check("a", "/t/a")).toBeNull();
  });

  test("no ETag, an error or a tile never seen: nothing is swapped", async () => {
    const etags: Record<string, string | null> = { "/t/a": null, "/t/b": '"1"' };
    const r = new Revalidator(site(etags).fetchFn);
    await r.seen("a", "/t/a");
    expect(await r.check("a", "/t/a")).toBeNull();
    expect(await r.check("b", "/t/b")).toBeNull(); // first sighting is the baseline
    expect(await r.check("gone", "/t/gone")).toBeNull();
    const broken = new Revalidator(async () => {
      throw new Error("offline");
    });
    expect(await broken.check("a", "/t/a")).toBeNull();
    expect(await broken.appeared("a", "/t/a")).toBe(false);
  });

  test("a missing tile that appears is noticed", async () => {
    const etags: Record<string, string | null> = {};
    const r = new Revalidator(site(etags).fetchFn);
    expect(await r.appeared("a", "/t/a")).toBe(false);
    etags["/t/a"] = '"1"';
    expect(await r.appeared("a", "/t/a")).toBe(true);
  });
});

describe("glide", () => {
  test("a dot moves in a straight line at constant speed and ends on the target", () => {
    const g = nextGlide({ x: 0, z: 0 }, { x: 10, z: -20 }, 1000, 2000);
    expect(glideAt(g, 1000)).toEqual({ x: 0, z: 0, done: false });
    expect(glideAt(g, 1500)).toEqual({ x: 2.5, z: -5, done: false });
    expect(glideAt(g, 2000)).toEqual({ x: 5, z: -10, done: false });
    expect(glideAt(g, 3000)).toEqual({ x: 10, z: -20, done: true });
    expect(glideAt(g, 9000)).toEqual({ x: 10, z: -20, done: true });
  });

  test("a new target mid-glide starts from where the dot is", () => {
    const g = nextGlide({ x: 0, z: 0 }, { x: 10, z: 0 }, 0, 2000);
    const mid = glideAt(g, 1000);
    const g2 = nextGlide(mid, { x: 5, z: 10 }, 1000, 2000);
    expect(glideAt(g2, 1000)).toEqual({ x: 5, z: 0, done: false });
    expect(glideAt(g2, 3000)).toEqual({ x: 5, z: 10, done: true });
  });

  test("reduced motion (0 ms) and a teleport jump", () => {
    expect(glideAt(nextGlide({ x: 0, z: 0 }, { x: 10, z: 0 }, 0, 0), 0)).toEqual({ x: 10, z: 0, done: true });
    const far = nextGlide({ x: 0, z: 0 }, { x: TELEPORT_BLOCKS + 1, z: 0 }, 0, 2000);
    expect(glideAt(far, 1)).toEqual({ x: TELEPORT_BLOCKS + 1, z: 0, done: true });
    expect(nextGlide({ x: 0, z: 0 }, { x: TELEPORT_BLOCKS, z: 0 }, 0, 2000).ms).toBe(2000);
  });
});
