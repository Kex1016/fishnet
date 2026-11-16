// Whether an area's title fits at the current zoom (brief §5.2), pure: no Leaflet, runs on the server, in the browser
// and in bun:test. The rule, for `p` screen pixels per block (crs.ts `pixelsPerBlock`):
//   1. k = 4, 3, 2, 1 (screen pixels per font pixel; a whole number keeps the font crisp): the title's box is
//      (width + 1) · k by 9 · k px (McLabel's `measureTitle`: the +1 and the 9th row are the shadow), plus 2 · k of
//      padding on every side. The first k whose box, centred on the label point, lies entirely inside the polygon wins.
//   2. none at k = 1: two lines at k = 2, then 1, wrapped at the widest width that still fits (`layoutPage`'s soft wrap).
//   3. still none: no label at this zoom (the area's popup and the Places list still name it).
// Polygons are rectilinear (every edge on a block border, MARKERS §4.2), which makes "a box lies inside" cheap and exact:
// no edge may cross the open box, and the box's centre must be inside.
import type { Uni } from "#lib/onesoul/book/layout.ts";
import { labelLines, lineTexts, measureLabel, measureTitle, SCALES, type Scale } from "./McLabel.ts";
import type { Corner, LabelFit, MarkerLabelAnchor } from "./types.ts";

/** Padding around the title's box, in screen pixels per `k` (brief §5.2: 2 · k on each side). */
export const PAD = 2;
/** The two-line forms are tried at these scales, in this order. */
export const TWO_LINE_SCALES = [2, 1] as const;

/** Even-odd containment of a point that no edge touches (the caller has ruled that out). */
function insidePolygon(poly: readonly Corner[], px: number, pz: number): boolean {
  let n = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    // a ray towards +x crosses the vertical edges to the right of the point; [lo, hi) keeps a vertex from counting twice
    if (x1 === x2 && x1 > px && pz >= Math.min(z1, z2) && pz < Math.max(z1, z2)) n++;
  }
  return n % 2 === 1;
}

/** Whether any edge runs through the open box (touching its border does not count). A diagonal edge counts: cakeutils never sends one. */
function edgeThroughBox(poly: readonly Corner[], x0: number, x1: number, z0: number, z1: number): boolean {
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i];
    const [bx, bz] = poly[(i + 1) % poly.length];
    if (ax === bx) {
      // a vertical edge cuts the open box when it runs through its width and overlaps its height
      if (ax > x0 && ax < x1 && Math.min(az, bz) < z1 && Math.max(az, bz) > z0) return true;
    } else if (az === bz) {
      if (az > z0 && az < z1 && Math.min(ax, bx) < x1 && Math.max(ax, bx) > x0) return true;
    } else return true;
  }
  return false;
}

/** A box in blocks: its centre and half-sizes. */
export type LabelBox = { cx: number; cz: number; hw: number; hh: number };

/**
 * Whether the box centred on (cx, cz) with half-sizes `hw` × `hh` (all in blocks) lies inside the rectilinear polygon.
 * Touching the outline is inside; crossing it is not.
 */
export function boxInsidePolygon(poly: readonly Corner[], cx: number, cz: number, hw: number, hh: number): boolean {
  if (edgeThroughBox(poly, cx - hw, cx + hw, cz - hh, cz + hh)) return false;
  return insidePolygon(poly, cx, cz);
}

/** Whether the box and the polygon share any area (touching along an edge is not sharing). */
export function boxOverlapsPolygon(poly: readonly Corner[], cx: number, cz: number, hw: number, hh: number): boolean {
  return edgeThroughBox(poly, cx - hw, cx + hw, cz - hh, cz + hh) || insidePolygon(poly, cx, cz);
}

/** Whether two boxes share any area (touching is not sharing). */
export function boxesOverlap(a: LabelBox, b: LabelBox): boolean {
  return Math.abs(a.cx - b.cx) < a.hw + b.hw && Math.abs(a.cz - b.cz) < a.hh + b.hh;
}

/** What a title must keep clear of: areas drawn above its own (brief §5.2: a title never runs across a smaller area on top of its area) and titles already placed. */
export type Avoid = { above?: readonly (readonly Corner[])[]; placed?: readonly LabelBox[] };

const pxBox = (w: number, h: number, k: number) => ({ w: w * k + 2 * PAD * k, h: h * k + 2 * PAD * k });

export type Placed = { fit: LabelFit; box: LabelBox };

