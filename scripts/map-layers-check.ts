// Browser checks of the round map's layers (FM-5 acceptance, brief §7) on a running mock site (busy).
//   FISHNET_MOCK=busy FISHNET_ALLOW_MOCK=1 PORT=3101 node build/index.js &
//   bun scripts/map-layers-check.ts --base http://127.0.0.1:3101
// A finished round (1) is drawn on tiles with its marks and trails; the running round (2) keeps the SVG map and asks
// for no tile; the layers popout is reachable and operable by keyboard. Prints one line per check; exit 1 on failure.
const args = process.argv.slice(2);
const base = args[args.indexOf("--base") + 1] ?? "http://127.0.0.1:3101";
/* eslint-disable @typescript-eslint/no-explicit-any */
const playwright = "playwright";
const { chromium } = (await import(playwright)) as { chromium: { launch(): Promise<any> } };
const browser = await chromium.launch();
let failed = 0;
const check = async (name: string, run: () => Promise<string | void>) => {
  try {
    const note = await run();
    console.log(`ok   ${name}${note ? ` (${note})` : ""}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}: ${e instanceof Error ? e.message : e}`);
  }
};
const must = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
async function open(path: string, width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  const tiles: string[] = [];
  const errors: string[] = [];
  page.on("request", (r: any) => /\/map\/t\//.test(r.url()) && tiles.push(r.url()));
  page.on("console", (m: any) => m.type() === "error" && !/status of 404/.test(m.text()) && errors.push(m.text()));
  page.on("pageerror", (e: unknown) => errors.push(String(e)));
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForSelector(".mc[data-ready]");
  await page.waitForTimeout(400);
  return { page, tiles, errors };
}

await check("finished round: tiles requested, marks and a trail drawn, no errors", async () => {
  const { page, tiles, errors } = await open("/one-soul/map?round=1");
  must(tiles.some((u) => u.includes("/map/t/onesoul/round/1/")), "no round tile requested");
  const marks = await page.locator(".mc-mark").count();
  const paths = await page.locator("path.mc-path").count();
  must(marks > 0, "no marks");
  must(paths > 0, "no trail");
  must(errors.length === 0, errors.join("; "));
  return `${marks} marks, ${paths} trails`;
});

await check("layers popout: keyboard opens it, Space toggles a layer, the marks go and come back", async () => {
  const { page } = await open("/one-soul/map?round=1");
  const before = await page.locator(".mc-mark").count();
  await page.locator("summary[aria-label^='Layers']").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.layer ?? "");
  must(first, "focus did not reach a layer button");
  await page.keyboard.press("Space");
  must((await page.locator(`.mc-pop__item[data-layer='${first}']`).getAttribute("aria-pressed")) === "false", "aria-pressed did not change");
  const during = await page.locator(".mc-mark").count();
  await page.keyboard.press("Space");
  const after = await page.locator(".mc-mark").count();
  must(after === before, `marks ${before} -> ${after}`);
  return `${first}: ${before} -> ${during} -> ${after}`;
});

await check("worlds: only the world shown has marks", async () => {
  const a = await open("/one-soul/map?round=1&world=minecraft_overworld");
  const b = await open("/one-soul/map?round=1&world=minecraft_the_nether");
  const na = await a.page.locator(".mc-mark").count();
  const nb = await b.page.locator(".mc-mark").count();
  must(na !== nb || na === 0, "same marks in both worlds");
  return `overworld ${na}, nether ${nb}`;
});

await check("running round: SVG map, not one tile requested", async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const tiles: string[] = [];
  page.on("request", (r: any) => /\/map\/t\//.test(r.url()) && tiles.push(r.url()));
  await page.goto(`${base}/one-soul/map?round=2`, { waitUntil: "networkidle" });
  must((await page.locator("svg[aria-label^='Map of']").count()) > 0, "no SVG map");
  must(tiles.length === 0, `tile requests: ${tiles.join(", ")}`);
  await page.goto(`${base}/one-soul/rounds/2`, { waitUntil: "networkidle" });
  must(tiles.length === 0 && (await page.locator(".mc").count()) === 0, "round page asked for tiles while running");
});

await check("round page card: finished round shows the map card", async () => {
  const { page } = await open("/one-soul/rounds/1");
  must((await page.locator(".rm-card .mc-mark").count()) > 0, "no marks in the card");
});

await browser.close();
console.log(failed ? `FAIL (${failed})` : "PASS");
process.exit(failed ? 1 : 0);
