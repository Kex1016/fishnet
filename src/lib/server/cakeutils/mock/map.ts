// The mock's web map (FM-0): /v2/map* and a One Soul round's map routes (finished, or in play: TH-31), answered the way cakeutils
// v2/MAP.md §5 says (shapes §5.2, headers §5.3, errors §5.4). Mock only: never loaded in production.
//
// fresh: no server has a map (`{servers: []}`), every per-server route is 404.
// busy:  survival (overworld, nether, end; the overworld has a change log; live positions on) and creative
//        (one overworld; positions off → players 404 off). lobby has players online and no map, the One Soul
//        server is never listed (standalone), and two entries exist only to be hidden (`hidden` below: the
//        server "staff" and the player "quietgill"); the site must never show either.
//
// Tiles are drawn on request (sharp, cached in memory) from a seeded terrain function, so a block always has
// the same colour at every zoom. Every world renders the same 3×3 tiles at zoom.max (x, y ∈ {-1, 0, 1}:
// blocks -512..1023 on both axes); anything outside is 404 like an unrendered area. Landmarks for alignment
// checks (FM-3): grid lines on every block x or z divisible by 128 (darker), a 13×13 plaza around spawn and
// the spawn block itself in red (#d23c3c). Players walk circles (deterministic in time), so dots move.
import type { MapChanges, MapIndex, MapPlayers, MapWorld, RoundMapWorld } from "#lib/api/types.ts";
import { parseTile, validWorldId } from "#lib/map/links.ts";
import { fnv1a, hex, type World, type WorldPlayer } from "./world.ts";
import { generateMarkersBusy, generateMarkersFresh, markersAnswer, type MockMarkerSet } from "./markers.ts";

export type MockMapPalette = "overworld" | "nether" | "end" | "flat";

export type MockMapWorld = {
  id: string;
  dimension: string | null;
  name: string;
  order: number;
  zoom: { max: number; default: number; extra: number };
  spawn: { x: number; z: number };
  palette: MockMapPalette;
  /** this world has a tile change log (squaremap after 1.4.3) */
  changes: boolean;
  /** a public mini-server's world (cakeutils MAP-31): both set or neither */
  mini?: string;
  area?: "overworld" | "nether" | "end";
};

export type MockMapServer = {
  server: string;
  display_name: string;
  online: boolean;
  live_players: boolean;
  announced_ago_ms: number;
  player_update_ms: number;
  worlds: MockMapWorld[];
};

/** A player walking a circle: centre, radius, one lap per `period_ms`, starting at `phase` (radians). */
export type MockMover = { uuid: string; name: string; server: string; world: string; cx: number; cz: number; r: number; period_ms: number; phase: number };

export type MockMap = {
  servers: MockMapServer[];
  movers: MockMover[];
  /** entries only there to be hidden: the site hides them in mock mode (client.ts mapApi), tests check they never show */
  hidden: { servers: string[]; players: string[] };
  /** each world's markers (FMK-0; markers.ts); a world without an entry has none */
  markers: MockMarkerSet[];
};

const H = 3_600_000;
const OW = (order: number, palette: MockMapPalette = "overworld", name = "minecraft:overworld"): MockMapWorld => ({
  id: "minecraft_overworld",
  dimension: "minecraft:overworld",
  name,
  order,
  zoom: { max: 3, default: 3, extra: 2 },
  spawn: { x: 0, z: 0 },
  palette,
  changes: false
});

export function generateMapFresh(): MockMap {
  return { servers: [], movers: [], hidden: { servers: [], players: [] }, markers: generateMarkersFresh() };
}

