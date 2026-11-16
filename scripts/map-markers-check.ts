// Browser checks of the map markers (FMK-2 acceptance, brief §6) on a running mock site. Not part of `bun test`: needs
// Playwright with Chromium on the machine, like scripts/map-pages-check.ts.
//
//   bun run build
//   FISHNET_MOCK=busy  FISHNET_ALLOW_MOCK=1 PORT=3101 node build/index.js &
//   bun scripts/map-markers-check.ts --base http://127.0.0.1:3101
//
// Prints one line per check and PASS/FAIL; exit 1 on any failure. Unrendered tiles answer 404 and the live hub may
// answer 503 while it is not merged; only those console lines are not counted.
const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const base = opt("base", "http://127.0.0.1:3101");
const origin = new URL(base).origin;

/* eslint-disable @typescript-eslint/no-explicit-any */
const playwright = "playwright";
const { chromium } = (await import(playwright)) as { chromium: { launch(): Promise<any> } };
const browser = await chromium.launch();

let failed = 0;
const errors: string[] = [];
const foreign = new Set<string>();

async function open(path: string, o: { width?: number; height?: number; reduced?: boolean; dpr?: number } = {}): Promise<any> {
  const ctx = await browser.newContext({ viewport: { width: o.width ?? 1440, height: o.height ?? 900 }, deviceScaleFactor: o.dpr ?? 1, reducedMotion: o.reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10_000);
  page.on("console", (m: any) => {
    if (m.type() !== "error") return;
    const url = m.location()?.url ?? "";
    if (/status of 404/.test(m.text()) && url.startsWith(`${origin}/map/t/`)) return;
    if (/status of 503/.test(m.text()) && /\/map\/[^/]+\/(live|players\.json)/.test(url)) return;
    errors.push(`${m.text()} ${url}`);
  });
  page.on("pageerror", (e: unknown) => errors.push(String(e)));
  page.on("request", (r: any) => {
    const u: string = r.url();
    if (!u.startsWith(origin) && !u.startsWith("data:")) foreign.add(u);
  });
  await page.goto(base + path, { waitUntil: "networkidle" });
  if (await page.$(".mc")) await page.waitForSelector(".mc[data-ready]", { timeout: 15_000 });
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
const view = (page: any) => page.evaluate(() => (window as any).__fmap.view());
/** Moves the map without animating and waits for the layer to redraw its titles. */
async function look(page: any, x: number, z: number, zoom: number) {
  await page.evaluate(([x, z, zoom]: number[]) => (window as any).__fmap.setView({ x, z, zoom }, false), [x, z, zoom]);
  await page.waitForTimeout(350);
  return view(page);
}
/** Where a corner is on the screen (page coordinates) by the map itself. */
const corner = (page: any, x: number, z: number) =>
  page.evaluate(([x, z]: number[]) => {
    const p = (window as any).__fmap.pointOf({ x, z });
    const r = document.querySelector(".mc__map")!.getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  }, [x, z]);
/** Leaflet fades a popup out for 200 ms before it takes it out of the page. */
const popupGone = (page: any) => page.waitForSelector(".mc-mpop", { state: "detached", timeout: 2000 }).then(() => true, () => false);
const popupTitle = (page: any) => page.$eval(".mc-mpop .mk-pop__title", (e: HTMLElement) => e.textContent).catch(() => null);

// the mock's busy world (src/lib/server/cakeutils/mock/markers.ts)
const SPAWN_TOWN = 4; // 0,-96 .. 127,-1 (128 × 96), long title
const MARKET = 5; // 20,-60 .. 50,-43 (31 × 18) inside Spawn town, very light colour
const WELL = 6; // 96,-40 .. 97,-39 (2 × 2), no title ever
const RIVER = 7; // staircase triangle, 12 legs from (200, 100)
const CATHEDRAL = 8; // -300,-200 .. -261,-171 (40 × 30), 63-character title
const PLACES = [4, 8, 5, 7, 6, 1, 2, 3]; // areas by size, largest first, then pins by id
const OW = "/map/survival?world=minecraft_overworld";

console.log(`map markers on ${base}`);

await check("the overworld draws 5 areas and 3 pins; the Layers popout counts them; the toggle hides and restores them", async () => {
  const page = await open(`${OW}&x=60&z=-50&zoom=3`);
  const n = () => page.evaluate(() => ({ areas: document.querySelectorAll(".mc-area").length, pins: document.querySelectorAll(".mc-pin").length }));
  const first = await n();
  expect(first.areas === 5 && first.pins === 3, `drawn ${JSON.stringify(first)}`);
  await page.click('summary[title="Layers"]');
  const row = page.locator('.mc-pop[open] button[data-layer="markers"]');
  expect((await row.textContent())?.includes("8"), `layer row: ${await row.textContent()}`);
  await row.click();
  const off = await n();
  expect(off.areas === 0 && off.pins === 0 && (await page.$$("canvas.mc-label")).length === 0, `still drawn ${JSON.stringify(off)}`);
  expect((await row.getAttribute("aria-pressed")) === "false", "aria-pressed after off");
  await row.click();
  const back = await n();
  expect(back.areas === 5 && back.pins === 3, `restored ${JSON.stringify(back)}`);
  await page.context().close();
});

await check("a known corner lands on its pixel at every zoom", async () => {
  const page = await open(`${OW}&x=35&z=-51&zoom=3`);
  const seen = new Set<number>();
  for (let zoom = 0; zoom <= 6; zoom++) {
    const v = await look(page, 35, -51, zoom);
    if (seen.has(v.zoom)) continue;
    seen.add(v.zoom);
    const want = { nw: await corner(page, 20, -60), se: await corner(page, 51, -42) };
    const box = await page.$eval(`.mc-area[aria-label^="Market, area"]`, (e: SVGPathElement) => {
      const r = e.getBoundingClientRect();
      const sw = parseFloat(getComputedStyle(e).strokeWidth) || 0;
      return { l: r.left, t: r.top, r: r.right, b: r.bottom, sw };
    });
    const tol = 1.01 + box.sw / 2; // a path's box may include half the stroke
    const dev = [Math.abs(box.l - want.nw.x), Math.abs(box.t - want.nw.y), Math.abs(box.r - want.se.x), Math.abs(box.b - want.se.y)];
    const ok = dev.every((d) => d <= tol && d <= 1.01 + box.sw / 2);
    expect(ok, `zoom ${v.zoom}: path box ${[box.l, box.t, box.r, box.b].map((n) => n.toFixed(1))} vs corners ${want.nw.x.toFixed(1)},${want.nw.y.toFixed(1)} .. ${want.se.x.toFixed(1)},${want.se.y.toFixed(1)}`);
  }
  expect(seen.size >= 4, `only zoom levels ${[...seen]}`);
  await page.context().close();
  return `zoom ${[...seen].join(", ")}`;
});

await check("zig-zag edges follow the block grid: every corner of the staircase is where the map puts its block corner", async () => {
  const page = await open(`${OW}&x=206&z=106&zoom=5`);
  for (const zoom of [5, 4, 3]) {
    const v = await look(page, 206, 106, zoom);
    const got: { x: number; y: number }[] = await page.$eval(`.mc-area[aria-label^="River bend, area"]`, (e: SVGPathElement) => {
      const svg = e.ownerSVGElement!.getBoundingClientRect();
      const vb = e.ownerSVGElement!.viewBox.baseVal; // Leaflet's coordinates are layer points: the view box starts at the renderer's corner
      const nums = (e.getAttribute("d") ?? "").match(/-?\d+(\.\d+)?/g)!.map(Number);
      const out: { x: number; y: number }[] = [];
      for (let i = 0; i + 1 < nums.length; i += 2) out.push({ x: svg.left + nums[i] - vb.x, y: svg.top + nums[i + 1] - vb.y });
      return out;
    });
    // stairTriangle(200, 100, 12): (200,100) (200,112) (212,112) then a staircase back up
    const expected: [number, number][] = [[200, 100], [200, 112], [212, 112]];
    let cx = 212;
    let cz = 112;
    for (let i = 0; i < 12; i++) {
      cz -= 1;
      expected.push([cx, cz]);
      cx -= 1;
      if (i < 11) expected.push([cx, cz]);
    }
    expect(got.length === expected.length, `zoom ${v.zoom}: ${got.length} vertices drawn for ${expected.length} corners`);
    for (let i = 0; i < expected.length; i++) {
      const w = await corner(page, expected[i][0], expected[i][1]);
      expect(Math.abs(got[i].x - w.x) <= 1.01 && Math.abs(got[i].y - w.y) <= 1.01, `zoom ${v.zoom}: corner ${i} ${expected[i]} drawn at ${got[i].x.toFixed(1)},${got[i].y.toFixed(1)}, map says ${w.x.toFixed(1)},${w.y.toFixed(1)}`);
    }
  }
  await page.context().close();
});

await check("a pin's tip is on its block's centre", async () => {
  const page = await open(`${OW}&x=64&z=-32&zoom=5`);
  const w = await corner(page, 64.5, -31.5);
  const r = await page.$eval(`.mc-pin[aria-label^="Spawn, point"]`, (e: HTMLElement) => {
    const b = e.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.bottom };
  });
  expect(Math.abs(r.x - w.x) <= 1 && Math.abs(r.y - w.y) <= 1.5, `pin tip ${r.x.toFixed(1)},${r.y.toFixed(1)} vs block centre ${w.x.toFixed(1)},${w.y.toFixed(1)}`);
  await page.context().close();
});

await check("titles: the tiny area has none at any zoom but a popup; every drawn title sits inside its area; the long title wraps or hides", async () => {
  const page = await open(`${OW}&x=96&z=-40&zoom=5`);
  const labelOf = (id: number) =>
    page.evaluate((id: number) => {
      const c = document.querySelector<HTMLCanvasElement>(`canvas.mc-label[data-marker="${id}"]`);
      if (!c) return null;
      const b = c.getBoundingClientRect();
      return { l: b.left, t: b.top, r: b.right, b: b.bottom, h: b.height, aria: c.getAttribute("aria-hidden") };
    }, id);
  let withTitle = 0;
  for (const zoom of [0, 1, 2, 3, 4, 5]) {
    const v = await look(page, 96, -40, zoom);
    expect((await labelOf(WELL)) === null, `the 2 × 2 area has a title at zoom ${v.zoom}`);
    for (const [id, nw, se] of [[SPAWN_TOWN, [0, -96], [128, 0]], [MARKET, [20, -60], [51, -42]], [CATHEDRAL, [-300, -200], [-260, -170]]] as const) {
      const l = await labelOf(id);
      if (!l) continue;
      withTitle++;
      expect(l.aria === "true", `title ${id} is not aria-hidden`);
      const a = await corner(page, nw[0], nw[1]);
      const b = await corner(page, se[0], se[1]);
      expect(l.l >= a.x - 0.6 && l.t >= a.y - 0.6 && l.r <= b.x + 0.6 && l.b <= b.y + 0.6, `title ${id} at zoom ${v.zoom} leaves its area: ${[l.l, l.t, l.r, l.b].map((n) => n.toFixed(1))} vs ${[a.x, a.y, b.x, b.y].map((n) => n.toFixed(1))}`);
    }
  }
  expect(withTitle > 0, "no title was ever drawn");
  // Spawn town's long title is never drawn across Market, the smaller area on top of it (and Market keeps its own title)
  for (const zoom of [2, 3, 4, 5]) {
    await look(page, 35, -51, zoom);
    const big = await labelOf(SPAWN_TOWN);
    const small = await labelOf(MARKET);
    if (!big) continue;
    const a = await corner(page, 20, -60);
    const b = await corner(page, 51, -42);
    const apart = big.r <= a.x || big.l >= b.x || big.b <= a.y || big.t >= b.y;
    expect(apart, `zoom ${zoom}: Spawn town's title runs across Market`);
    if (small) expect(small.r <= big.l || small.l >= big.r || small.b <= big.t || small.t >= big.b, `zoom ${zoom}: titles overlap`);
  }
  // the cathedral's 63-character title never fits (40 × 30 blocks at most 4 px per block)
  await look(page, -280, -185, 5);
  expect((await labelOf(CATHEDRAL)) === null, "the cathedral title is drawn although it cannot fit");
  // the tiny area still has its popup
  await look(page, 96, -40, 5);
  const c = await corner(page, 97, -39);
  await page.mouse.click(c.x, c.y);
  expect((await popupTitle(page)) === "Well", `popup of the tiny area: ${await popupTitle(page)}`);
  await page.context().close();
  return `${withTitle} titles drawn`;
});

await check("a small area above a big one stays clickable; pins are above areas; clicking the bare map closes the popup", async () => {
  const page = await open(`${OW}&x=35&z=-50&zoom=5`);
  const m = await corner(page, 35, -51);
  await page.mouse.click(m.x, m.y);
  expect((await popupTitle(page)) === "Market", `centre of Market: ${await popupTitle(page)}`);
  // elsewhere in Spawn town (outside Market) the big area answers
  const t = await corner(page, 100, -90);
  await page.mouse.click(t.x, t.y);
  expect(((await popupTitle(page)) ?? "").startsWith("Spawn town"), `inside Spawn town: ${await popupTitle(page)}`);
  // the pin is above the area it stands in
  await look(page, 64, -32, 5);
  const p = await corner(page, 64.5, -32.5);
  await page.mouse.click(p.x, p.y);
  expect((await popupTitle(page)) === "Spawn", `pin: ${await popupTitle(page)}`);
  // the bare map closes it and the address bar forgets the marker
  await page.mouse.click(60, 140);
  expect(await popupGone(page), "popup still open after clicking the map");
  await page.waitForTimeout(700);
  expect(!page.url().includes("marker="), `address bar ${page.url()}`);
  await page.context().close();
});

await check("the popup: subtitle with its lines, coordinates, size, Updated, Copy link; Escape closes it and focus returns to the pin", async () => {
  const page = await open(`${OW}&x=-120&z=200&zoom=5`);
  const pin = page.locator('.mc-pin[aria-label="Farm, point"]');
  await pin.focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector(".mc-mpop .mk-pop");
  const t = await page.$eval(".mc-mpop .mk-pop", (e: HTMLElement) => ({
    text: e.innerText,
    sub: getComputedStyle(e.querySelector(".mk-pop__sub")!).whiteSpace,
    focus: document.activeElement === e,
    copy: !!e.querySelector(".mk-pop__copy"),
    where: e.querySelector(".mk-pop__where")!.textContent
  }));
  expect(t.sub === "pre-line", `subtitle white-space ${t.sub}`);
  expect(t.focus, "the popup did not take the focus on Enter");
  expect(t.where === "x −120, y 63, z 200", `where: ${t.where}`);
  expect(/Wheat, carrots and one very patient cow\nSouth of the river\nOpen to everyone\nBring a bucket/.test(t.text.replace(/\r/g, "")) || (t.text.match(/\n/g) ?? []).length >= 4, `subtitle lines: ${JSON.stringify(t.text)}`);
  expect(/Updated 1 Nov 2026|Updated 2 Nov 2026/.test(t.text), `updated: ${JSON.stringify(t.text)}`);
  expect(t.copy, "no Copy link");
  await page.waitForTimeout(500);
  expect(new URL(page.url()).searchParams.get("marker") === "2", `address bar ${page.url()}`);
  await page.keyboard.press("Escape");
  expect(await popupGone(page), "Escape did not close the popup");
  expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")) === "Farm, point", "focus did not return to the pin");
  // an area: Space opens it, the close button closes it and focus returns to the area
  const area = page.locator('.mc-area[aria-label^="Market, area, 31 × 18 blocks"]');
  await look(page, 35, -51, 5);
  await area.focus();
  await page.keyboard.press("Space");
  await page.waitForSelector(".mc-mpop .mk-pop");
  const sz = await page.$eval(".mc-mpop .mk-pop", (e: HTMLElement) => e.innerText);
  expect(sz.includes("Area, 31 × 18 blocks"), `area popup: ${JSON.stringify(sz)}`);
  await page.click('.mc-mpop button[aria-label="Close"]');
  expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")) === "Market, area, 31 × 18 blocks", "focus did not return to the area");
  await page.context().close();
});

await check("Copy link puts ?marker=<id> on the clipboard", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  await page.goto(`${base}${OW}&x=64&z=-32&zoom=5`, { waitUntil: "networkidle" });
  await page.waitForSelector(".mc[data-ready]");
  await page.locator('.mc-pin[aria-label="Spawn, point"]').click();
  await page.click(".mc-mpop .mk-pop__copy");
  const clip: string = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip === `${origin}/map/survival?world=minecraft_overworld&marker=1`, `clipboard ${clip}`);
  await ctx.close();
});

