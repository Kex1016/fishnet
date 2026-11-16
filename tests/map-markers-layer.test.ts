// FMK-2: the marker layer's pure parts, on cakeutils' real answers (tests/fixtures/markers/, captured by cakeutils MK-41 on
// branch claude/map-markers, v2/map/fixtures/markers/): what `markerView` makes of them, the fit rule (fit.ts) against an
// independent raster oracle, the words (text.ts) and the mock's agreement with the fixtures. The drawing itself (pixels,
// popups, keyboard, deep links) is checked in a browser: scripts/map-markers-check.ts.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { MapMarkers } from "#lib/api/types.ts";
import { centreLatLng, pixelsPerBlock, toLatLng } from "#lib/map/crs.ts";
import { boxInsidePolygon, fitLabel, PAD } from "#lib/map/markers/fit.ts";
import { measureLabel, measureTitle, labelLines, SCALES } from "#lib/map/markers/McLabel.ts";
import { kindText, markerName, sizeText, whereText } from "#lib/map/markers/text.ts";
import type { Corner, MarkerView } from "#lib/map/markers/types.ts";
import { drawOrder, markerViews } from "#lib/map/markers/view.ts";
import { area, point, poleOf, poly } from "#lib/server/cakeutils/mock/markers.ts";
import { generateMarkersBusy } from "#lib/server/cakeutils/mock/markers.ts";