/** The busy map from the busy world's online players (deterministic). */
export function generateMapBusy(players: WorldPlayer[]): MockMap {
  const survival: MockMapServer = {
    server: "survival",
    display_name: "Survival",
    online: true,
    live_players: true,
    announced_ago_ms: 3 * H,
    player_update_ms: 1000,
    worlds: [
      { ...OW(0), spawn: { x: 64, z: -32 }, changes: true },
      { id: "minecraft_the_nether", dimension: "minecraft:the_nether", name: "minecraft:the_nether", order: 0, zoom: { max: 3, default: 2, extra: 2 }, spawn: { x: 8, z: -4 }, palette: "nether", changes: false },
      // a public mini-server's world (brief §2): its own id, the mini's name and area; a private mini is not here at all
      { id: "cakeutils_miniservers_skyblock-1_overworld", dimension: "minecraft:overworld", name: "Skyblock 1", order: 0, zoom: { max: 3, default: 3, extra: 2 }, spawn: { x: 16, z: 16 }, palette: "flat", changes: false, mini: "skyblock-1", area: "overworld" },
      { id: "minecraft_the_end", dimension: "minecraft:the_end", name: "minecraft:the_end", order: 0, zoom: { max: 3, default: 1, extra: 2 }, spawn: { x: 100, z: 0 }, palette: "end", changes: false }
    ]
  };
  const creative: MockMapServer = {
    server: "creative",
    display_name: "Creative",
    online: true,
    live_players: false,
    announced_ago_ms: 26 * H,
    player_update_ms: 1000,
    worlds: [{ ...OW(0, "flat", "minecraft:overworld"), zoom: { max: 3, default: 2, extra: 2 } }]
  };
  const staff: MockMapServer = { server: "staff", display_name: "Staff", online: true, live_players: true, announced_ago_ms: H, player_update_ms: 1000, worlds: [OW(0)] };

  const movers: MockMover[] = [];
  const onMap = players.filter((p) => p.online && !p.mini && (p.server === "survival" || p.server === "creative"));
  let onSurvival = 0;
  onMap.forEach((p) => {
    const h = fnv1a(`mover:${p.uuid}`);
    // the second survival player is in the nether
    const world = p.server === "survival" && onSurvival++ === 1 ? "minecraft_the_nether" : "minecraft_overworld";
    movers.push({
      uuid: p.uuid,
      name: p.name,
      server: p.server!,
      world,
      cx: -300 + (h % 600),
      cz: -300 + ((h >>> 10) % 600),
      r: 24 + ((h >>> 20) % 80),
      period_ms: 60_000 + ((h >>> 4) % 120_000),
      phase: ((h >>> 12) % 628) / 100
    });
  });
  const quiet = { uuid: "5a1c0de0-0000-4000-8000-00000000a11e", name: "quietgill" };
  movers.push({ ...quiet, server: "survival", world: "minecraft_overworld", cx: 40, cz: 40, r: 30, period_ms: 90_000, phase: 1 });
  movers.push({ uuid: "5a1c0de0-0000-4000-8000-00000000b05e", name: "Bosun", server: "staff", world: "minecraft_overworld", cx: 0, cz: 0, r: 20, period_ms: 60_000, phase: 0 });
  return { servers: [creative, staff, survival], movers, hidden: { servers: ["staff"], players: [quiet.uuid] }, markers: generateMarkersBusy() };
}

// ---- answers

type Kit = { problem: (status: number, code: string, detail: string) => Response };

const RATE = { "ratelimit-limit": "1200", "ratelimit-remaining": "299" };
/** the mock's "now" for things that happened once (a backend's announcement) */
const STARTED = Date.now();

function jsonCc(req: Request, data: unknown, cc: string): Response {
  const body = JSON.stringify(data);
  const etag = `W/"${hex(`map:${body}`, 16)}"`;
  const headers = { "content-type": "application/json", "cache-control": cc, etag, ...RATE };
  if (matches(req, etag)) return new Response(null, { status: 304, headers: noType(headers) });
  return new Response(body, { status: 200, headers });
}

function noType(h: Record<string, string>): Record<string, string> {
  const { "content-type": _t, ...rest } = h;
  return rest;
}

