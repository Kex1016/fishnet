// A cakeutils stand-in for the markers e2e checks (FMK-7): the busy fixture server over HTTP (scripts/mock-server.ts)
// with one of two test-only marker sets, and a log of every request it was asked, so a check can prove the site asked
// nothing (a bad `world`, a hidden server). Test-only: nothing here is in the site's build.
//
//   bun tests/e2e/map-markers-upstream.ts hostile <port>   # busy + hostile titles in survival's nether
//   bun tests/e2e/map-markers-upstream.ts stress <port>    # busy, survival's overworld = 1000 markers, about 66 000 corners
//
//   GET  /__e2e/requests          every request so far, "<METHOD> <path>?<query>", oldest first
//   POST /__e2e/reset             forget them
//   POST /__mock/markers/bump?server=&world=   raise a world's rev (as scripts/mock-server.ts)
import { handleMock } from "../../src/lib/server/cakeutils/mock/handler.ts";
import { area, bumpMarkers, point, type MockMarkerSet } from "../../src/lib/server/cakeutils/mock/markers.ts";
import { worldOf } from "../../src/lib/server/cakeutils/mock/index.ts";
import type { MapMarker } from "../../src/lib/api/types.ts";

const variant = process.argv[2];
const port = Number(process.argv[3] ?? 8086);
if (variant !== "hostile" && variant !== "stress") {
  console.error("usage: map-markers-upstream.ts hostile|stress <port>");
  process.exit(2);
}

const world = worldOf("busy");
const sets = world.map!.markers as MockMarkerSet[];
const T = Date.UTC(2026, 10, 10, 12);
const set = (server: string, w: string): MockMarkerSet => {
  let s = sets.find((x) => x.server === server && x.world === w);
  if (!s) sets.push((s = { server, world: w, rev: 0, markers: [] }));
  return s;
};

/** Titles that would be markup, script or colour codes anywhere they were parsed (brief FMK-7 §2). */
const HOSTILE = [
  { id: 30, title: "<img src=x onerror=window.__pwned=1>", subtitle: "<img src=x onerror=window.__pwned=2>\n</script><script>window.__pwned=3</script>\n&amp; &lt;b&gt; {@html x}" },
  { id: 31, title: "</script><script>window.__pwned=4</script>", subtitle: "\"><svg onload=window.__pwned=5>" },
  { id: 32, title: "§cRed §lbold &a amp <red>tag</red>", subtitle: "§k§r&r ${x} {{x}} <!-- c -->" },
  { id: 33, title: "Café 東京 Ελλάδα Привет ☃ ½", subtitle: "Ünïcödé lines\nzweite Zeile" }
] as const;

if (variant === "hostile") {
  const nether = set("survival", "minecraft_the_nether");
  const c = (h: (typeof HOSTILE)[number], i: number) => ({ id: h.id, title: h.title, subtitle: h.subtitle, // 31's colour is not a colour: the site must draw it grey, never put it into CSS as sent
    color: ["#e5484d", "#0090ff;background:url(https://evil.invalid/x)", "#30a46c", "#f4f1e8"][i], created: T, updated: T });
  nether.markers = [
    ...nether.markers,
    // big areas so their titles are drawn (labels), and points so they are pins
    area(c(HOSTILE[0], 0), -200, -200, -41, -121),
    point(c(HOSTILE[1], 1), 60, 70, 60),
    area(c(HOSTILE[2], 2), -200, 40, -41, 119),
    area(c(HOSTILE[3], 3), 60, -200, 219, -121)
  ].sort((a, b) => a.id - b.id);
  nether.rev += 1;
}

// ---- the stress world: 1000 markers (the per-world limit) and big staircase polygons (brief §2.4)

type Corner = [number, number];

/** A disc of blocks of radius r around (cx, cz) as one block-grid ring: left side down, right side up, no collinear
 *  or repeated corners (MARKERS §4.2). */