const fx = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/markers/${name}`, import.meta.url), "utf8"));
const overworld = fx("markers-overworld.json") as MapMarkers;
const legacy = fx("markers-end-legacy-codes.json") as MapMarkers;
const views = markerViews(overworld.markers);
const byId = (id: number) => views.find((v) => v.id === id)!;

describe("the real fixtures through markerView", () => {
  test("every row of the overworld answer is drawable, in cakeutils' order", () => {
    expect(views.map((v) => v.id)).toEqual([2, 3, 4, 5, 6]);
    expect(views.map((v) => v.kind)).toEqual(["point", "point", "area", "poly", "point"]);
  });

  test("a point is a block: drawn at its centre, size 1 × 1, its bbox is the block", () => {
    const s = byId(2);
    expect(s.point).toEqual({ x: 10, y: 100, z: 20 });
    expect(s.polygon).toBeNull();
    expect(s.label).toBeNull();
    expect(s.bbox).toEqual({ minX: 10, minZ: 20, maxX: 11, maxZ: 21 });
    expect(s.size).toEqual({ w: 1, d: 1 });
    // the centre of block (10, 20) is the corner (10.5, 20.5), whatever the world's zoom
    expect(centreLatLng(3, s.point!)).toEqual(toLatLng(3, 10.5, 20.5));
    expect(s.color).toBe("#b02e26");
    expect(s.colorAuto).toBe(false);
    expect(byId(3).colorAuto).toBe(true);
    expect(byId(3).subtitle).toBeNull();
  });

  test("an area: corners straight from the polygon, label = the centre, r = half the shorter side, size from the inclusive bounds", () => {
    const farm = byId(4);
    expect(farm.polygon).toEqual([[100, 100], [100, 110], [110, 110], [110, 100]]);
    expect(farm.label).toEqual({ x: 105, z: 105, r: 5 });
    expect(farm.size).toEqual({ w: 10, d: 10 });
    expect(farm.bbox).toEqual({ minX: 100, minZ: 100, maxX: 110, maxZ: 110 });
    const sh = Math.min(farm.size.w, farm.size.d) / 2;
    expect(farm.label!.r).toBe(sh);
    expect(farm.label!.x).toBe((farm.bbox.minX + farm.bbox.maxX) / 2);
    expect(farm.label!.z).toBe((farm.bbox.minZ + farm.bbox.maxZ) / 2);
  });

  test("the zig-zag: 32 corners, every edge on the block grid, counter-clockwise from the lowest-z then lowest-x corner", () => {
    const zig = byId(5);
    const p = zig.polygon!;
    expect(p).toHaveLength(32);
    for (let i = 0; i < p.length; i++) {
      const [ax, az] = p[i];
      const [bx, bz] = p[(i + 1) % p.length];
      expect(ax === bx || az === bz).toBe(true); // axis-aligned: a diagonal is already a staircase
      expect(ax === bx && az === bz).toBe(false); // no repeated corner
    }
    expect(p[0]).toEqual([200, 200]);
    const lowest = p.reduce((a, c) => (c[1] < a[1] || (c[1] === a[1] && c[0] < a[0]) ? c : a));
    expect(lowest).toEqual(p[0]);
    // counter-clockwise as drawn (x right, z down) = a negative shoelace sum
    let sum = 0;
    for (let i = 0; i < p.length; i++) sum += p[i][0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * p[i][1];
    expect(sum).toBeLessThan(0);
    expect(zig.bbox).toEqual({ minX: 198, minZ: 200, maxX: 213, maxZ: 211 });
    expect(zig.size).toEqual({ w: 15, d: 11 });
    expect(zig.label).toEqual({ x: 205.5, z: 204.5, r: 4.5 });
    expect(zig.kind).toBe("poly");
  });

  test("text is literal: markup, ampersands and colour codes arrive as typed", () => {
    expect(byId(6).title).toBe("<red>Hue&c");
    expect(byId(6).subtitle).toBe("<b>Bold</b> &a green");
    const end = markerViews(legacy.markers)[0];
    expect(end.title).toBe("§cSection <red>sign");
    expect(end.subtitle).toBe("&aLegacy and <b>tags</b>");
    // nothing in the words around them rewrites a title
    expect(markerName(byId(6))).toBe("<red>Hue&c, point");
    expect(markerName(end)).toBe("§cSection <red>sign, point");
  });

  test("an empty world is an empty list; the 404 answers are the same problem", () => {
    expect(markerViews((fx("markers-empty.json") as MapMarkers).markers)).toEqual([]);
    expect(fx("markers-404-unknown-world.json")).toEqual(fx("markers-404-standalone.json"));
  });

  test("draw order (and the Places and tab order): areas by size, largest first, then pins", () => {
    expect(drawOrder(views).map((v) => v.id)).toEqual([5, 4, 2, 3, 6]);
  });
});

describe("the popup's words", () => {
  test("a point, an area, a polygon", () => {
    expect(kindText(byId(2))).toBe("Point");
    expect(whereText(byId(2))).toBe("x 10, y 100, z 20");
    expect(kindText(byId(4))).toBe("Area, 10 × 10 blocks");
    expect(whereText(byId(4))).toBe("x 100 to 109, z 100 to 109");
    expect(markerName(byId(4))).toBe("Farm, area, 10 × 10 blocks");
    expect(sizeText(byId(5))).toBe("15 × 11 blocks");
  });
  test("negative coordinates use a real minus sign", () => {
    const m = markerViews([point({ id: 1, title: "Cave", color: "#336699", created: 0 }, 120, 64, -40)])[0];
    expect(whereText(m)).toBe("x 120, y 64, z −40");
  });
});

// ---- the fit rule against an oracle that knows nothing of fit.ts: the polygon rasterised into block cells

function insideCell(p: readonly Corner[], x: number, z: number): boolean {
  const cx = x + 0.5;
  const cz = z + 0.5;
  let n = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, z1] = p[i];
    const [x2, z2] = p[(i + 1) % p.length];
    if (x1 === x2 && x1 > cx && cz > Math.min(z1, z2) && cz < Math.max(z1, z2)) n++;
  }
  return n % 2 === 1;
}
/** A box is inside when every block cell it overlaps is inside the polygon. */
function oracle(p: readonly Corner[], cx: number, cz: number, hw: number, hh: number): boolean {
  for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++)
    for (let z = Math.floor(cz - hh); z < Math.ceil(cz + hh); z++) if (!insideCell(p, x, z)) return false;
  return true;
}

const ZIG = byId(5).polygon!;
const L_SHAPE: Corner[] = [[0, 0], [0, 12], [6, 12], [6, 5], [14, 5], [14, 0]];

describe("boxInsidePolygon", () => {
  test("agrees with the raster oracle on the zig-zag and an L shape, on a grid of boxes", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    let inside = 0;
    let outside = 0;
    for (const poly of [ZIG, L_SHAPE]) {
      const xs = poly.map((c) => c[0]);
      const zs = poly.map((c) => c[1]);
      for (let i = 0; i < 1500; i++) {
        const cx = Math.min(...xs) + Math.round(rnd() * (Math.max(...xs) - Math.min(...xs)) * 4) / 4;
        const cz = Math.min(...zs) + Math.round(rnd() * (Math.max(...zs) - Math.min(...zs)) * 4) / 4;
        const hw = (1 + Math.floor(rnd() * 24)) / 4;
        const hh = (1 + Math.floor(rnd() * 24)) / 4;
        const want = oracle(poly, cx, cz, hw, hh);
        expect(boxInsidePolygon(poly, cx, cz, hw, hh)).toBe(want);
        want ? inside++ : outside++;
      }
    }
    expect(inside).toBeGreaterThan(50); // the test exercises both answers
    expect(outside).toBeGreaterThan(50);
  });

  test("touching the outline is inside, crossing it is not", () => {
    const r: Corner[] = [[0, 0], [0, 10], [10, 10], [10, 0]];
    expect(boxInsidePolygon(r, 5, 5, 5, 5)).toBe(true);
    expect(boxInsidePolygon(r, 5, 5, 5.01, 5)).toBe(false);
    expect(boxInsidePolygon(r, 15, 5, 2, 2)).toBe(false); // wholly outside
    // a diagonal edge is refused rather than guessed (cakeutils never sends one)
    expect(boxInsidePolygon([[0, 0], [0, 10], [10, 10], [10, 0], [5, -3]], 5, 5, 1, 1)).toBe(false);
  });
});

/** The first scale whose one-line box (title + shadow, plus padding) fits a w × d block rectangle centred on its label. */
function expectedScale(title: string, w: number, d: number, ppb: number): number | null {
  const b = measureTitle(title);
  for (const k of SCALES) if ((b.w * k + 2 * PAD * k) / ppb <= w && (b.h * k + 2 * PAD * k) / ppb <= d) return k;
  return null;
}
const rect = (w: number, d: number): Corner[] => [[0, 0], [0, d], [w, d], [w, 0]];

describe("fitLabel (brief §5.2)", () => {
  const PPB = [0.25, 0.5, 1, 2, 4, 8, 16, 32];

  test("one line: the biggest whole scale that fits, at every zoom (Farm, 10 × 10)", () => {
    const farm = byId(4);
    const got = PPB.map((ppb) => fitLabel({ polygon: farm.polygon!, label: farm.label!, title: farm.title, ppb })?.k ?? null);
    expect(got as (number | null)[]).toEqual(PPB.map((ppb) => expectedScale("Farm", 10, 10, ppb)));
    expect(got.some((k) => k === null)).toBe(true); // far out: no label
    expect(new Set(got.filter(Boolean)).size).toBeGreaterThanOrEqual(3); // and several scales in between
    for (const ppb of PPB) {
      const f = fitLabel({ polygon: farm.polygon!, label: farm.label!, title: "Farm", ppb });
      if (f) expect(f.lines).toEqual(["Farm"]);
    }
  });

  test("scales get smaller as the map zooms out, never larger", () => {
    const farm = byId(4);
    let last = 5;
    for (const ppb of [...PPB].reverse()) {
      const k = fitLabel({ polygon: farm.polygon!, label: farm.label!, title: "Farm", ppb })?.k ?? 0;
      expect(k).toBeLessThanOrEqual(last);
      last = k;
    }
  });

  test("a 2 × 2 area never gets a title at any zoom the map has (at most 4 px per block); its popup and the list still name it", () => {
    const tiny = rect(2, 2);
    for (const ppb of PPB.filter((p) => p <= 4)) expect(fitLabel({ polygon: tiny, label: { x: 1, z: 1, r: 1 }, title: "Well", ppb })).toBeNull();
  });

  test("a long title wraps onto two lines before it is dropped, and hides when even that does not fit", () => {
    const title = "Spawn town and the surrounding fields of the northern realm";
    const label = (w: number, d: number) => ({ x: w / 2, z: d / 2, r: Math.min(w, d) / 2 });
    const one = measureTitle(title);
    // 128 × 96 at 4 px per block: one line fits only at k = 1 (the mock's big area at the deepest zoom)
    expect(fitLabel({ polygon: rect(128, 96), label: label(128, 96), title, ppb: 4 })).toEqual({ k: 1, lines: [title] });
    // narrower than one line at k = 1 but wide enough for two: two lines, nothing lost, each line inside the area
    const w = Math.round((one.w + 4) / 1.4);
    const f = fitLabel({ polygon: rect(w, 40), label: label(w, 40), title, ppb: 1 })!;
    expect(f).not.toBeNull();
    expect(f.lines).toHaveLength(2);
    expect(f.lines.join(" ")).toBe(title);
    const box = measureLabel(labelLines(f.lines.join(" "), undefined)); // sanity: the one-line box is wider than the area
    expect(box.w + 2 * PAD).toBeGreaterThan(w);
    for (const line of f.lines) expect(measureTitle(line).w + 2 * PAD * f.k).toBeLessThanOrEqual(w * 1 + 0.001);
    // too narrow even for two lines: no label
    expect(fitLabel({ polygon: rect(12, 40), label: label(12, 40), title, ppb: 1 })).toBeNull();
  });

  test("a polygon's title is placed against its real outline: whatever fits is inside by the oracle, and nothing bigger would be", () => {
    const zig = byId(5);
    const ppbs = [2, 4, 8, 12, 16, 24, 32];
    let fitted = 0;
    for (const ppb of ppbs) {
      const f = fitLabel({ polygon: zig.polygon!, label: zig.label!, title: "Zig", ppb });
      const b = measureTitle("Zig");
      const inside = (k: number) => oracle(zig.polygon!, zig.label!.x, zig.label!.z, ((b.w * k + 2 * PAD * k) / ppb) / 2, ((b.h * k + 2 * PAD * k) / ppb) / 2);
      if (f) {
        fitted++;
        expect(inside(f.k)).toBe(true);
        for (const k of SCALES) if (k > f.k) expect(inside(k)).toBe(false);
      } else for (const k of SCALES) expect(inside(k)).toBe(false);
    }
    expect(fitted).toBeGreaterThan(0);
    expect(fitted).toBeLessThan(ppbs.length);
  });

  test("at the zoom ppb comes from, pixels per block is what crs.ts says", () => {
    expect(pixelsPerBlock(3, 5)).toBe(4);
    expect(pixelsPerBlock(3, 3)).toBe(1);
    expect(pixelsPerBlock(3, 0)).toBe(0.125);
  });
});

describe("the mock agrees with the real fixtures", () => {
  test("rows have the very same keys; a rectangle's corners, label and bbox are identical", () => {
    const farm = overworld.markers.find((m) => m.id === 4)!;
    const a = area({ id: 4, title: "Farm", subtitle: "Wheat", color: "#3a7d44", created: farm.created_at }, 100, 100, 109, 109);
    expect(Object.keys(a).sort()).toEqual(Object.keys(farm).sort());
    expect(a).toEqual(farm);
    const spawn = overworld.markers.find((m) => m.id === 2)!;
    expect(point({ id: 2, title: "Spawn", subtitle: "Meeting point", color: "#b02e26", created: spawn.created_at }, 10, 100, 20)).toEqual(spawn);
    const zig = overworld.markers.find((m) => m.id === 5)!;
    const z = poly({ id: 5, title: "Zig", color: "#3c44aa", created: zig.created_at }, zig.polygon as [number, number][]);
    expect(Object.keys(z).sort()).toEqual(Object.keys(zig).sort());
    expect(z.bbox).toEqual(zig.bbox);
  });

  test("a polygon's label: the mock's scan finds the pole within half a block of cakeutils' (MARKERS §4.4: about 0.5 block precision)", () => {
    const zig = overworld.markers.find((m) => m.id === 5)!;
    const mock = poleOf(zig.polygon as [number, number][]);
    expect(Math.abs(mock.x - zig.label!.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(mock.z - zig.label!.z)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(mock.r - zig.label!.r)).toBeLessThanOrEqual(0.25);
  });

  test("the busy world draws: every marker has geometry the layer can use, labels sit inside their areas", () => {
    for (const set of generateMarkersBusy()) {
      for (const v of markerViews(set.markers)) {
        if (v.kind === "point") continue;
        expect(boxInsidePolygon(v.polygon!, v.label!.x, v.label!.z, 0.01, 0.01)).toBe(true);
      }
    }
  });
});
