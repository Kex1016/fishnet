// Browser checks of the map canvas (FM-3 acceptance, brief §7) on the /design/map preview of a running mock
// site. Not part of `bun test`: needs Playwright with Chromium on the machine, like scripts/screenshots.ts.
//
//   bun run build
//   FISHNET_MOCK=busy FISHNET_ALLOW_MOCK=1 PORT=3101 node build/index.js &
//   bun scripts/map-canvas-check.ts --base http://127.0.0.1:3101                 # busy
//   bun scripts/map-canvas-check.ts --base http://127.0.0.1:3102 --scenario fresh
//
// Prints one line per check and PASS/FAIL; exit 1 on any failure. FM-7 may fold these into tests/e2e/.
// A tile that is not rendered answers 404 (brief §4.2), which Chromium logs as a console error; those lines,
// and only those, are not counted as errors here.
const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const base = opt("base", "http://127.0.0.1:3101");
const scenario = opt("scenario", "busy");
const origin = new URL(base).origin;

/* eslint-disable @typescript-eslint/no-explicit-any */
const playwright = "playwright";
const { chromium } = (await import(playwright)) as { chromium: { launch(): Promise<any> } };
const sharp = (await import("sharp")).default;
const browser = await chromium.launch();

let failed = 0;
const errors: string[] = [];
const foreign = new Set<string>();
const tile404 = new Set<string>();

function watch(page: any): void {
  page.on("console", (m: any) => {
    if (m.type() !== "error") return;
    const url: string = m.location()?.url ?? "";
    if (/status of 404/.test(m.text()) && url.startsWith(`${origin}/map/t/`)) tile404.add(url);
    else errors.push(`${m.text()} ${url}`);
  });
  page.on("pageerror", (e: unknown) => errors.push(String(e)));
  page.on("request", (r: any) => {
    const u: string = r.url();
    if (!u.startsWith(origin) && !u.startsWith("data:")) foreign.add(u);
  });
}