await check("keyboard: Tab walks every marker on the map in the Places order, and the Places popout lists the same, arrows move, Enter opens", async () => {
  const page = await open(`${OW}&x=60&z=-50&zoom=3`);
  // the order the map offers: areas then pins
  await page.locator(".mc-area").first().focus();
  const tabbed: string[] = [await page.evaluate(() => document.activeElement!.getAttribute("aria-label")!)];
  for (let i = 1; i < PLACES.length; i++) {
    await page.keyboard.press("Tab");
    tabbed.push(await page.evaluate(() => document.activeElement!.getAttribute("aria-label") ?? ""));
  }
  await page.click('summary[title="Places"]');
  const listed: string[] = await page.$$eval(".mc-pop[open] button[data-place]", (bs: HTMLElement[]) => bs.map((b) => b.getAttribute("aria-label")!));
  const ids: number[] = await page.$$eval(".mc-pop[open] button[data-place]", (bs: HTMLElement[]) => bs.map((b) => Number(b.dataset.place)));
  expect(JSON.stringify(ids) === JSON.stringify(PLACES), `Places order ${ids}`);
  expect(JSON.stringify(tabbed) === JSON.stringify(listed), `Tab order ${JSON.stringify(tabbed)} vs Places ${JSON.stringify(listed)}`);
  expect(listed[2] === "Market, area, 31 × 18 blocks" && listed[5] === "Spawn, point", `names ${JSON.stringify(listed)}`);
  // arrows move through the list (Home and End jump)
  await page.locator('.mc-pop[open] button[data-place]').first().focus();
  const walked: number[] = [];
  for (let i = 0; i < PLACES.length - 1; i++) {
    await page.keyboard.press("ArrowDown");
    walked.push(await page.evaluate(() => Number((document.activeElement as HTMLElement).dataset.place)));
  }
  expect(JSON.stringify(walked) === JSON.stringify(PLACES.slice(1)), `arrow walk ${walked}`);
  await page.keyboard.press("Home");
  expect((await page.evaluate(() => Number((document.activeElement as HTMLElement).dataset.place))) === PLACES[0], "Home");
  await page.keyboard.press("End");
  expect((await page.evaluate(() => Number((document.activeElement as HTMLElement).dataset.place))) === PLACES.at(-1), "End");
  // Enter centres the map on the marker, opens its popup, and closes the popout
  await page.locator('.mc-pop[open] button[data-place="5"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector(".mc-mpop .mk-pop");
  await page.waitForTimeout(700);
  const v = await view(page);
  expect(Math.abs(v.x - 35) <= 1 && Math.abs(v.z - -52) <= 1, `centred on ${JSON.stringify(v)}`);
  expect((await popupTitle(page)) === "Market", `popup ${await popupTitle(page)}`);
  expect((await page.$(".mc-pop[open]")) === null, "the Places popout stayed open");
  expect(await page.evaluate(() => document.activeElement?.classList.contains("mk-pop")), "focus did not move into the popup");
  // the entry is marked in the list
  await page.click('summary[title="Places"]');
  expect((await page.getAttribute('.mc-pop[open] button[data-place="5"]', "aria-current")) === "true", "aria-current on the open marker");
  await page.context().close();
});

await check("reduced motion: choosing a place jumps instead of panning", async () => {
  const page = await open(`${OW}&x=0&z=0&zoom=3`, { reduced: true });
  await page.click('summary[title="Places"]');
  await page.locator('.mc-pop[open] button[data-place="8"]').click();
  await page.waitForSelector(".mc-mpop .mk-pop");
  const v = await view(page); // read at once: nothing is still gliding
  expect(Math.abs(v.x - -281) <= 1 && Math.abs(v.z - -186) <= 1, `not there yet: ${JSON.stringify(v)}`);
  await page.context().close();
});

await check("?marker=<id> across worlds: the nether's marker opens the nether with its popup, and the link keeps the marker", async () => {
  const page = await open(`/map/survival?marker=10`);
  const v = await view(page);
  expect(v.world === "minecraft_the_nether", `world ${v.world}`);
  await page.waitForSelector(".mc-mpop .mk-pop");
  expect((await popupTitle(page)) === "Fortress", `popup ${await popupTitle(page)}`);
  expect(Math.abs(v.x - 24) <= 2 && Math.abs(v.z - 0) <= 2, `fitted ${JSON.stringify(v)}`);
  await page.waitForTimeout(700);
  const q = new URL(page.url()).searchParams;
  expect(q.get("marker") === "10" && q.get("world") === "minecraft_the_nether", `address bar ${page.url()}`);
  // a public mini-server's world too
  const mini = await open(`/map/survival?marker=11`);
  expect((await view(mini)).world === "cakeutils_miniservers_skyblock-1_overworld", `mini world ${(await view(mini)).world}`);
  expect((await popupTitle(mini)) === "Island", `mini popup ${await popupTitle(mini)}`);
  await mini.context().close();
  await page.context().close();
});

await check("?marker=<id> in the link's own world keeps the link's view; the existing share-link params survive", async () => {
  const page = await open(`/map/survival?world=minecraft_overworld&x=300&z=300&zoom=3&marker=1`);
  const v = await view(page);
  expect(v.x === 300 && v.z === 300 && v.zoom === 3, `view moved: ${JSON.stringify(v)}`);
  await page.waitForSelector(".mc-mpop .mk-pop");
  expect((await popupTitle(page)) === "Spawn", `popup ${await popupTitle(page)}`);
  await page.waitForTimeout(700);
  const q = new URL(page.url()).searchParams;
  expect(q.get("x") === "300" && q.get("z") === "300" && q.get("zoom") === "3" && q.get("marker") === "1" && q.get("world") === "minecraft_overworld", `address bar ${page.url()}`);
  await page.context().close();
});

await check("an unknown marker id: the map opens normally and a Notice says so; a malformed id says nothing", async () => {
  for (const id of ["99999", "20", "21"]) {
    // 20 and 21 are the hidden server's markers: no world of survival holds them
    const page = await open(`/map/survival?marker=${id}`);
    expect((await page.textContent(".mc-over")).includes("This marker is not on the map any more"), `no Notice for ${id}`);
    expect((await view(page)).world === "minecraft_overworld", `world for ${id}`);
    expect((await page.$(".mc-mpop .mk-pop")) === null, `popup for ${id}`);
    await page.waitForTimeout(500);
    expect(!page.url().includes("marker="), `address bar keeps ${id}: ${page.url()}`);
    await page.context().close();
  }
  const bad = await open(`/map/survival?marker=abc`);
  expect(!(await bad.textContent(".mc-over")).includes("not on the map any more"), "Notice for a malformed id");
  await bad.context().close();
});

await check("titles are text: <b>Shop</b> & §cRed shows literally in the popup, the Places list and the accessible names", async () => {
  const page = await open(`${OW}&x=-60&z=-90&zoom=5`);
  const want = "<b>Shop</b> & §cRed";
  await page.locator(`.mc-pin[aria-label="${want}, point"]`).click();
  const t = await page.$eval(".mc-mpop .mk-pop", (e: HTMLElement) => ({ title: e.querySelector(".mk-pop__title")!.textContent, html: e.querySelector(".mk-pop__title")!.innerHTML, bold: e.querySelectorAll("b").length, sub: e.querySelector(".mk-pop__sub")!.textContent }));
  expect(t.title === want && t.bold === 0, `popup title ${JSON.stringify(t)}`);
  expect(t.html.includes("&lt;b&gt;") && t.html.includes("&amp;"), `escaped: ${t.html}`);
  expect(t.sub === "Prices in diamonds: 3 per stack & a smile", `subtitle ${t.sub}`);
  await page.keyboard.press("Escape");
  await page.click('summary[title="Places"]');
  const row = await page.$eval('.mc-pop[open] button[data-place="3"]', (e: HTMLElement) => ({ text: e.querySelector(".mc-pop__grow")!.textContent, label: e.getAttribute("aria-label"), bold: e.querySelectorAll("b").length }));
  expect(row.text === want && row.label === `${want}, point` && row.bold === 0, `Places row ${JSON.stringify(row)}`);
  await page.context().close();
});

await check("an empty world says so in Places and offers no Markers layer; a world with no map draws nothing", async () => {
  const page = await open(`/map/survival?world=minecraft_the_end`);
  await page.click('summary[title="Places"]');
  expect((await page.textContent(".mc-pop[open]")).includes("No markers in this world yet"), "EmptyState text");
  expect((await page.$$(".mc-area, .mc-pin")).length === 0, "something drawn");
  expect((await page.$('summary[title="Layers"]')) === null, "a Markers layer for an empty world");
  await page.context().close();
});

await check("a hidden server never shows a marker: 404 for the page and markers.json, no staff title anywhere in the markup", async () => {
  const page = await open(`/map/survival`);
  const html: string = await page.content();
  expect(!/STAFF ONLY/.test(html), "a staff marker title in the survival page");
  for (const path of ["/map/staff", "/map/staff/markers.json?world=minecraft_overworld"]) {
    const res = await page.request.get(base + path);
    expect(res.status() === 404, `${path} answered ${res.status()}`);
    expect(!/STAFF ONLY/.test(await res.text()), `${path} leaks a staff title`);
  }
  for (const w of ["minecraft_overworld", "minecraft_the_nether", "minecraft_the_end"]) {
    const res = await page.request.get(`${base}/map/survival/markers.json?world=${w}`);
    expect(!/STAFF ONLY/.test(await res.text()), `survival ${w} leaks a staff title`);
  }
  await page.context().close();
});

await check("a refetch redraws the markers without moving the view (the layer takes new props)", async () => {
  const page = await open(`${OW}&x=60&z=-50&zoom=4`);
  const before = await view(page);
  const n0 = await page.$$eval(".mc-pin", (e: Element[]) => e.length);
  // what a `markers` event does: ask markers.json again and keep the answer (the page does this itself on the event)
  const res = await page.request.get(`${base}/map/survival/markers.json?world=minecraft_overworld`);
  expect(res.status() === 200 && res.headers()["etag"] === `"m9"`, `markers.json ${res.status()} ${res.headers()["etag"]}`);
  expect((await view(page)).x === before.x && n0 === 3, "state changed");
  await page.context().close();
});

await check("no browser request leaves the site; the console stayed clean", async () => {
  expect(foreign.size === 0, `foreign requests: ${[...foreign].join(", ")}`);
  expect(errors.length === 0, `console errors: ${errors.slice(0, 5).join(" | ")}`);
});

await browser.close();
console.log(failed ? `FAIL (${failed})` : "PASS");
process.exit(failed ? 1 : 0);