function matches(req: Request, etag: string): boolean {
  const inm = req.headers.get("if-none-match");
  return !!inm && (inm === "*" || inm.split(",").map((s) => s.trim().replace(/^W\//, "")).includes(etag.replace(/^W\//, "")));
}

function mapProblem(status: number, code: string, detail: string, retryAfter?: number): Response {
  const titles: Record<number, string> = { 404: "Not Found", 501: "Not Implemented", 503: "Service Unavailable" };
  const headers: Record<string, string> = { "content-type": "application/problem+json", "cache-control": "no-store", ...RATE };
  if (retryAfter) headers["retry-after"] = String(retryAfter);
  return new Response(JSON.stringify({ type: `urn:cakeutils:problem:${code}`, title: titles[status] ?? "Error", status, detail }), { status, headers });
}

const notFound = (detail: string) => mapProblem(404, "not_found", detail);

/** Tile (z, x, y) of a world with zoom.max `max` overlaps the rendered 3×3 area. */
function rendered(max: number, z: number, x: number, y: number): boolean {
  if (z > max) return false;
  const S = 512 * 2 ** (max - z);
  const lo = -512;
  const hi = 1024;
  return x * S < hi && (x + 1) * S > lo && y * S < hi && (y + 1) * S > lo;
}

// ---- terrain: seeded value noise, the same block colour at every zoom

function hash2(seed: number, x: number, z: number): number {
  let h = (seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(z, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(seed: number, x: number, z: number, cell: number): number {
  const gx = Math.floor(x / cell);
  const gz = Math.floor(z / cell);
  const fx = x / cell - gx;
  const fz = z / cell - gz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(seed, gx, gz);
  const b = hash2(seed, gx + 1, gz);
  const c = hash2(seed, gx, gz + 1);
  const d = hash2(seed, gx + 1, gz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

type RGB = [number, number, number];
const hexRgb = (s: string): RGB => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const C = {
  deep: hexRgb("#2b4f8a"),
  water: hexRgb("#3a6bb0"),
  sand: hexRgb("#d8c98a"),
  grass: hexRgb("#5d9b3a"),
  forest: hexRgb("#3f7a2c"),
  stone: hexRgb("#8a8a8a"),
  snow: hexRgb("#eef2f4"),
  netherrack: hexRgb("#7a2e2e"),
  lava: hexRgb("#d9661f"),
  soul: hexRgb("#5a4636"),
  void: hexRgb("#151020"),
  endstone: hexRgb("#dcdc9e"),
  plaza: hexRgb("#b8b0a0"),
  spawn: hexRgb("#d23c3c"),
  road: hexRgb("#a39b8b")
};

function blockColour(palette: MockMapPalette, seed: number, spawn: { x: number; z: number }, bx: number, bz: number): RGB {
  if (bx === spawn.x && bz === spawn.z) return C.spawn;
  let c: RGB;
  if (Math.abs(bx - spawn.x) <= 6 && Math.abs(bz - spawn.z) <= 6) c = C.plaza;
  else {
    const h = 0.65 * noise(seed, bx, bz, 96) + 0.35 * noise(seed + 1, bx, bz, 24);
    const v = hash2(seed + 2, bx, bz);
    if (palette === "overworld") c = h < 0.33 ? C.deep : h < 0.42 ? C.water : h < 0.45 ? C.sand : h < 0.66 ? C.grass : h < 0.8 ? C.forest : h < 0.9 ? C.stone : C.snow;
    else if (palette === "nether") c = h < 0.3 ? C.lava : h < 0.42 ? C.soul : C.netherrack;
    else if (palette === "end") {
      const r = Math.hypot(bx - spawn.x, bz - spawn.z);
      c = r + (h - 0.5) * 160 < 300 ? C.endstone : C.void;
    } else c = (((bx % 32) + 32) % 32 < 2 || ((bz % 32) + 32) % 32 < 2) ? C.road : C.grass;
    const j = v < 0.34 ? 0.95 : v < 0.67 ? 1 : 1.05; // three shades per block kind: a few dozen colours in all
    c = [c[0] * j, c[1] * j, c[2] * j];
  }
  if (bx % 128 === 0 || bz % 128 === 0) c = [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8];
  return c;
}

const tileCache = new Map<string, Uint8Array>();

async function tilePng(key: string, palette: MockMapPalette, seed: number, spawn: { x: number; z: number }, max: number, z: number, tx: number, ty: number): Promise<Uint8Array> {
  const hit = tileCache.get(key);
  if (hit) return hit;
  const { default: sharp } = await import("sharp");
  const step = 2 ** (max - z);
  const S = 512 * step;
  const px = Buffer.alloc(512 * 512 * 4);
  for (let py = 0; py < 512; py++) {
    const bz = ty * S + py * step;
    for (let pxi = 0; pxi < 512; pxi++) {
      const bx = tx * S + pxi * step;
      const i = (py * 512 + pxi) * 4;
      if (bx < -512 || bx >= 1024 || bz < -512 || bz >= 1024) continue; // not rendered: transparent
      const c = blockColour(palette, seed, spawn, bx, bz);
      px[i] = Math.min(255, Math.round(c[0]));
      px[i + 1] = Math.min(255, Math.round(c[1]));
      px[i + 2] = Math.min(255, Math.round(c[2]));
      px[i + 3] = 255;
    }
  }
  const png = new Uint8Array(await sharp(px, { raw: { width: 512, height: 512, channels: 4 } }).png({ palette: true, colours: 64, dither: 0 }).toBuffer());
  if (tileCache.size > 400) tileCache.clear();
  tileCache.set(key, png);
  return png;
}

async function tileAnswer(req: Request, key: string, cc: string, draw: () => Promise<Uint8Array>): Promise<Response> {
  const etag = `"${hex(`tile:${key}`, 16)}"`;
  const headers = { "content-type": "image/png", "cache-control": cc, etag, "last-modified": new Date(Date.UTC(2026, 10, 1)).toUTCString(), ...RATE };
  if (matches(req, etag)) return new Response(null, { status: 304, headers: noType(headers) }); // cakeutils' 304 has no Content-Type (MAP-40 F3)
  const png = await draw();
  return new Response(req.method === "HEAD" ? null : (png as unknown as BodyInit), { status: 200, headers });
}

/** Where a mover is now: whole blocks, yaw in whole degrees facing along the walk (0 = south, 90 = west). */
export function moverAt(m: MockMover, t: number): { x: number; z: number; yaw: number } {
  const a = m.phase + (2 * Math.PI * t) / m.period_ms;
  const x = Math.round(m.cx + m.r * Math.cos(a));
  const z = Math.round(m.cz + m.r * Math.sin(a));
  const dx = -Math.sin(a);
  const dz = Math.cos(a);
  let yaw = Math.round((Math.atan2(-dx, dz) * 180) / Math.PI);
  if (yaw <= -180) yaw += 360;
  return { x, z, yaw };
}

/** The change log of a world that has one: one tile every 15 s, the last 32 kept. */
const LOG_BASE = Date.UTC(2026, 10, 1);
const LOG_EVERY = 15_000;
const LOG_KEEP = 32;
function changesOf(server: string, w: MockMapWorld, t: number): MapChanges {
  const seq = Math.max(1, Math.floor((t - LOG_BASE) / LOG_EVERY));
  const tiles: number[][] = [];
  for (let s = Math.max(1, seq - LOG_KEEP + 1); s <= seq; s++) {
    const h = fnv1a(`change:${server}:${w.id}:${s}`);
    tiles.push([s, w.zoom.max, (h % 3) - 1, ((h >>> 8) % 3) - 1]);
  }
  return { server, world: w.id, epoch: "7b1kxl4apuny", seq, dropped: Math.max(0, seq - LOG_KEEP), tiles };
}

/**
 * /v2/map* and /v2/onesoul/rounds/{cycle}/map/*: a Response, or null for any other path. `seg` is the path
 * after /v2, decoded. The token was checked by the caller.
 */
export async function handleMap(world: World, url: URL, seg: string[], req: Request, _kit: Kit): Promise<Response | null> {
  if (seg[0] === "onesoul" && seg[1] === "rounds" && seg[3] === "map") return roundRoutes(world, url, seg, req);
  if (seg[0] !== "map") return null;
  const map = world.map ?? generateMapFresh();
  const t = Date.now();

  if (seg.length === 1) {
    const data: MapIndex = {
      servers: [...map.servers]
        .sort((a, b) => (a.server < b.server ? -1 : 1))
        .map((s) => ({
          server: s.server,
          display_name: s.display_name,
          online: s.online,
          worlds: s.worlds.map((w) => ({ id: w.id, dimension: w.dimension, name: w.name, order: w.order, mini: w.mini ?? null, area: w.area ?? null })),
          live_players: s.online && s.live_players,
          changes: s.online && s.worlds.some((w) => w.changes),
          // when the backend announced its map: a moment in the past that stays put (anchored to the start of
          // the process), so the answer and its ETag are stable and a revalidation gets its 304 like at cakeutils
          announced_at: STARTED - s.announced_ago_ms
        }))
    };
    return jsonCc(req, data, "private, max-age=15");
  }

  const s = map.servers.find((x) => x.server === seg[1]);
  if (!s) return notFound(`server '${seg[1]}' has no map`);
  const w = (id: string | undefined) => (id && validWorldId(id) ? s.worlds.find((x) => x.id === id) : undefined);

  // /v2/map/{server}/players
  if (seg.length === 3 && seg[2] === "players") {
    if (!s.live_players) return mapProblem(404, "off", "live positions are off for this server");
    const listed = new Set(s.worlds.map((x) => x.id));
    const data: MapPlayers = {
      server: s.server,
      updated_at: Math.floor(t / s.player_update_ms) * s.player_update_ms,
      stale: false,
      players: map.movers.filter((m) => m.server === s.server && listed.has(m.world)).map((m) => ({ uuid: m.uuid, name: m.name, world: m.world, ...moverAt(m, t) }))
    };
    return jsonCc(req, data, "private, max-age=1");
  }

  // /v2/map/{server}/worlds/{world}/markers (MARKERS §3): the same 404 for every hidden case, no oracle (§3.3)
  if (seg[2] === "worlds" && seg.length === 5 && seg[4] === "markers") {
    const mw = w(seg[3]);
    if (!mw) return notFound(`world '${seg[3]}' is not on this map`);
    const data = markersAnswer(map.markers, s.server, mw.id);
    const etag = `"m${data.rev}"`;
    const headers = { "content-type": "application/json", "cache-control": "private, max-age=30", etag, ...RATE };
    if (matches(req, etag)) return new Response(null, { status: 304, headers: noType(headers) });
    return new Response(JSON.stringify(data), { status: 200, headers });
  }

  // /v2/map/{server}/worlds/{world}[/changes]
  if (seg[2] === "worlds" && (seg.length === 4 || (seg.length === 5 && seg[4] === "changes"))) {
    const mw = w(seg[3]);
    if (!mw) return notFound(`world '${seg[3]}' is not on this map`);
    if (seg.length === 5) {
      if (!mw.changes) return mapProblem(404, "not_supported", "this world has no tile change log");
      return jsonCc(req, changesOf(s.server, mw, t), "private, max-age=2");
    }
    const data: MapWorld = {
      server: s.server,
      world: mw.id,
      tile_size: 512,
      zoom: { min: 0, ...mw.zoom },
      spawn: mw.spawn,
      player_update_ms: s.player_update_ms,
      updated_at: Math.floor((t - s.announced_ago_ms) / 1000) * 1000,
      stale: false
    };
    return jsonCc(req, data, "private, max-age=300");
  }

  // /v2/map/{server}/tiles/{world}/{z}/{x}_{y}.png
  if (seg[2] === "tiles" && seg.length === 6) {
    const mw = w(seg[3]);
    const tk = parseTile(seg[4], seg[5]);
    if (!mw || !tk) return notFound("no such tile");
    if (!rendered(mw.zoom.max, tk.z, tk.x, tk.y)) return notFound("tile not rendered");
    const seed = fnv1a(`${s.server}:${mw.id}`);
    const key = `${s.server}/${mw.id}/${tk.z}/${tk.x}_${tk.y}`;
    return tileAnswer(req, key, "public, max-age=30, stale-while-revalidate=600", () => tilePng(key, mw.palette, seed, mw.spawn, mw.zoom.max, tk.z, tk.x, tk.y));
  }
  return notFound("no such route");
}

/**
 * A One Soul round's map: a finished round's archive (tiles a day in cache), or the round in play (TH-31, cakeutils
 * MAPD-77..79): its worlds' tiles with seconds of cache, only around where the round's souls have walked (the explored
 * area), and `players` with the living soul alone while connected. 404 in prep and for a round that never started.
 */
async function roundRoutes(world: World, url: URL, seg: string[], req: Request): Promise<Response> {
  const os = world.onesoul;
  const cycle = /^[1-9][0-9]{0,5}$/.test(seg[2]) ? Number(seg[2]) : NaN;
  const server = url.searchParams.get("server");
  if (!os || (server !== null && server !== os.server)) return notFound("no such round");
  const round = os.rounds.find((r) => r.cycle === cycle);
  const running = !!round && round.ended_ago === null && round.started_ago !== null && os.state !== "prep";
  if (!round || (round.ended_ago === null && !running)) return notFound("the round has not started, or has no tiles");
  const souls = os.souls.filter((s) => s.cycle === cycle);

  // /rounds/{cycle}/map/players: the living soul or nobody, whole blocks (never a ghost, a spectator or the queue)
  if (seg[4] === "players" && seg.length === 5) {
    if (!running) return notFound("positions are served for the round in play only");
    const soul = souls.find((s) => s.outcome === "playing");
    const players = soul && os.current?.online ? [soulAt(soul, Date.now())] : [];
    return jsonCc(req, { server: os.server, cycle, players }, "private, max-age=1");
  }

  const dims = new Set(souls.flatMap((s) => s.trail.map((t) => t.dim)));
  const worlds = [...dims].map((d) => d.replace(":", "_"));
  const id = seg[5];
  if (!id || !worlds.includes(id)) return notFound(`world '${id}' has no tiles`);
  const zoom = { max: 3, default: 2, extra: 2 };
  const spawn = { x: 120, z: -48 };
  if (seg[4] === "worlds" && seg.length === 6) {
    const at = running ? Date.now() - 60_000 : Date.now() - round.ended_ago!;
    const data: RoundMapWorld = { server: os.server, cycle, world: id, tile_size: 512, zoom: { min: 0, ...zoom }, spawn, updated_at: Math.floor(at / 1000) * 1000 };
    return jsonCc(req, data, running ? "private, max-age=15" : "private, max-age=300");
  }
  if (seg[4] === "tiles" && seg.length === 8) {
    const tk = parseTile(seg[6], seg[7]);
    if (!tk || !rendered(zoom.max, tk.z, tk.x, tk.y)) return notFound("tile not rendered");
    // the round in play: squaremap has rendered only what somebody has been near
    if (running && !explored(souls, id, tk.z, tk.x, tk.y, zoom.max)) return notFound("tile not rendered");
    const key = `${os.server}/round-${cycle}/${id}/${tk.z}/${tk.x}_${tk.y}`;
    const palette: MockMapPalette = id === "minecraft_the_nether" ? "nether" : id === "minecraft_the_end" ? "end" : "overworld";
    return tileAnswer(req, key, running ? "private, max-age=30" : "public, max-age=86400", () =>
      tilePng(key, palette, fnv1a(`${os.server}:round-${cycle}:${id}`), spawn, zoom.max, tk.z, tk.x, tk.y)
    );
  }
  return notFound("no such route");
}

/** Does this tile cover a block within 256 of a trail point of that world (the mock's "explored")? */
function explored(souls: { trail: { dim: string; points: [number, number, number, number][] }[] }[], id: string, z: number, x: number, y: number, max: number): boolean {
  const S = 512 * 2 ** (max - z);
  const R = 256;
  return souls.some((s) =>
    s.trail.some((t) => t.dim.replace(":", "_") === id && t.points.some(([, bx, , bz]) => bx + R >= x * S && bx - R < (x + 1) * S && bz + R >= y * S && bz - R < (y + 1) * S))
  );
}

/** The living soul now: walking a small circle around the last point of their trail, so the dot moves. */
export function soulAt(soul: { uuid: string; name: string; trail: { dim: string; points: [number, number, number, number][] }[] }, t: number) {
  const seg = soul.trail.at(-1)!;
  const [, x, , z] = seg.points.at(-1)!;
  const p = moverAt({ cx: x, cz: z, r: 12, phase: 0, period_ms: 90_000 } as MockMover, t);
  return { uuid: soul.uuid, name: soul.name, world: seg.dim.replace(":", "_"), ...p };
}

/** The fixture's hidden examples (mock mode merges them into the hide lists). */
export function mockMapHidden(world: World): { servers: string[]; players: string[] } {
  return world.map?.hidden ?? { servers: [], players: [] };
}