async function open(path: string, o: { width?: number; reducedMotion?: "reduce" | "no-preference"; js?: boolean } = {}): Promise<any> {
  const ctx = await browser.newContext({ viewport: { width: o.width ?? 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: o.reducedMotion ?? "no-preference", javaScriptEnabled: o.js ?? true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10_000);
  watch(page);
  // a CSP violation is also an event, whatever the console says
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`)));
  await page.goto(base + path, { waitUntil: "networkidle" });
  return page;
}

async function check(name: string, run: () => Promise<string | void>): Promise<void> {
  const t0 = performance.now();
  try {
    const note = await run();
    console.log(`  ok    ${name}${note ? `  (${note})` : ""}  ${Math.round(performance.now() - t0)} ms`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
function expect(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

const ready = (page: any) => page.waitForSelector(".mc[data-ready]", { timeout: 15_000 });
/** every tile in view has arrived or failed */
const settled = (page: any) =>
  page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll<HTMLImageElement>(".mc__map img.leaflet-tile")];
    return imgs.length > 0 && imgs.every((i) => i.complete) && !document.querySelector(".mc__map .leaflet-zoom-anim");
  }, null, { timeout: 15_000 });

const RED = [0xd2, 0x3c, 0x3c];
const near = (p: number[], q: number[], by = 3) => Math.abs(p[0] - q[0]) <= by && Math.abs(p[1] - q[1]) <= by && Math.abs(p[2] - q[2]) <= by;

type Probe = { server: string; world: string; spawn: { x: number; z: number }; max: number };
const tileCache = new Map<string, Promise<{ data: Buffer; channels: number } | null>>();
/** A tile's own pixels, straight from the site (not through the page). */
function tilePixels(w: Probe, z: number, x: number, y: number) {
  const url = `${base}/map/t/${w.server}/${w.world}/${z}/${x}_${y}.png`;
  let hit = tileCache.get(url);
  if (!hit)
    tileCache.set(
      url,
      (hit = (async () => {
        const res = await fetch(url);
        if (!res.ok) return null;
        const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        return { data, channels: info.channels };
      })())
    );
  return hit;
}

/**
 * Known blocks land on their pixels: for the spawn block and a spread of blocks around the view, the pixel where
 * the canvas says the block is (pointOf: the same maths that places dots and marks) must be the pixel the block
 * has in its tile. The mock gives each block its own shade, so a map that is one pixel off fails; the check
 * proves that too by comparing against the neighbour. Returns whether the spawn block showed in red (the mock
 * quantises tiles to 64 colours, which can swallow one red pixel far out; the tile's own pixel is the truth).
 */
async function blocksOnTheirPixels(page: any, w: Probe, zoom: number): Promise<boolean> {
  await settled(page);
  const tz = Math.min(zoom, w.max);
  const step = 2 ** (w.max - tz); // blocks per tile pixel
  const ppb = Math.max(1, 2 ** (zoom - w.max)); // screen pixels per block
  const span = 512 * step;
  const view = (await page.evaluate(() => (window as any).__fmap.view())) as { x: number; z: number };
  const blocks: { x: number; z: number }[] = [w.spawn];
  const snap = (n: number) => Math.round(n / step) * step;
  for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) blocks.push({ x: snap(view.x + (i * 53 + j * 7) / ppb * step), z: snap(view.z + (j * 41 - i * 5) / ppb * step) });
  const points = (await page.evaluate((bs: { x: number; z: number }[]) => bs.map((b) => (window as any).__fmap.pointOf(b)), blocks)) as { x: number; y: number }[];
  const box = await page.locator(".mc").boundingBox();
  const png = await page.screenshot({ clip: box });
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => {
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
  let checked = 0;
  let shiftedSame = 0;
  let red = false;
  for (let n = 0; n < blocks.length; n++) {
    const b = blocks[n];
    const at = points[n];
    expect(Number.isInteger(at.x) && Number.isInteger(at.y), `zoom ${zoom}: pointOf gave ${JSON.stringify(at)}`);
    if (at.x < 2 || at.y < 2 || at.x + ppb >= info.width - 2 || at.y + ppb >= info.height - 2) {
      expect(n > 0, `zoom ${zoom}: the spawn block is outside the frame at ${at.x},${at.y}`);
      continue;
    }
    if (b.x % step !== 0 || b.z % step !== 0) continue; // the spawn block is not sampled this far out
    const tx = Math.floor(b.x / span);
    const ty = Math.floor(b.z / span);
    const tile = await tilePixels(w, tz, tx, ty);
    if (!tile) continue; // not rendered
    const ti = (((b.z - ty * span) / step) * 512 + (b.x - tx * span) / step) * tile.channels;
    if (tile.data[ti + 3] === 0) continue; // outside the rendered area
    const want = [tile.data[ti], tile.data[ti + 1], tile.data[ti + 2]];
    // every screen pixel of the block (one at native zoom and below, ppb × ppb past it)
    for (const [dx, dy] of [[0, 0], [ppb - 1, ppb - 1]]) expect(near(px(at.x + dx, at.y + dy), want), `zoom ${zoom}: block ${b.x},${b.z} is ${want} in its tile but the pixel at ${at.x + dx},${at.y + dy} is ${px(at.x + dx, at.y + dy)}`);
    checked++;
    if (near(px(at.x + ppb, at.y), want) && near(px(at.x, at.y + ppb), want)) shiftedSame++;
    if (n === 0) {
      red = near(want, RED);
      // the spawn block is one block: its neighbours are not red
      if (red) for (const [dx, dy] of [[-1, 0], [0, -1], [ppb, 0], [0, ppb]]) expect(!near(px(at.x + dx, at.y + dy), RED), `zoom ${zoom}: the spawn block spills to ${at.x + dx},${at.y + dy}`);
    }
  }
  expect(checked >= 12, `zoom ${zoom}: only ${checked} blocks could be checked`);
  expect(shiftedSame < checked * 0.85, `zoom ${zoom}: ${shiftedSame} of ${checked} blocks look the same one pixel over: the check proves nothing here`);
  return red;
}

const HIDE = ".mc .leaflet-mc-players-pane, .mc .leaflet-mc-marks-pane, .mc .leaflet-overlay-pane, .mc__controls, .mc__foot, .mc__follow, .mc__empty, .mc__still, .mc-over { visibility: hidden !important; }";

console.log(`map canvas, ${scenario} at ${base}`);

if (scenario === "fresh") {
  await check("fresh: no map server, the empty state, no canvas, no errors", async () => {
    const page = await open("/design/map");
    const text = await page.textContent("body");
    expect(text.includes("No server has a map yet"), "the empty state is missing");
    expect((await page.locator(".mc").count()) === 0, "a canvas rendered without a map");
    const tiles = await page.evaluate(() => performance.getEntriesByType("resource").filter((r) => r.name.includes("/map/t/")).length);
    expect(tiles === 0, "tiles were requested");
    await page.context().close();
  });
} else {
  // ---- worlds of the busy mock: the spawn block is red, visible at a zoom when both coordinates divide by the step
  const worlds = [
    { server: "survival", world: "minecraft_overworld", spawn: { x: 64, z: -32 }, max: 3, extra: 2 },
    { server: "survival", world: "minecraft_the_nether", spawn: { x: 8, z: -4 }, max: 3, extra: 2 },
    { server: "survival", world: "minecraft_the_end", spawn: { x: 100, z: 0 }, max: 3, extra: 2 },
    { server: "creative", world: "minecraft_overworld", spawn: { x: 0, z: 0 }, max: 3, extra: 2 }
  ];
  let redWorlds = 0;
  for (const w of worlds) {
    await check(`tiles line up at every zoom: ${w.server} ${w.world}`, async () => {
      const reds: number[] = [];
      for (let zoom = 0; zoom <= w.max + w.extra; zoom++) {
        const page = await open(`/design/map?server=${w.server}&world=${w.world}&zoom=${zoom}&x=${w.spawn.x}&z=${w.spawn.z}`);
        await ready(page);
        await page.addStyleTag({ content: HIDE });
        if (await blocksOnTheirPixels(page, w, zoom)) reds.push(zoom);
        // and after an odd pan
        await page.evaluate(() => (window as any).__fmap.setView({ x: 91, z: -57 }, false));
        await blocksOnTheirPixels(page, w, zoom);
        await page.context().close();
      }
      if (reds.length) redWorlds++;
      return `zoom 0..${w.max + w.extra}; ${reds.length ? `spawn block red at zoom ${reds.join(", ")}` : "the mock's 64-colour tiles swallow the red spawn pixel here"}`;
    });
  }

  await check("the red spawn block is on its pixel where the mock draws it", async () => {
    expect(redWorlds >= 2, `the spawn block showed red in ${redWorlds} worlds`);
    return `${redWorlds} worlds`;
  });

  await check("zooming in place keeps the block on its pixel (wheel, buttons, keys)", async () => {
    const page = await open("/design/map?server=survival&zoom=0&x=64&z=-32");
    await ready(page);
    await page.addStyleTag({ content: `${HIDE} .mc__controls { visibility: visible !important; }` });
    for (let zoom = 1; zoom <= 5; zoom++) {
      await page.click('.mc__controls button[aria-label="Zoom in"]');
      await page.waitForFunction((z: number) => (window as any).__fmap.view().zoom === z, zoom);
      await page.waitForTimeout(350);
      await blocksOnTheirPixels(page, worlds[0], zoom);
    }
    expect(await page.locator(".mc[data-over]").count(), "over-zoomed tiles are not marked for crisp scaling");
    expect(await page.isDisabled('.mc__controls button[aria-label="Zoom in"]'), "zoom in is not disabled at the deepest zoom");
    await page.context().close();
  });

  const track = (page: any, ms: number) =>
    page.evaluate(
      (ms: number) =>
        new Promise<{ x: number; y: number }[]>((done) => {
          const out: { x: number; y: number }[] = [];
          const t0 = performance.now();
          const tick = () => {
            const el = document.querySelector(".mc .mc-dot-icon");
            if (el) {
              const r = el.getBoundingClientRect();
              out.push({ x: r.x, y: r.y });
            }
            if (performance.now() - t0 < ms) requestAnimationFrame(tick);
            else done(out);
          };
          tick();
        }),
      ms
    );
  const spread = (pts: { x: number; y: number }[]) => {
    const distinct = new Set(pts.map((p) => `${p.x},${p.y}`)).size;
    let maxStep = 0;
    let path = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      maxStep = Math.max(maxStep, d);
      path += d;
    }
    return { distinct, maxStep, path, frames: pts.length };
  };

  await check("dots glide between updates", async () => {
    const page = await open("/design/map?server=survival&zoom=5");
    await ready(page);
    await page.waitForSelector(".mc .mc-dot-icon");
    await page.waitForTimeout(2500); // the first poll gives the dot somewhere to go
    const s = spread(await track(page, 6500));
    expect(s.path >= 12, `the dot barely moved (${s.path.toFixed(1)} px): nothing to judge`);
    expect(s.distinct >= 10, `only ${s.distinct} positions in ${s.frames} frames: the dot jumps`);
    expect(s.maxStep <= Math.max(4, s.path / 6), `one frame moved ${s.maxStep.toFixed(1)} px of ${s.path.toFixed(1)}: a jump`);
    await page.context().close();
    return `${s.distinct} positions over ${s.path.toFixed(0)} px, largest step ${s.maxStep.toFixed(1)} px`;
  });

  await check("reduced motion: dots jump", async () => {
    const page = await open("/design/map?server=survival&zoom=5", { reducedMotion: "reduce" });
    await ready(page);
    await page.waitForSelector(".mc .mc-dot-icon");
    await page.waitForTimeout(2500);
    const s = spread(await track(page, 6500));
    expect(s.path >= 12, `the dot barely moved (${s.path.toFixed(1)} px): nothing to judge`);
    expect(s.distinct <= 5, `${s.distinct} positions in 6.5 s with reduced motion: the dot still glides`);
    await page.context().close();
    return `${s.distinct} positions over ${s.path.toFixed(0)} px`;
  });

  await check("keyboard: arrows pan, plus and minus zoom, Tab reaches the dots and every control", async () => {
    const page = await open("/design/map?server=survival&zoom=3", { reducedMotion: "reduce" });
    await ready(page);
    const view = () => page.evaluate(() => (window as any).__fmap.view());
    await page.focus(".mc__map");
    const v0 = await view();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(400);
    const v1 = await view();
    expect(v1.x > v0.x && v1.z > v0.z, `arrows did not pan: ${JSON.stringify(v0)} → ${JSON.stringify(v1)}`);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(400);
    const v2 = await view();
    expect(Math.abs(v2.x - v0.x) <= 1 && Math.abs(v2.z - v0.z) <= 1, `left and up did not come back: ${JSON.stringify(v2)}`); // whole screen pixels: a block at most
    await page.keyboard.press("+");
    await page.waitForTimeout(400);
    expect((await view()).zoom === 4, "plus did not zoom in");
    await page.keyboard.press("-");
    await page.keyboard.press("-");
    await page.waitForTimeout(400);
    expect((await view()).zoom === 2, "minus did not zoom out");
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const label = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        return a && a.closest(".mc") ? (a.getAttribute("aria-label") ?? a.textContent ?? "") : null;
      });
      if (label === null) break;
      seen.push(label);
    }
    for (const want of ["Follow koi_pond", "Zoom in", "Zoom out", "Back to spawn"]) expect(seen.includes(want), `Tab never reached "${want}" (reached: ${seen.join(" | ")})`);
    await page.context().close();
    return seen.join(" → ");
  });

  await check("follow: Enter on a dot follows, the view stays on the player, an arrow key lets go", async () => {
    const page = await open("/design/map?server=survival&zoom=4");
    await ready(page);
    await page.focus(".mc .mc-dot-icon");
    await page.keyboard.press("Enter");
    await page.waitForSelector('.mc__follow[aria-pressed="true"]', { timeout: 5000 });
    expect((await page.getAttribute(".mc .mc-dot-icon", "aria-pressed")) === "true", "the dot does not say it is followed");
    expect((await page.textContent(".mc__follow")).includes("Following koi_pond"), "the follow toggle does not name the player");
    await page.waitForTimeout(5000);
    const off = await page.evaluate(() => {
      const f = document.querySelector(".mc")!.getBoundingClientRect();
      const d = document.querySelector(".mc .mc-dot-icon")!.getBoundingClientRect();
      return { dx: d.x + d.width / 2 - (f.x + f.width / 2), dy: d.y + d.height / 2 - (f.y + f.height / 2) };
    });
    expect(Math.abs(off.dx) <= 3 && Math.abs(off.dy) <= 3, `the followed dot is ${off.dx.toFixed(1)}, ${off.dy.toFixed(1)} px off centre`);
    expect((await page.textContent(".mp-link")).includes("follow="), "the share link lost follow");
    await page.focus(".mc__map");
    await page.keyboard.press("ArrowLeft");
    await page.waitForSelector(".mc__follow", { state: "detached" });
    expect((await page.getAttribute(".mc .mc-dot-icon", "aria-pressed")) === "false", "the dot still says it is followed");
    // from outside (the player list) and by dragging
    await page.click('summary[title="Players"]');
    await page.click('.mp-follow[aria-label="Follow koi_pond"]');
    await page.waitForSelector('.mc__follow[aria-pressed="true"]');
    const box = await page.locator(".mc").boundingBox();
    await page.mouse.move(box.x + 200, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x + 260, box.y + 240, { steps: 4 });
    await page.mouse.up();
    await page.waitForSelector(".mc__follow", { state: "detached" });
    expect((await page.getAttribute(".mp-follow", "aria-pressed")) === "false", "the list still says following after a drag");
    await page.context().close();
  });

  await check("?follow= opens on the player and follows", async () => {
    const page = await open("/design/map?server=survival&follow=c478b64a-c578-47dd-a278-b324c378b4b7");
    await ready(page);
    await page.waitForSelector('.mc__follow[aria-pressed="true"]');
    await page.waitForTimeout(1200);
    const off = await page.evaluate(() => {
      const f = document.querySelector(".mc")!.getBoundingClientRect();
      const d = document.querySelector(".mc .mc-dot-icon")!.getBoundingClientRect();
      return Math.hypot(d.x + d.width / 2 - (f.x + f.width / 2), d.y + d.height / 2 - (f.y + f.height / 2));
    });
    expect(off <= 3, `the followed dot is ${off.toFixed(1)} px off centre`);
    await page.context().close();
  });

  await check("tile versions: ?v= with a change log, swapped in place on a tiles event, none without a log", async () => {
    const page = await open("/design/map?server=survival&zoom=3");
    await ready(page);
    await settled(page);
    const srcs = () => page.evaluate(() => [...document.querySelectorAll<HTMLImageElement>(".mc__map img.leaflet-tile")].map((i) => i.getAttribute("src")!));
    const before: string[] = await srcs();
    expect(before.length > 0 && before.every((s) => /\?v=mock-1\.\d+$/.test(s)), `tiles without a version: ${before.find((s) => !/\?v=mock-1\.\d+$/.test(s))}`);
    await page.evaluate(() => (window as any).__fmap.applyTiles({ world: "minecraft_overworld", epoch: "mock-1", reset: false, tiles: [["mock-1.99999999", 3, 0, -1]] }));
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>(".mc__map img.leaflet-tile")].some((i) => i.getAttribute("src")!.endsWith("/3/0_-1.png?v=mock-1.99999999")));
    const after: string[] = await srcs();
    expect(after.length === before.length, "tiles were rebuilt instead of swapped");
    expect(after.filter((s, i) => s !== before[i]).length === 1, "more than the named tile changed");
    await page.evaluate(() => (window as any).__fmap.applyTiles({ world: "minecraft_the_nether", epoch: "other", reset: true, tiles: [] }));
    expect(JSON.stringify(await srcs()) === JSON.stringify(after), "an event of another world changed tiles");
    await page.evaluate(() => (window as any).__fmap.applyTiles({ world: "minecraft_overworld", epoch: "mock-2", reset: true, tiles: [] }));
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>(".mc__map img.leaflet-tile")].filter((i) => i.naturalWidth > 0).every((i) => i.getAttribute("src")!.endsWith("?v=mock-2.0")));
    await page.context().close();
    const nether = await open("/design/map?server=survival&world=minecraft_the_nether");
    await ready(nether);
    await settled(nether);
    const plain: string[] = await nether.evaluate(() => [...document.querySelectorAll<HTMLImageElement>(".mc__map img.leaflet-tile")].map((i) => i.getAttribute("src")!));
    expect(plain.length > 0 && plain.every((s) => !s.includes("?")), `a world without a log got a query: ${plain.find((s) => s.includes("?"))}`);
    await nether.context().close();
  });

  await check("an unmapped area says so and leads back to spawn", async () => {
    const page = await open("/design/map?server=survival&x=90000&z=90000&zoom=3", { reducedMotion: "reduce" });
    await ready(page);
    await page.waitForSelector(".mc__empty");
    expect((await page.textContent(".mc__empty")).includes("This area is not mapped yet"), "the copy is wrong");
    await page.click(".mc__empty button");
    await page.waitForSelector(".mc__empty", { state: "detached" });
    const v = await page.evaluate(() => (window as any).__fmap.view());
    expect(v.x === 64 && v.z === -32, `back to spawn went to ${JSON.stringify(v)}`);
    await page.context().close();
  });

  await check("the sample layer lands on its blocks; titles are text", async () => {
    const page = await open("/design/map?server=survival&zoom=4", { reducedMotion: "reduce" });
    await ready(page);
    await page.click('summary[title="Layers"]');
    await page.click(".mp-sample");
    await page.waitForSelector(".mc .mc-mark");
    const got = await page.evaluate(() => {
      const f = document.querySelector(".mc")!.getBoundingClientRect();
      const want = (window as any).__fmap.pointOf({ x: 128, z: 128 });
      const el = document.querySelector('.mc .mc-mark[data-layer="sample-grid"]')!.getBoundingClientRect();
      return { dx: el.x + el.width / 2 - f.x - want.x, dy: el.y + el.height / 2 - f.y - want.y, paths: document.querySelectorAll(".mc path.mc-path").length };
    });
    expect(Math.abs(got.dx) <= 1 && Math.abs(got.dy) <= 1, `the mark is ${got.dx}, ${got.dy} px off its block`);
    expect(got.paths === 1, `${got.paths} paths drawn`);
    await page.context().close();
  });

  await check("without JavaScript the frame is a picture of the same view", async () => {
    const page = await open("/design/map?server=survival&world=minecraft_the_end&zoom=3", { js: false });
    const n = await page.locator(".mc__still img.mc-still__tile").count();
    expect(n === 15, `${n} still tiles`);
    const ow = await open("/design/map?server=survival&zoom=3", { js: false });
    expect((await ow.locator(".mc__still .mc-dot--still").count()) === 1, "the still frame has no dot");
    expect((await ow.textContent(".mc-over")).includes("koi_pond"), "the player list is not in the page without JavaScript");
    await ow.context().close();
    // the spawn block is at the centre of the frame (the view's centre is the centre of that block); the end keeps its red
    const box = await page.locator(".mc").boundingBox();
    const png = await page.screenshot({ clip: box });
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    // half-pixel layout: the block is one of the four pixels around the exact centre, and only one of them
    const cx = Math.floor(info.width / 2);
    const cy = Math.floor(info.height / 2);
    const at = (x: number, y: number) => {
      const i = (y * info.width + x) * info.channels;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const reds = [[cx - 1, cy - 1], [cx, cy - 1], [cx - 1, cy], [cx, cy]].filter(([x, y]) => near(at(x, y), RED)).length;
    expect(reds === 1, `${reds} of the four centre pixels are the spawn block`);
    await page.context().close();
  });

  await check("the map fills the whole view beside the nav; a dot's hover popup has the name, world and coordinates", async () => {
    const page = await open("/design/map?server=survival&zoom=4");
    await ready(page);
    const r = await page.evaluate(() => {
      const f = document.querySelector(".mc")!.getBoundingClientRect();
      const top = document.querySelector(".fp-top")!.getBoundingClientRect();
      const side = document.querySelector(".fp-side")!.getBoundingClientRect();
      return { left: f.left - side.right, top: f.top - top.bottom, right: window.innerWidth - f.right, bottom: window.innerHeight - f.bottom };
    });
    expect(Object.values(r).every((v) => Math.abs(v as number) <= 1), `the map does not fill the view: ${JSON.stringify(r)}`);
    expect(!(await page.isVisible(".mc .mc-dot__tip")), "the popup shows without hover");
    await page.hover(".mc .mc-dot-icon");
    await page.waitForSelector(".mc .mc-dot__tip", { state: "visible" });
    const tip: string = await page.innerText(".mc .mc-dot__tip");
    expect(tip.includes("koi_pond") && tip.includes("Overworld") && /x \S+, z \S+/.test(tip), `the popup says: ${tip}`);
    await page.mouse.move(5, 5);
    await page.focus(".mc .mc-dot-icon");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await page.waitForSelector(".mc .mc-dot__tip", { state: "visible" }); // keyboard focus shows it too
    // popouts: one open at a time, Escape closes
    await page.click('summary[title="Worlds"]');
    await page.click('summary[title="Players"]');
    expect((await page.locator("details.mc-pop[open]").count()) === 1, "two popouts are open at once");
    await page.keyboard.press("Escape");
    expect((await page.locator("details.mc-pop[open]").count()) === 0, "Escape did not close the popout");
    await page.context().close();
  });

  await check("390 px: the canvas fits, controls are inside the frame", async () => {
    const page = await open("/design/map?server=survival", { width: 390 });
    await ready(page);
    const r = await page.evaluate(() => {
      const f = document.querySelector(".mc")!.getBoundingClientRect();
      const inside = [...document.querySelectorAll(".mc__controls, .mc__readout, .mc__credit, .mc-pop > summary")].every((e) => {
        const b = e.getBoundingClientRect();
        return b.left >= f.left && b.right <= f.right && b.top >= f.top && b.bottom <= f.bottom;
      });
      return { inside, overflow: document.documentElement.scrollWidth > window.innerWidth };
    });
    expect(r.inside, "a control sticks out of the frame");
    expect(!r.overflow, "the page scrolls sideways");
    await page.context().close();
  });

  await check("hidden server and player never reach the canvas", async () => {
    const html = await (await fetch(`${base}/design/map?server=survival`)).text();
    expect(!/quietgill|Bosun/.test(html), "a hidden name is in the page");
    const live = await (await fetch(`${base}/design/map/live.json?server=survival&world=minecraft_overworld`)).text();
    expect(!/quietgill|5a1c0de0/.test(live), "a hidden player is in the live feed");
    const staff = await fetch(`${base}/map/t/staff/minecraft_overworld/3/0_0.png`);
    expect(staff.status === 404, `a hidden server's tile answered ${staff.status}`);
  });
}

await check("no console errors, no CSP violation, no page errors", async () => {
  expect(errors.length === 0, `${errors.length} errors, first: ${errors[0]}`);
  return tile404.size ? `${tile404.size} unrendered tiles answered 404, as the brief says` : undefined;
});
await check("the browser asked only the site", async () => {
  expect(foreign.size === 0, `foreign requests: ${[...foreign].slice(0, 3).join(", ")}`);
});

await browser.close();
console.log(`\nmap canvas ${failed ? "FAIL" : "PASS"} (${scenario})`);
process.exit(failed ? 1 : 0);
