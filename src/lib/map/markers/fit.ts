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

/**
 * Whether the box centred on (cx, cz) with half-sizes `hw` × `hh` (all in blocks) lies inside the rectilinear polygon.
 * Touching the outline is inside; crossing it is not.
 */
export function boxInsidePolygon(poly: readonly Corner[], cx: number, cz: number, hw: number, hh: number): boolean {
  const x0 = cx - hw;
  const x1 = cx + hw;
  const z0 = cz - hh;
  const z1 = cz + hh;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i];
    const [bx, bz] = poly[(i + 1) % poly.length];
    if (ax === bx) {
      // a vertical edge cuts the open box when it runs through its width and overlaps its height
      if (ax > x0 && ax < x1 && Math.min(az, bz) < z1 && Math.max(az, bz) > z0) return false;
    } else if (az === bz) {
      if (az > z0 && az < z1 && Math.min(ax, bx) < x1 && Math.max(ax, bx) > x0) return false;
    } else {
      // not a block-grid edge (cakeutils never sends one): refuse rather than guess
      return false;
    }
  }
  return insidePolygon(poly, cx, cz);
}

const pxBox = (w: number, h: number, k: number) => ({ w: w * k + 2 * PAD * k, h: h * k + 2 * PAD * k });

/**
 * The title for one area at one zoom, or null when it does not fit.
 * `ppb` is screen pixels per block; `label` is where cakeutils puts the title (the pole of inaccessibility).
 */
export function fitLabel(o: { polygon: readonly Corner[]; label: MarkerLabelAnchor; title: string; ppb: number; uni?: Uni }): LabelFit | null {
  const { polygon, label, title, ppb, uni } = o;
  if (!(ppb > 0) || polygon.length < 4 || title.trim() === "") return null;
  const fits = (w: number, h: number) => boxInsidePolygon(polygon, label.x, label.z, w / 2 / ppb, h / 2 / ppb);

  // one line: the whole title at the biggest scale that fits
  const one = measureTitle(title, undefined, uni);
  for (const k of SCALES) {
    const b = pxBox(one.w, one.h, k);
    if (fits(b.w, b.h)) return { k, lines: lineTexts(labelLines(title, undefined, uni)) };
  }

  // two lines: the widest box of two lines' height that fits tells where to wrap
  for (const k of TWO_LINE_SCALES) {
    const heightPx = pxBox(0, 18, k).h;
    let lo = 0;
    let hi = Math.ceil(one.w * k + 2 * PAD * k); // wider than the one-line box would be pointless: it already failed
    if (!fits(lo + 1, heightPx)) continue;
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
    if (fits(b.w, b.h)) return { k, lines: lineTexts(lines) };
  }
  return null;
}

export type { Scale };
