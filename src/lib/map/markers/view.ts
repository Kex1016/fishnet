// cakeutils' MapMarker → the layer's MarkerView (FMK-0; brief §2, MARKERS §3.2), pure and defensive: a row the site
// cannot draw is left out, never a crash (fishnet rule: unknown fields and kinds are ignored). Nothing here parses
// text: `title` and `subtitle` pass through untouched.
import type { MapMarker } from "#lib/api/types.ts";
import type { Corner, MarkerView } from "./types.ts";

const int = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** `#rrggbb`, lower case, or a neutral grey: a colour the CSS and the label tint can always parse. */
function colour(c: unknown): string {
  return typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : "#808080";
}

/** The corners of a polygon as cakeutils sent them, or null unless every vertex is a pair of integers (≥ 4 of them). */
function corners(p: unknown): Corner[] | null {
  if (!Array.isArray(p) || p.length < 4) return null;
  const out: Corner[] = [];
  for (const v of p) {
    if (!Array.isArray(v) || v.length !== 2 || !int(v[0]) || !int(v[1])) return null;
    out.push([v[0], v[1]]);
  }
  return out;
}

/** One marker ready to draw, or null when it has no usable geometry. */
export function markerView(m: MapMarker): MarkerView | null {
  if (!m || !int(m.id) || typeof m.title !== "string") return null;
  const b = m.bbox;
  if (!b || !int(b.min_x) || !int(b.min_z) || !int(b.max_x) || !int(b.max_z) || b.max_x <= b.min_x || b.max_z <= b.min_z) return null;
  const point = m.point && int(m.point.x) && int(m.point.y) && int(m.point.z) ? { x: m.point.x, y: m.point.y, z: m.point.z } : null;
  const polygon = corners(m.polygon);
  const l = m.label;
  const label = polygon && l && num(l.x) && num(l.z) && num(l.r) ? { x: l.x, z: l.z, r: l.r } : null;
  // the kind decides when it is one we know and its geometry is there; anything else is drawn by its geometry
  const kind = m.kind === "point" && point ? "point" : (m.kind === "area" || m.kind === "poly") && polygon ? m.kind : point ? "point" : polygon ? "poly" : null;
  if (!kind) return null;
  return {
    id: m.id,
    kind,
    title: m.title,
    subtitle: typeof m.subtitle === "string" && m.subtitle !== "" ? m.subtitle : null,
    color: colour(m.color),
    colorAuto: m.color_auto === true,
    point: kind === "point" ? point : null,
    polygon: kind === "point" ? null : polygon,
    label: kind === "point" ? null : label,
    bbox: { minX: b.min_x, minZ: b.min_z, maxX: b.max_x, maxZ: b.max_z },
    size: { w: b.max_x - b.min_x, d: b.max_z - b.min_z },
    updatedAt: num(m.updated_at) ? m.updated_at : 0,
    revision: int(m.revision) ? m.revision : 1
  };
}

/** Every drawable marker, in the order given (cakeutils sends them by id). */
export function markerViews(list: readonly MapMarker[]): MarkerView[] {
  const out: MarkerView[] = [];
  for (const m of list) {
    const v = markerView(m);
    if (v) out.push(v);
  }
  return out;
}

/**
 * The draw order (brief §5.2): larger areas first so a small area inside a big one stays on top and clickable, points
 * above every area; equal sizes by id. A new array.
 */
export function drawOrder(views: readonly MarkerView[]): MarkerView[] {
  const rank = (v: MarkerView) => (v.kind === "point" ? 1 : 0);
  const size = (v: MarkerView) => v.size.w * v.size.d;
  return [...views].sort((a, b) => rank(a) - rank(b) || size(b) - size(a) || a.id - b.id);
}
