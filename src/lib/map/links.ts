// The map's ids, paths and share links (FM-0, frozen with types.ts). Pure: safe in the browser and on the
// server. Every route that turns a URL into a cakeutils path or a disk path checks its parts here first.
//
//   /map                                              all servers with a map (FM-4)
//   /map/<server>?world=&x=&z=&zoom=&follow=&marker=  one server's map; the query is the share link (FM-4, FM-8, FMK-2)
//   /map/<server>/live                                SSE of positions and tile changes (FM-2)
//   /map/<server>/players.json                        the hub's last snapshot, the no-EventSource fallback (FM-2)
//   /map/t/<server>/<world>/<z>/<x>_<y>.png?v=        a live tile through the disk cache (FM-1)
//   /map/t/<server>/round/<cycle>/<world>/<z>/<x>_<y>.png   a finished One Soul round's tile, immutable (FM-1)
import type { UrlLike } from "#lib/url.ts";

/** A cakeutils server id (velocity.toml key). */
export const SERVER_ID = /^[A-Za-z0-9._-]{1,64}$/;
/** squaremap's web name of a world (MAP §3.2): 1..64 of [a-z0-9_.-], no leading or trailing dot, no "..". */
const WORLD_ID = /^[a-z0-9_.-]{1,64}$/;
/** Zoom levels, coordinates and rounds as cakeutils accepts them (MAP §3.2, §10). */
export const MAX_ZOOM = 15;
export const MAX_COORD = 2 ** 24;
export const MAX_CYCLE = 999_999;
/** Canonical decimal: no "+", no leading zero, no "-0". */
const INT = /^(0|-?[1-9][0-9]{0,8})$/;

export function validServerId(s: string): boolean {
  return SERVER_ID.test(s);
}

export function validWorldId(s: string): boolean {
  return WORLD_ID.test(s) && !s.startsWith(".") && !s.endsWith(".") && !s.includes("..");
}

/** A canonical integer within ±limit, else null. */
export function parseInt10(s: string, limit: number): number | null {
  if (!INT.test(s)) return null;
  const n = Number(s);
  return Math.abs(n) <= limit ? n : null;
}

export type TileKey = { z: number; x: number; y: number };

/** `<z>` and `<x>_<y>.png` of a tile path, or null when either is not canonical or out of range. */
export function parseTile(z: string, file: string): TileKey | null {
  const zn = parseInt10(z, MAX_ZOOM);
  const m = /^(-?[0-9]+)_(-?[0-9]+)\.png$/.exec(file);
  if (zn === null || zn < 0 || !m) return null;
  const x = parseInt10(m[1], MAX_COORD);
  const y = parseInt10(m[2], MAX_COORD);
  return x === null || y === null ? null : { z: zn, x, y };
}

export function validTile(t: TileKey): boolean {
  const int = (n: number) => Number.isInteger(n) && !Object.is(n, -0);
  return int(t.z) && t.z >= 0 && t.z <= MAX_ZOOM && int(t.x) && Math.abs(t.x) <= MAX_COORD && int(t.y) && Math.abs(t.y) <= MAX_COORD;
}

export function validCycle(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_CYCLE;
}

/** A tile's version for `?v=` (brief §4.2): `<epoch>.<seq>`; tiles not in the log use seq 0. */
export function tileVersion(epoch: string, seq: number): string {
  return `${epoch}.${seq}`;
}

/** The site's URL of a live tile; `ver` only when the world has a change log. */
export function tilePath(server: string, world: string, t: TileKey, ver?: string | null): string {
  const p = `/map/t/${encodeURIComponent(server)}/${world}/${t.z}/${t.x}_${t.y}.png`;
  return ver ? `${p}?v=${encodeURIComponent(ver)}` : p;
}

/** The site's URL of a finished round's tile (immutable). */
export function roundTilePath(server: string, cycle: number, world: string, t: TileKey): string {
  return `/map/t/${encodeURIComponent(server)}/round/${cycle}/${world}/${t.z}/${t.x}_${t.y}.png`;
}

/** Leaflet's template for a world's tiles: `{z}`, `{x}`, `{y}` are filled in by the tile layer (FM-3). */
export function tileTemplate(server: string, world: string): string {
  return `/map/t/${encodeURIComponent(server)}/${world}/{z}/{x}_{y}.png`;
}

export function roundTileTemplate(server: string, cycle: number, world: string): string {
  return `/map/t/${encodeURIComponent(server)}/round/${cycle}/${world}/{z}/{x}_{y}.png`;
}

export const liveHref = (server: string) => `/map/${encodeURIComponent(server)}/live`;
export const playersJsonHref = (server: string) => `/map/${encodeURIComponent(server)}/players.json`;
/** One world's markers for the page (FMK-0 route); the poll fallback revalidates it (FMK-3). */
export const markersJsonHref = (server: string, world: string) => `/map/${encodeURIComponent(server)}/markers.json?world=${encodeURIComponent(world)}`;

/** Where the map looks: a world, a block at the centre, a Leaflet zoom (may pass zoom.max by zoom.extra). */
export type MapView = { world: string; x: number; z: number; zoom: number };

/** The share link's state: any part may be missing (the page fills in the world's defaults). */
export type MapLink = Partial<MapView> & { follow?: string | null; /** a map marker's id (FMK-2): the page opens on it with its popup */ marker?: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Reads `?world=&x=&z=&zoom=&follow=`; anything malformed is left out, never an error. */
export function parseMapLink(url: UrlLike): MapLink {
  const q = url.searchParams;
  const out: MapLink = {};
  const world = q.get("world");
  if (world && validWorldId(world)) out.world = world;
  const x = q.get("x") !== null ? parseInt10(q.get("x")!, MAX_COORD * 512) : null;
  const z = q.get("z") !== null ? parseInt10(q.get("z")!, MAX_COORD * 512) : null;
  if (x !== null && z !== null) {
    out.x = x;
    out.z = z;
  }
  const zoom = q.get("zoom") !== null ? parseInt10(q.get("zoom")!, MAX_ZOOM + 8) : null;
  if (zoom !== null && zoom >= 0) out.zoom = zoom;
  const follow = q.get("follow")?.toLowerCase();
  if (follow && UUID.test(follow)) out.follow = follow;
  const marker = q.get("marker") !== null ? parseInt10(q.get("marker")!, 2 ** 31 - 1) : null;
  if (marker !== null && marker >= 1) out.marker = marker;
  return out;
}

/** `/map/<server>` with the share link's query, in a fixed order; whole blocks and whole zoom levels. */
export function mapHref(server: string, link: MapLink = {}): string {
  const q = new URLSearchParams();
  if (link.world) q.set("world", link.world);
  if (link.x !== undefined && link.z !== undefined) {
    q.set("x", String(Math.round(link.x) || 0));
    q.set("z", String(Math.round(link.z) || 0));
  }
  if (link.zoom !== undefined) q.set("zoom", String(Math.round(link.zoom)));
  if (link.follow) q.set("follow", link.follow);
  if (link.marker !== undefined && link.marker >= 1) q.set("marker", String(Math.round(link.marker)));
  const s = q.toString();
  return `/map/${encodeURIComponent(server)}${s ? `?${s}` : ""}`;
}
