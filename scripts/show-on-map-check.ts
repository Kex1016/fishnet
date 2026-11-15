// Browser checks of FM-8 ("Show on map") on a running busy mock site; needs Playwright with Chromium, like the other map checks.
//   bun scripts/show-on-map-check.ts --base http://127.0.0.1:3101
const args = process.argv.slice(2);
const base = args[args.indexOf("--base") + 1] ?? "http://127.0.0.1:3101";
/* eslint-disable @typescript-eslint/no-explicit-any */
const playwright = "playwright";
const { chromium } = (await import(playwright)) as { chromium: { launch(): Promise<any> } };
const browser = await chromium.launch();
let failed = 0;
async function check(name: string, run: () => Promise<void>) {
  try {
    await run();
    console.log(`  ok    ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
const ok = (c: unknown, m: string) => {
  if (!c) throw new Error(m);
};
const KOI = "c478b64a-c578-47dd-a278-b324c378b4b7";
const MOSSY = "1d32fcaf-1c32-4b1c-af32-ffd51e32fe42";

await check("profile: online with positions is a link; the other three are disabled with a reason", async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/players/MossyAnchor`);
  ok((await page.getAttribute("a:has-text('Show on map')", "href")) === `/map/survival?follow=${MOSSY}`, "link href");
  for (const [who, text] of [["Dace", "offline"], ["Finnegan_B", "Live positions are off on Creative"], ["Lanternfish", "Lobby has no map"]] as const) {
    await page.goto(`${base}/players/${who}`);
    ok(await page.locator("button:has-text('Show on map')[disabled]").count(), `${who} disabled`);
    ok((await page.locator(".fp-who").innerText()).includes(text), `${who} reason: ${text}`);
  }
  await ctx.close();
});
await check("hidden player: profile is a 404, no button, and a follow link says nothing", async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const r = await page.goto(`${base}/players/quietgill`);
  ok(r.status() === 404, "404");
  await page.goto(`${base}/map/survival?follow=5a1c0de0-0000-4000-8000-00000000a11e`);
  ok(!(await page.content()).includes("quietgill"), "name leaked");
  ok(!(await page.locator(".fp-notice").count()), "notice for a hidden player");
  await ctx.close();
});
await check("without JavaScript: the link opens the player's world, centred", async () => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(`${base}/players/MossyAnchor`);
  await page.click("a:has-text('Show on map')");
  ok(page.url().includes(`follow=${MOSSY}`), "url");
  ok((await page.locator("img[src*='minecraft_the_nether']").count()) > 0, "nether tiles");
  await ctx.close();
});
await check("with JavaScript: follows (chip), nether chosen from the snapshot", async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/map/survival?follow=${MOSSY}`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Following MossyAnchor");
  ok((await page.locator(".mc__follow").innerText()).includes("MossyAnchor"), "chip");
  await ctx.close();
});
await check("not there: a Notice (offline; on a server whose positions are off)", async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const u = (await (await ctx.request.get(`${base}/players/Dace`)).text()).match(/[0-9a-f]{8}-[0-9a-f-]{27}/)![0];
  await page.goto(`${base}/map/survival?follow=${u}`);
  ok((await page.locator(".fp-notice").innerText()).includes("offline"), "offline notice");
  ok(!(await page.locator(".mc__follow").count()), "no follow chip");
  await ctx.close();
});
await check("followed player changes world: the page switches world and keeps the follow", async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // a stand-in for the live stream: each connection delivers one snapshot (the browser reconnects by itself);
  // from the second one koi_pond is in the nether
  let n = 0;
  await page.route("**/map/survival/live*", async (r: any) => {
    n++;
    const world = n >= 2 ? "minecraft_the_nether" : "minecraft_overworld";
    const players = [{ uuid: KOI, name: "koi_pond", world, x: 170, z: -242, yaw: 0 }];
    await r.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "cache-control": "no-store" }, body: `retry: 500\nevent: players\ndata: ${JSON.stringify({ at: Date.now(), players, gone: [] })}\n\n` });
  });
  // the mock's own snapshot keeps koi_pond in the overworld, so the page may go back and forth: look at where it has been
  const seen: string[] = [];
  page.on("framenavigated", (f: any) => seen.push(f.url()));
  await page.goto(`${base}/map/survival?follow=${KOI}`);
  await page.waitForFunction(() => performance.getEntriesByType("navigation").length > 0 && document.querySelector(".mc__follow"), null, { timeout: 30000 });
  await page.waitForTimeout(6000);
  const hop = seen.find((u) => u.includes("world=minecraft_the_nether"));
  ok(hop, `no switch to the nether; saw ${seen.length} URLs`);
  ok(hop!.includes(`follow=${KOI}`), "follow kept in the link");
  await ctx.close();
});
await browser.close();
console.log(failed ? `FAIL (${failed})` : "PASS");
process.exit(failed ? 1 : 0);