/**
 * The title for one area at one zoom with its box, or null when it does not fit. A candidate (one line at k 4..1, then
 * two lines at k 2, 1) is taken when its box, centred on the label point, lies inside the area, crosses none of the
 * areas drawn above it (`avoid.above`) and overlaps no title already placed (`avoid.placed`).
 * `ppb` is screen pixels per block; `label` is where cakeutils puts the title (the pole of inaccessibility).
 */
export function placeLabel(o: { polygon: readonly Corner[]; label: MarkerLabelAnchor; title: string; ppb: number; uni?: Uni } & Avoid): Placed | null {
  const { polygon, label, title, ppb, uni } = o;
  if (!(ppb > 0) || polygon.length < 4 || title.trim() === "") return null;
  const above = o.above ?? [];
  const placed = o.placed ?? [];
  const boxAt = (w: number, h: number): LabelBox => ({ cx: label.x, cz: label.z, hw: w / 2 / ppb, hh: h / 2 / ppb });
  const fits = (w: number, h: number) => {
    const b = boxAt(w, h);
    if (!boxInsidePolygon(polygon, b.cx, b.cz, b.hw, b.hh)) return false;
    for (const a of above) if (boxOverlapsPolygon(a, b.cx, b.cz, b.hw, b.hh)) return false;
    for (const p of placed) if (boxesOverlap(b, p)) return false;
    return true;
  };

  // one line: the whole title at the biggest scale that fits
  const one = measureTitle(title, undefined, uni);
  for (const k of SCALES) {
    const b = pxBox(one.w, one.h, k);
    if (fits(b.w, b.h)) return { fit: { k, lines: lineTexts(labelLines(title, undefined, uni)) }, box: boxAt(b.w, b.h) };
  }

  // two lines: the widest box of two lines' height that fits tells where to wrap
  for (const k of TWO_LINE_SCALES) {
    const heightPx = pxBox(0, 18, k).h;
    let lo = 0;
    let hi = Math.ceil(one.w * k + 2 * PAD * k); // wider than the one-line box would be pointless: it already failed
    if (!fits(lo + 1, heightPx)) continue;
    // growing a box about its centre only ever adds ground, so "fits" is monotone in the width
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (fits(mid, heightPx)) lo = mid;
      else hi = mid;
    }
    // inner width in font pixels, minus the shadow column
    const wrap = Math.floor((lo - 2 * PAD * k) / k) - 1;
    if (wrap < 8) continue;
    const lines = labelLines(title, wrap, uni);
    if (lines.length !== 2) continue;
    const box = measureLabel(lines);
    const b = pxBox(box.w, box.h, k);
    if (fits(b.w, b.h)) return { fit: { k, lines: lineTexts(lines) }, box: boxAt(b.w, b.h) };
  }
  return null;
}

/** The title alone (nothing to keep clear of); see `placeLabel`. */
export function fitLabel(o: { polygon: readonly Corner[]; label: MarkerLabelAnchor; title: string; ppb: number; uni?: Uni } & Avoid): LabelFit | null {
  return placeLabel(o)?.fit ?? null;
}

export type FitArea = { polygon: readonly Corner[]; label: MarkerLabelAnchor | null; title: string };

/**
 * The titles of a world's areas at one zoom. `areas` are in draw order (view.ts `drawOrder`: later = drawn above).
 * They are placed in reverse, smallest area on top first, so each title keeps clear of every area drawn above its own and
 * of every title already placed; an area that cannot place a title without crossing one gets none. One entry per area.
 */
export function fitLabels(areas: readonly FitArea[], ppb: number, uni?: Uni): (LabelFit | null)[] {
  const out: (LabelFit | null)[] = areas.map(() => null);
  const shapes = areas.map((a) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const [x, z] of a.polygon) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    return { poly: a.polygon, minX, maxX, minZ, maxZ };
  });
  const placed: LabelBox[] = [];
  for (let i = areas.length - 1; i >= 0; i--) {
    const a = areas[i];
    if (!a.label) continue;
    // only the areas above whose corners could reach this title matter; the box can never be wider than its own area
    const s = shapes[i];
    const above = shapes.slice(i + 1).filter((o) => o.minX < s.maxX && o.maxX > s.minX && o.minZ < s.maxZ && o.maxZ > s.minZ).map((o) => o.poly);
    const r = placeLabel({ polygon: a.polygon, label: a.label, title: a.title, ppb, uni, above, placed });
    if (!r) continue;
    out[i] = r.fit;
    placed.push(r.box);
  }
  return out;
}

export type { Scale };
