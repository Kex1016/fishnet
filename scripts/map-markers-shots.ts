// Screenshots of the map markers (FMK-2, PLAN §7 "Done means"): 390 px and 1440 px, dark and light, on a running site.
//   bun scripts/map-markers-shots.ts --base http://127.0.0.1:3101 --out docs/screenshots/FMK-2
// Stages: the map with markers and titles, an area's popup (the zig-zag), a point's popup, the Places popout, the empty
// state. Needs Playwright with Chromium (not a dependency) and sharp (it is). Output: WebP, <stage>-<width>-<theme>.webp.
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const base = opt("base", "http://127.0.0.1:3101");
const out = opt("out", "docs/screenshots/FMK-2");
const OW = "/map/survival?world=minecraft_overworld";

/* eslint-disable @typescript-eslint/no-explicit-any */
const playwright = "playwright";
const { chromium } = (await import(playwright)) as { chromium: { launch(): Promise<any> } };
const sharp = (await import("sharp")).default;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();

const corner = (page: any, x: number, z: number) =>
  page.evaluate(([x, z]: number[]) => {
    const p = (window as any).__fmap.pointOf({ x, z });
    const r = document.querySelector(".mc__map")!.getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  }, [x, z]);
async function look(page: any, x: number, z: number, zoom: number) {
  await page.evaluate(([x, z, zoom]: number[]) => (window as any).__fmap.setView({ x, z, zoom }, false), [x, z, zoom]);
  await page.waitForTimeout(500);
}

const stages: Record<string, (page: any, narrow: boolean) => Promise<void>> = {
  map: async (page, narrow) => {
    await page.goto(`${base}${OW}&x=${narrow ? 48 : 40}&z=-48&zoom=5`, { waitUntil: "networkidle" });
    await page.waitForSelector(".mc[data-ready]");
    await page.waitForTimeout(900);
  },
  "area-popup": async (page) => {
    await page.goto(`${base}${OW}&x=206&z=106&zoom=5`, { waitUntil: "networkidle" });
    await page.waitForSelector(".mc[data-ready]");
    await page.waitForTimeout(600);
    const c = await corner(page, 200.7, 101.7); // the tip of the staircase: the popup opens above it, the shape stays in view
    await page.mouse.click(c.x, c.y);
    await page.waitForSelector(".mc-mpop .mk-pop");
    await page.mouse.move(2, 2); // the hover state is not the picture
    await page.waitForTimeout(500);
  },
  "point-popup": async (page) => {
    await page.goto(`${base}${OW}&x=-120&z=215&zoom=5`, { waitUntil: "networkidle" });
    await page.waitForSelector(".mc[data-ready]");
    await page.waitForTimeout(600);
    await page.locator('.mc-pin[aria-label="Farm, point"]').click();
    await page.waitForSelector(".mc-mpop .mk-pop");
    await page.mouse.move(2, 2);
    await page.waitForTimeout(500);
  },
  places: async (page) => {
    await page.goto(`${base}${OW}&x=40&z=-48&zoom=4`, { waitUntil: "networkidle" });
    await page.waitForSelector(".mc[data-ready]");
    await page.waitForTimeout(600);
    await page.click('summary[title="Places"]');
    await page.waitForTimeout(500);
  },
  empty: async (page) => {
    await page.goto(`${base}/map/survival?world=minecraft_the_end`, { waitUntil: "networkidle" });
    await page.waitForSelector(".mc[data-ready]");
    await page.waitForTimeout(600);
    await page.click('summary[title="Places"]');
    await page.waitForTimeout(500);
  }
};

try {
  for (const width of [390, 1440]) {
    for (const theme of ["dark", "light"]) {
      for (const [name, run] of Object.entries(stages)) {
        const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: 1, colorScheme: theme as "dark" | "light" });
        await ctx.addCookies([{ name: "theme", value: theme, url: base }]);
        const page = await ctx.newPage();
        await run(page, width < 600);
        const png = await page.screenshot();
        await sharp(png).webp({ quality: 82 }).toFile(join(out, `${name}-${width}-${theme}.webp`));
        console.log(`${name}-${width}-${theme}.webp`);
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
}