function disc(cx: number, cz: number, r: number): Corner[] {
  const rows: { z: number; l: number; r: number }[] = [];
  for (let dz = -r; dz < r; dz++) {
    const w = Math.floor(Math.sqrt(r * r - (dz + 0.5) ** 2));
    if (w > 0) rows.push({ z: cz + dz, l: cx - w, r: cx + w });
  }
  const path: Corner[] = [];
  for (const row of rows) path.push([row.l, row.z], [row.l, row.z + 1]);
  for (const row of [...rows].reverse()) path.push([row.r, row.z + 1], [row.r, row.z]);
  // drop repeats, then corners on a straight line between their neighbours
  const dedup = path.filter((p, i) => i === 0 || p[0] !== path[i - 1][0] || p[1] !== path[i - 1][1]);
  const out: Corner[] = [];
  for (let i = 0; i < dedup.length; i++) {
    const a = dedup[(i - 1 + dedup.length) % dedup.length];
    const b = dedup[i];
    const n = dedup[(i + 1) % dedup.length];
    if ((a[0] === b[0] && b[0] === n[0]) || (a[1] === b[1] && b[1] === n[1])) continue;
    out.push(b);
  }
  return out;
}

function discMarker(id: number, cx: number, cz: number, r: number, color: string): MapMarker {
  const polygon = disc(cx, cz, r);
  const xs = polygon.map((p) => p[0]);
  const zs = polygon.map((p) => p[1]);
  return {
    id, kind: "poly", title: `Ring ${id}`, subtitle: null, color, color_auto: false,
    point: null, bounds: null, polygon,
    label: { x: cx, z: cz, r: r - 1 },
    bbox: { min_x: Math.min(...xs), min_z: Math.min(...zs), max_x: Math.max(...xs), max_z: Math.max(...zs) },
    created_at: T, updated_at: T, revision: 1
  };
}

/** What the stress world holds, for the check's report. */
function stressWorld(): MapMarker[] {
  const out: MapMarker[] = [];
  const colors = ["#e5484d", "#0090ff", "#30a46c", "#f76b15", "#8e4ec6", "#ffc53d", "#101826", "#f4f1e8"];
  let id = 1000;
  // 10 big rings of radius 700..790 (about 3500..3700 corners each, under the 4096 limit) far apart
  for (let i = 0; i < 10; i++) out.push(discMarker(id++, -8000 + i * 1700, 3000, 700 + i * 10, colors[i % 8]));
  // 90 small rings of radius 60..80 (about 330..450 corners each) on a grid away from the plots
  for (let i = 0; i < 90; i++) out.push(discMarker(id++, -2000 + (i % 10) * 400, -6000 + Math.floor(i / 10) * 400, 60 + (i % 21), colors[(i + 3) % 8]));
  // 600 rectangles from 3 × 3 to 120 × 60 blocks, some nested, all around the spawn
  for (let i = 0; i < 600; i++) {
    const x = -1500 + (i % 30) * 100;
    const z = -1500 + Math.floor(i / 30) * 150;
    const w = 3 + ((i * 37) % 118);
    const d = 3 + ((i * 53) % 58);
    out.push(area({ id: id++, title: `Plot ${i + 1} of the long street`, color: colors[i % 8], created: T }, x, z, x + w - 1, z + d - 1));
  }
  // 300 points
  for (let i = 0; i < 300; i++) out.push(point({ id: id++, title: `Post ${i + 1}`, subtitle: i % 3 ? null : "A note", color: colors[(i + 5) % 8], created: T }, -1500 + ((i * 97) % 3000), 64, -1500 + ((i * 61) % 3000)));
  return out;
}

if (variant === "stress") {
  const ow = set("survival", "minecraft_overworld");
  ow.markers = stressWorld();
  ow.rev += 1;
}

const log: string[] = [];
Bun.serve({
  port,
  hostname: "127.0.0.1",
  fetch: (req) => {
    const u = new URL(req.url);
    if (u.pathname === "/__e2e/requests") return Response.json(log);
    if (u.pathname === "/__e2e/reset" && req.method === "POST") {
      log.length = 0;
      return Response.json({ ok: true });
    }
    if (u.pathname === "/__mock/markers/bump" && req.method === "POST") return Response.json({ rev: bumpMarkers(sets, u.searchParams.get("server") ?? "", u.searchParams.get("world") ?? "") });
    log.push(`${req.method} ${u.pathname}${u.search}`);
    return handleMock(world, req);
  }
});
console.log(`markers upstream (${variant}) on http://127.0.0.1:${port}`);
