// The mock's map markers (FMK-0): GET /v2/map/{server}/worlds/{world}/markers, answered the way cakeutils
// v2/map/MARKERS.md §3 says (shape §3.2, no oracle §3.3, ETag "m<rev>" and 304 §3.4) with geometry that obeys §4:
// corners, counter-clockwise as drawn (x right, z down), starting at the lowest-z then lowest-x corner, every edge
// axis-aligned, no collinear or repeated vertices, simple; an area's polygon is its 4 corners and its label its centre
// with r = min(w, d) / 2 (MAPD-59/61); a polygon's label is the point farthest from every edge (found by a 0.5-block
// scan here; cakeutils uses polylabel, so label positions may differ in the last half block). Mock only.
//
// fresh: no markers anywhere (`markers: []`, rev 0).
// busy:  survival's overworld, the nether, the public mini world, and the hidden server "staff" (markers the site must
//        never show: they are only here so tests can prove it).
import type { MapMarker, MapMarkers } from "#lib/api/types.ts";

/** One world's markers as the mock keeps them. A world without an entry has none (`rev` 0). */
export type MockMarkerSet = { server: string; world: string; rev: number; markers: MapMarker[] };

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 1);
const at = (days: number, hour = 12) => T0 + days * DAY + hour * 3_600_000;

type Corner = [number, number];

/** A bounding box of corners. */
function boxOf(poly: Corner[]) {
  const xs = poly.map((c) => c[0]);
  const zs = poly.map((c) => c[1]);
  return { min_x: Math.min(...xs), min_z: Math.min(...zs), max_x: Math.max(...xs), max_z: Math.max(...zs) };
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

type Common = { id: number; title: string; subtitle?: string | null; color: string; color_auto?: boolean; created: number; updated?: number; revision?: number };

function base(c: Common) {
  return {
    id: c.id,
    title: c.title,
    subtitle: c.subtitle ?? null,
    color: c.color,
    color_auto: c.color_auto ?? false,
    created_at: c.created,
    updated_at: c.updated ?? c.created,
    revision: c.revision ?? 1
  };
}

/** A point: the block (x, y, z); its bbox is the block as corners. */
export function point(c: Common, x: number, y: number, z: number): MapMarker {
  return { ...base(c), kind: "point", point: { x, y, z }, bounds: null, polygon: null, label: null, bbox: { min_x: x, min_z: z, max_x: x + 1, max_z: z + 1 } };
}

/** A rectangle of blocks min..max inclusive in both axes (MARKERS §4.1). */
export function area(c: Common, minX: number, minZ: number, maxX: number, maxZ: number): MapMarker {
  const w = maxX - minX + 1;
  const d = maxZ - minZ + 1;
  return {
    ...base(c),
    kind: "area",
    point: null,
    bounds: { min_x: minX, min_z: minZ, max_x: maxX, max_z: maxZ },
    polygon: [[minX, minZ], [minX, maxZ + 1], [maxX + 1, maxZ + 1], [maxX + 1, minZ]],
    label: { x: round3(minX + w / 2), z: round3(minZ + d / 2), r: round3(Math.min(w, d) / 2) },
    bbox: { min_x: minX, min_z: minZ, max_x: maxX + 1, max_z: maxZ + 1 }
  };
}

/** A block-grid polygon from corners already in the §4 order (checked by tests, not repaired here). */
export function poly(c: Common, corners: Corner[]): MapMarker {
  return { ...base(c), kind: "poly", point: null, bounds: null, polygon: corners, label: poleOf(corners), bbox: boxOf(corners) };
}

/** Even-odd containment of (px, pz) in a rectilinear polygon; points on the boundary count as outside. */
function inside(poly: Corner[], px: number, pz: number): boolean {
  let n = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    if (x1 === x2 && px < x1 && pz >= Math.min(z1, z2) && pz < Math.max(z1, z2)) n++;
  }
  return n % 2 === 1;
}

function distToEdges(poly: Corner[], px: number, pz: number): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    const cx = Math.min(Math.max(px, Math.min(x1, x2)), Math.max(x1, x2));
    const cz = Math.min(Math.max(pz, Math.min(z1, z2)), Math.max(z1, z2));
    best = Math.min(best, Math.hypot(px - cx, pz - cz));
  }
  return best;
}

/** The point inside farthest from any edge, on a 0.5-block grid; ties go to the lower z, then the lower x (MARKERS §4.4). */
export function poleOf(corners: Corner[]): { x: number; z: number; r: number } {
  const b = boxOf(corners);
  let best = { x: b.min_x + 0.5, z: b.min_z + 0.5, r: -1 };
  for (let z = b.min_z; z <= b.max_z; z += 0.5) {
    for (let x = b.min_x; x <= b.max_x; x += 0.5) {
      if (!inside(corners, x, z)) continue;
      const r = distToEdges(corners, x, z);
      if (r > best.r + 1e-9) best = { x, z, r };
    }
  }
  return { x: round3(best.x), z: round3(best.z), r: round3(best.r) };
}

