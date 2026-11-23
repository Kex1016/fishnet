// Browser checks of the map pages (FM-4 acceptance, brief §7) on a running mock site. Not part of `bun test`:
// needs Playwright with Chromium on the machine, like scripts/map-canvas-check.ts.
//
//   bun run build
//   FISHNET_MOCK=busy  FISHNET_ALLOW_MOCK=1 PORT=3101 node build/index.js &
//   FISHNET_MOCK=fresh FISHNET_ALLOW_MOCK=1 PORT=3102 node build/index.js &
//   bun scripts/map-pages-check.ts --base http://127.0.0.1:3101 --fresh http://127.0.0.1:3102
//
// Prints one line per check and PASS/FAIL; exit 1 on any failure. Unrendered tiles answer 404, which Chromium logs
// as a console error; only those lines are not counted.
const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const base = opt("base", "http://127.0.0.1:3101");
const freshBase = opt("fresh", "");
const origin = new URL(base).origin;

/* eslint-disable @typescript-eslint/no-explicit-any */
const playwright = "playwright";
const { chromium } = (await import(playwright)) as { chromium: { launch(): Promise<any> } };
const browser = await chromium.launch();

let failed = 0;
const errors: string[] = [];
const foreign = new Set<string>();

async function open(root: string, path: string, o: { width?: number; height?: number; js?: boolean } = {}): Promise<any> {
  const ctx = await browser.newContext({ viewport: { width: o.width ?? 1280, height: o.height ?? 800 }, javaScriptEnabled: o.js ?? true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10_000);
  page.on("console", (m: any) => {
    if (m.type() !== "error") return;
    if (/status of 404/.test(m.text()) && (m.location()?.url ?? "").startsWith(`${new URL(root).origin}/map/t/`)) return;
    // until the live hub (FM-2) is merged, /live and players.json answer 503 and the page falls back; that is the contract
    if (/status of 503/.test(m.text()) && /\/map\/[^/]+\/(live|players\.json)/.test(m.location()?.url ?? "") && !args.includes("--strict-live")) return;
    errors.push(`${m.text()} ${m.location()?.url ?? ""}`);
  });
  page.on("pageerror", (e: unknown) => errors.push(String(e)));
  page.on("request", (r: any) => {
    const u: string = r.url();
    if (!u.startsWith(new URL(root).origin) && !u.startsWith("data:")) foreign.add(u);
  });
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`)));
  await page.goto(root + path, { waitUntil: "networkidle" });
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

console.log(`map pages on ${base}`);

await check("/map lists the servers with a map", async () => {
  const page = await open(base, "/map");
  const links = await page.$$eval(".maps a.li", (as: HTMLAnchorElement[]) => as.map((a) => a.getAttribute("href")));
  expect(links.includes("/map/survival") && links.includes("/map/creative"), `links: ${links}`);
  expect(!links.some((l: string) => /staff/.test(l)), "a hidden server is listed");
  await page.context().close();
});

await check("the map fills the whole area beside the nav (JS)", async () => {
  const page = await open(base, "/map/survival");
  await ready(page);
  const r = await page.evaluate(() => {
    const a = document.querySelector(".fx-main")!.getBoundingClientRect();
    const b = document.querySelector(".mc-stage")!.getBoundingClientRect();
    const m = document.querySelector(".mc")!.getBoundingClientRect();
    return { a: [a.left, a.top, a.width, a.height], b: [b.left, b.top, b.width, b.height], m: [m.width, m.height], sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight - document.querySelector(".fx-bar")!.getBoundingClientRect().height };
  });
  expect(r.a.every((v: number, i: number) => Math.abs(v - r.b[i]) <= 1), `stage ${r.b} vs area ${r.a}`);
  expect(Math.abs(r.m[0] - r.b[2]) <= 1 && Math.abs(r.m[1] - r.b[3]) <= 1, `canvas ${r.m} vs stage ${r.b}`);
  expect(r.sh <= r.a[3] + 1 && r.sw <= r.a[2] + 1, "the page scrolls");
  expect((await page.$$(".window:has(.mc-stage)")).length === 0, "a page frame around the map");
  await page.context().close();
});

await check("without JavaScript: still picture, worlds and players popouts open", async () => {
  const page = await open(base, "/map/survival", { js: false });
  expect((await page.$$(".mc__still img.mc-still__tile")).length > 0, "no still tiles");
  expect((await page.$$(".mc__still .mc-dot--still")).length > 0, "no still dots");
  await page.click('summary[title="Worlds"]');
  const worlds = await page.$$eval(".mc-pop[open] a.mc-pop__item", (as: HTMLAnchorElement[]) => as.map((a) => a.getAttribute("href")).filter((h) => h?.includes("?world=")));
  expect(worlds.length >= 3 && worlds.every((h: string) => h?.startsWith("/map/survival?world=")), `worlds: ${worlds}`);
  await page.click('summary[title="Players"]');
  const names = await page.$$eval(".mc-pop[open] .mc-pop__item .mc-pop__grow", (els: HTMLElement[]) => els.map((e) => e.textContent));
  expect(names.length > 0, "no players listed");
  await page.goto(`${base}${worlds[1]}`, { waitUntil: "networkidle" });
  expect((await page.textContent("h1.visually-hidden"))?.includes("Nether"), "the nether link did not open the nether");
  await page.context().close();
});

await check("share link opens the view and follows the map", async () => {
  const page = await open(base, "/map/survival?world=minecraft_the_nether&x=120&z=-80&zoom=2");
  await ready(page);
  const v = await page.evaluate(() => (window as any).__fmap.view());
  expect(v.world === "minecraft_the_nether" && v.x === 120 && v.z === -80 && v.zoom === 2, `opened at ${JSON.stringify(v)}`);
  // pan: the address bar becomes a link to the new view
  const box = await page.locator(".mc__map").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 160, box.y + box.height / 2 + 90, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() => /x=(?!120&)/.test(location.search) || !location.search.includes("x=120"), null, { timeout: 5000 });
  await page.waitForTimeout(600);
  const now = await page.evaluate(() => ({ v: (window as any).__fmap.view(), q: location.search }));
  const q = new URLSearchParams(now.q);
  expect(q.get("world") === "minecraft_the_nether" && Number(q.get("x")) === now.v.x && Number(q.get("z")) === now.v.z && Number(q.get("zoom")) === now.v.zoom, `url ${now.q} vs view ${JSON.stringify(now.v)}`);
  expect(now.v.x !== 120 || now.v.z !== -80, "the view did not move");
  // reload gives the same view
  await page.reload({ waitUntil: "networkidle" });
  await ready(page);
  const back = await page.evaluate(() => (window as any).__fmap.view());
  expect(back.x === now.v.x && back.z === now.v.z && back.zoom === now.v.zoom && back.world === now.v.world, `reload ${JSON.stringify(back)} vs ${JSON.stringify(now.v)}`);
  // the Share popout shows the same link
  await page.click('summary[title="Share"]');
  const val: string = await page.inputValue(".mp-url");
  expect(val === `${origin}/map/survival${now.q}` || val.startsWith(`${origin}/map/survival?world=minecraft_the_nether`), `share field ${val}`);
  await page.context().close();
});

await check("players popout: centre on a player, follow toggle, other worlds", async () => {
  const page = await open(base, "/map/survival");
  await ready(page);
  await page.click('summary[title="Players"]');
  const items = await page.$$(".mc-pop[open] .mp-row");
  expect(items.length > 0, "no player rows in the overworld");
  const elsewhere = await page.$$eval(".mc-pop[open] .mc-pop__title", (els: HTMLElement[]) => els.map((e) => e.textContent));
  expect(elsewhere.includes("In other worlds"), `no other-worlds group: ${elsewhere}`);
  await page.click(".mc-pop[open] .mp-row button");
  await page.waitForSelector(".mc__follow");
  await page.click(".mc__follow");
  expect((await page.$$(".mc__follow")).length === 0, "follow did not stop");
  await page.context().close();
});

await check("live events move the page: a streamed player appears, a status event shows", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10_000);
  // the hub (FM-2) is not needed here: a stand-in stream with the contract's events (brief §4.3)
  const player = { uuid: "11111111-2222-3333-4444-555555555555", name: "Livebob", world: "minecraft_overworld", x: 40, z: 40, yaw: 90 };
  await page.route("**/map/survival/live*", (route: any) =>
    route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream", "cache-control": "no-store" },
      body: `retry: 60000\nevent: players\ndata: ${JSON.stringify({ at: Date.now(), players: [player], gone: [] })}\n\nevent: status\ndata: ${JSON.stringify({ state: "stale", as_of: Date.now() - 60_000 })}\n\n`
    })
  );
  await page.goto(`${base}/map/survival`, { waitUntil: "networkidle" });
  await ready(page);
  await page.waitForFunction(() => document.querySelector(".mp-status")?.textContent?.includes("Positions as of"), null, { timeout: 8000 });
  await page.click('summary[title="Players"]');
  const names = await page.$$eval(".mc-pop[open] .mc-pop__grow", (els: HTMLElement[]) => els.map((e) => e.textContent));
  expect(names.length === 1 && names[0] === "Livebob", `players after the event: ${names}`);
  expect((await page.$$(".mc__map .mc-dot-icon")).length === 1, "the dot did not arrive");
  await ctx.close();
});

await check("a server without live positions says so", async () => {
  const page = await open(base, "/map/creative");
  await ready(page);
  expect((await page.textContent(".mp-status"))?.includes("Live positions are off"), "no status line");
  await page.click('summary[title="Players"]');
  expect((await page.textContent(".mc-pop[open]"))?.includes("Live positions are off"), "players popout does not say it");
  await page.context().close();
});

await check("a server that is not on the map is a 404", async () => {
  for (const s of ["staff", "nope"]) {
    const res = await fetch(`${base}/map/${s}`);
    expect(res.status === 404, `${s}: ${res.status}`);
  }
});

await check("server page has a Map card", async () => {
  const page = await open(base, "/servers/survival");
  const href = await page.getAttribute("a.maplink", "href");
  expect(href === "/map/survival", `card href ${href}`);
  const none = await open(base, "/servers/creative");
  expect(!!(await none.$("a.maplink")), "creative has a map too");
  await page.context().close();
  await none.context().close();
});

await check("phone width: popouts become a sheet, no horizontal scroll", async () => {
  const page = await open(base, "/map/survival", { width: 390, height: 844 });
  await ready(page);
  await page.click('summary[title="Players"]');
  const r = await page.evaluate(() => {
    const p = document.querySelector(".mc-pop[open] .mc-pop__panel")!.getBoundingClientRect();
    return { l: p.left, r: p.right, w: innerWidth, sw: document.documentElement.scrollWidth };
  });
  expect(r.l >= 0 && r.r <= r.w && r.sw <= r.w, `sheet ${JSON.stringify(r)}`);
  await page.context().close();
});

if (freshBase) {
  console.log(`empty states on ${freshBase}`);
  await check("fresh: /map says no server has a map, a server map is 404", async () => {
    const page = await open(freshBase, "/map");
    expect((await page.textContent(".fx-empty"))?.includes("No server has a map yet"), "no empty state");
    const res = await fetch(`${freshBase}/map/survival`);
    expect(res.status === 404, `fresh /map/survival: ${res.status}`);
    await page.context().close();
  });
}

await check("no console errors, no request outside the site", async () => {
  expect(errors.length === 0, errors.slice(0, 5).join(" | "));
  expect(foreign.size === 0, [...foreign].slice(0, 5).join(" | "));
});

await browser.close();
console.log(failed ? `FAIL (${failed})` : "PASS");
process.exit(failed ? 1 : 0);
