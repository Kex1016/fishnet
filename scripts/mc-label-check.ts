// Pixel checks of the Minecraft-font area titles (FMK-1, brief §5.3) on the /design/map preview of a running
// mock site, at DPR 1 and 2. Not part of `bun test`: needs Playwright with Chromium, like map-canvas-check.ts.
//
//   bun run build
//   FISHNET_MOCK=busy FISHNET_ALLOW_MOCK=1 PORT=3101 node build/index.js &
//   bun scripts/mc-label-check.ts --base http://127.0.0.1:3101
//
// For every label canvas: each pixel is clear, the tint or #000000, all fully opaque or fully clear (no smoothed
// edges); every text pixel has text or shadow one font pixel (s device pixels) right and down of it; every
// shadow pixel has text one font pixel left and up; the canvas is aria-hidden and sized w·k × h·k CSS px with a
// k·DPR backing store. Also: k 1..4 are all present, the non-Latin title loads its Unifont page. Exit 1 on failure.
const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const base = opt("base", "http://127.0.0.1:3101");

/* eslint-disable @typescript-eslint/no-explicit-any */
const playwright = "playwright";
const { chromium } = (await import(playwright)) as { chromium: { launch(): Promise<any> } };
const browser = await chromium.launch();
let failed = 0;

type Report = { id: string; k: number; s: number; text: number; shadow: number; problems: string[] };

for (const dpr of [1, 2]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  const errors: string[] = [];
  const unifont = new Set<string>();
  page.on("pageerror", (e: unknown) => errors.push(String(e)));
  page.on("request", (r: any) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/mc/unifont/")) unifont.add(u.pathname);
  });
  await page.goto(`${base}/design/map`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLCanvasElement>("canvas.mk-label")].every((c) => c.dataset.ready), null, { timeout: 15_000 });
  const reports: Report[] = await page.evaluate((dpr: number) => {
    const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    return [...document.querySelectorAll<HTMLCanvasElement>("canvas.mk-label")].map((c) => {
      const problems: string[] = [];
      const k = Number(c.dataset.k);
      const s = Number(c.dataset.scale);
      if (c.dataset.ready !== "1") problems.push(`not drawn (${c.dataset.ready})`);
      if (s !== k * Math.round(dpr)) problems.push(`scale ${s}, want ${k * dpr}`);
      if (c.getAttribute("aria-hidden") !== "true") problems.push("not aria-hidden");
      if (c.width % s || c.height % s) problems.push("backing store not whole font pixels");
      const css = c.getBoundingClientRect();
      if (Math.abs(css.width - c.width / Math.round(dpr)) > 0.01 || Math.abs(css.height - c.height / Math.round(dpr)) > 0.01) problems.push(`css ${css.width}x${css.height} vs backing ${c.width}x${c.height}`);
      const [tr, tg, tb] = hex(c.dataset.tint ?? "#000000");
      const { data, width: W, height: H } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
      // 0 clear, 1 text, 2 shadow
      const at = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= W || y >= H) return 0;
        const i = (y * W + x) * 4;
        if (data[i + 3] === 0) return 0;
        if (data[i] === tr && data[i + 1] === tg && data[i + 2] === tb) return 1;
        return 2;
      };
      let text = 0;
      let shadow = 0;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const a = data[i + 3];
          if (a !== 0 && a !== 255) {
            problems.push(`alpha ${a} at ${x},${y}`);
            continue;
          }
          const v = at(x, y);
          if (v === 1) {
            text++;
            if (at(x + s, y + s) === 0) problems.push(`text at ${x},${y} without shadow at +${s},+${s}`);
          } else if (v === 2) {
            shadow++;
            if (data[i] || data[i + 1] || data[i + 2]) problems.push(`colour ${data[i]},${data[i + 1]},${data[i + 2]} at ${x},${y} is neither tint nor black`);
            else if (at(x - s, y - s) !== 1) problems.push(`shadow at ${x},${y} without text at -${s},-${s}`);
          }
          if (problems.length > 5) break;
        }
      if (!text || !shadow) problems.push(`text ${text}, shadow ${shadow}`);
      return { id: c.dataset.sample ?? "?", k, s, text, shadow, problems: problems.slice(0, 5) };
    });
  }, dpr);
  for (const r of reports) {
    const ok = r.problems.length === 0;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} dpr ${dpr} ${r.id} k ${r.k} (s ${r.s}, ${r.text} text px, ${r.shadow} shadow px)${ok ? "" : ": " + r.problems.join("; ")}`);
  }
  const ks = new Set(reports.map((r) => r.k));
  const allK = [1, 2, 3, 4].every((k) => ks.has(k));
  console.log(`${allK ? "PASS" : "FAIL"} dpr ${dpr} labels at k 1..4 (${reports.length} canvases)`);
  const cjk = unifont.has("/mc/unifont/67.png") && unifont.has("/mc/unifont/30.png");
  console.log(`${cjk ? "PASS" : "FAIL"} dpr ${dpr} non-Latin title through Unifont (${[...unifont].join(", ") || "no Unifont page"})`);
  console.log(`${errors.length ? "FAIL" : "PASS"} dpr ${dpr} no page errors${errors.length ? ": " + errors.join("; ") : ""}`);
  if (!allK) failed++;
  if (!cjk) failed++;
  failed += errors.length;
  await ctx.close();
}
await browser.close();
console.log(failed ? `FAIL (${failed})` : "PASS");
process.exit(failed ? 1 : 0);