/** A right triangle of blocks whose long edge is a staircase (a diagonal is a zig-zag, MARKERS §4.2): legs of `n`
 *  blocks, right angle at the lower left, starting at corner (x, z). */
export function stairTriangle(x: number, z: number, n: number): Corner[] {
  const out: Corner[] = [[x, z], [x, z + n], [x + n, z + n]];
  let cx = x + n;
  let cz = z + n;
  for (let i = 0; i < n; i++) {
    cz -= 1;
    out.push([cx, cz]);
    cx -= 1;
    if (i < n - 1) out.push([cx, cz]);
  }
  return out;
}

const NO_STAFF = "STAFF ONLY: never on the public map";

export function generateMarkersFresh(): MockMarkerSet[] {
  return [];
}

export function generateMarkersBusy(): MockMarkerSet[] {
  const overworld: MapMarker[] = [
    point({ id: 1, title: "Spawn", subtitle: "The red block. Everyone starts here.", color: "#e5484d", created: at(0), updated: at(2), revision: 2 }, 64, 72, -32),
    // four lines is the longest subtitle there is (MARKERS §2.2)
    point(
      { id: 2, title: "Farm", subtitle: "Wheat, carrots and one very patient cow\nSouth of the river\nOpen to everyone\nBring a bucket", color: "#33b88f", color_auto: true, created: at(1) },
      -120, 63, 200
    ),
    // markup and colour codes are literal characters: never parsed, never HTML
    point({ id: 3, title: "<b>Shop</b> & §cRed", subtitle: "Prices in diamonds: 3 per stack & a smile", color: "#0090ff", created: at(1, 18) }, -60, 64, -90),
    // the big one, with a title that needs two lines or none (brief §5.2)
    area({ id: 4, title: "Spawn town and the surrounding fields of the northern realm", subtitle: "Where it started. Please keep the roads clear.", color: "#3e63dd", created: at(0, 9) }, 0, -96, 127, -1),
    // inside the big one, 31 × 18 blocks, a very light colour
    area({ id: 5, title: "Market", subtitle: "Open from sunrise.", color: "#f4f1e8", created: at(3) }, 20, -60, 50, -43),
    // 2 × 2 blocks: its title never fits at any zoom, the popup and the list still name it
    area({ id: 6, title: "Well", color: "#ffc53d", created: at(4) }, 96, -40, 97, -39),
    // a diagonal edge as a zig-zag, a very dark colour
    poly({ id: 7, title: "River bend", subtitle: "Deep water. Boats only.", color: "#101826", created: at(5) }, stairTriangle(200, 100, 12)),
    // a long title (63 characters; the limit is 64)
    area({ id: 8, title: "The Great Northern Cathedral of the Lantern Keepers and Ringers", color: "#8e4ec6", created: at(6) }, -300, -200, -261, -171)
  ];
  const nether: MapMarker[] = [area({ id: 10, title: "Fortress", subtitle: "Blaze spawners on the second floor.", color: "#f76b15", created: at(2, 20) }, 8, -12, 39, 11)];
  const mini: MapMarker[] = [point({ id: 11, title: "Island", subtitle: "Start here.", color: "#30a46c", created: at(7) }, 16, 64, 16)];
  const staff: MapMarker[] = [
    point({ id: 20, title: NO_STAFF, subtitle: "never shown", color: "#e5484d", created: at(1) }, 5, 64, 5),
    area({ id: 21, title: `${NO_STAFF} (area)`, color: "#0090ff", created: at(2) }, 0, 0, 15, 15)
  ];
  return [
    { server: "survival", world: "minecraft_overworld", rev: 9, markers: overworld },
    { server: "survival", world: "minecraft_the_nether", rev: 2, markers: nether },
    { server: "survival", world: "cakeutils_miniservers_skyblock-1_overworld", rev: 1, markers: mini },
    { server: "staff", world: "minecraft_overworld", rev: 3, markers: staff }
  ];
}

/** The titles of the hidden server's markers: tests look for them everywhere and must find none. */
export const STAFF_MARKER_TITLES = [NO_STAFF, `${NO_STAFF} (area)`] as const;

/**
 * The answer of one world's markers, as cakeutils builds it. `rev` is the world's change counter (0 without a row).
 * `bump` simulates a change in a clone of the world (FMK-3's tests): it raises `rev`, then applies `edit` to the list.
 */
export function markersAnswer(sets: MockMarkerSet[] | undefined, server: string, world: string): MapMarkers {
  const s = sets?.find((x) => x.server === server && x.world === world);
  return { server, world, rev: s?.rev ?? 0, markers: s ? s.markers : [] };
}

export function bumpMarkers(sets: MockMarkerSet[], server: string, world: string, edit?: (list: MapMarker[]) => MapMarker[]): number {
  let s = sets.find((x) => x.server === server && x.world === world);
  if (!s) sets.push((s = { server, world, rev: 0, markers: [] }));
  s.rev += 1;
  if (edit) s.markers = edit(s.markers);
  return s.rev;
}
