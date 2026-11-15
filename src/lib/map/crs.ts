// The map's frame (FM-3; brief §2, MAP §5.2), pure: no Leaflet, safe on the server and in tests.
//
// L.CRS.Simple with 512 px tiles: at Leaflet zoom `zoom` a point (lat, lng) is the pixel (lng · 2^zoom, −lat · 2^zoom).
// Block (x, z) sits at latLng (−z·s, x·s), s = 1 / 2^zoom.max, so one block is 2^(zoom − zoom.max) pixels and tile
// (z, tx, ty) starts at block (tx·S, ty·S), S = 512 · 2^(zoom.max − z): squaremap's own grid.
//
// Two anchors, on purpose: a block coordinate from a whole-block source (players, the view's centre) means the
// block, drawn at its centre (x + 0.5, z + 0.5); a raw coordinate (marks, trails, spawn) is drawn where it is.
import type { Block, MapView, MapWorldView, Zoom } from "./types.ts";

export type LatLng = [lat: number, lng: number];

/** Raw block coordinates (x east, z south) to Leaflet's [lat, lng]. */
export function toLatLng(max: number, x: number, z: number): LatLng {
  const s = 1 / 2 ** max;
  return [-z * s || 0, x * s || 0];
}

/** The centre of a whole block. */
export function centreLatLng(max: number, b: Block): LatLng {
  return toLatLng(max, b.x + 0.5, b.z + 0.5);
}

/** Leaflet's [lat, lng] back to raw block coordinates (not floored). */
export function toRaw(max: number, lat: number, lng: number): Block {
  const k = 2 ** max;
  return { x: lng * k || 0, z: -lat * k || 0 };
}

/** The whole block that holds a point. */
export function toBlock(max: number, lat: number, lng: number): Block {
  const r = toRaw(max, lat, lng);
  return { x: Math.floor(r.x), z: Math.floor(r.z) };
}

/** Screen pixels one block takes at a Leaflet zoom (1 at zoom.max, 0.5 one level out, 2 one level past it). */
export function pixelsPerBlock(max: number, zoom: number): number {
  return 2 ** (zoom - max);
}

/** The deepest zoom a visitor may reach: native tiles scaled up by zoom.extra levels. */
export function maxZoom(z: Zoom): number {
  return z.max + Math.max(0, z.extra);
}

export function clampZoom(z: Zoom, zoom: number): number {
  return Math.min(maxZoom(z), Math.max(z.min, Math.round(zoom)));
}

/** The view to open at: the caller's parts, else the world's spawn and default zoom. */
export function openingView(world: MapWorldView, view?: Partial<Omit<MapView, "world">>): MapView {
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
  const both = ok(view?.x) && ok(view?.z);
  return {
    world: world.id,
    x: both ? Math.floor(view!.x!) : Math.floor(world.spawn.x),
    z: both ? Math.floor(view!.z!) : Math.floor(world.spawn.z),
    zoom: clampZoom(world.zoom, ok(view?.zoom) ? view!.zoom! : world.zoom.default)
  };
}

export type StillTile = { key: string; z: number; x: number; y: number; left: number; top: number; size: number };

/**
 * The tiles of a still frame around a view (the server-rendered picture under the live map): `cols` × `rows`
 * tiles around the one that holds the centre, each with its offset in px from the frame's centre.
 */
export function stillTiles(world: MapWorldView, view: MapView, cols = 5, rows = 3): StillTile[] {
  const max = world.zoom.max;
  const tz = Math.min(max, Math.max(world.zoom.min, view.zoom));
  const ppb = pixelsPerBlock(max, view.zoom);
  const span = 512 * 2 ** (max - tz);
  const size = span * ppb;
  const cx = view.x + 0.5;
  const cz = view.z + 0.5;
  const tx = Math.floor(cx / span);
  const ty = Math.floor(cz / span);
  const out: StillTile[] = [];
  for (let j = -(rows >> 1); j <= rows >> 1; j++)
    for (let i = -(cols >> 1); i <= cols >> 1; i++) {
      const x = tx + i;
      const y = ty + j;
      out.push({ key: `${tz}/${x}/${y}`, z: tz, x, y, left: (x * span - cx) * ppb, top: (y * span - cz) * ppb, size });
    }
  return out;
}

/** Offset in px from the frame's centre of a whole block's centre. */
export function stillOffset(world: MapWorldView, view: MapView, b: Block): { left: number; top: number } {
  const ppb = pixelsPerBlock(world.zoom.max, view.zoom);
  return { left: (b.x - view.x) * ppb, top: (b.z - view.z) * ppb };
}

/** A coordinate for the readout: whole, with a real minus sign ("−388"). */
export function coord(n: number): string {
  const v = Math.floor(n);
  return v < 0 ? `−${-v}` : String(v || 0);
}

/** "x 1204, z −388" */
export function readout(b: Block): string {
  return `x ${coord(b.x)}, z ${coord(b.z)}`;
}

/** The shortest turn from one yaw to another, in degrees (−180, 180]. */
export function turn(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The face route of a player, or null when the uuid is not one (never put foreign text in a URL). */
export function faceSrc(uuid: string): string | null {
  return UUID.test(uuid) ? `/img/face/${uuid.toLowerCase()}.png` : null;
}
