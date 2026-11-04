// Screenshots for a unit's PR (PLAN §7 "Done means"): 390 px and 1440 px, dark and light, full page,
// against a running site. Needs Playwright with Chromium on the machine (the cloud container has it; it is not a dependency,
// so `bun run check` does not resolve it).
//   bun run shots --base http://127.0.0.1:3101 --out docs/screenshots/w0/busy / /players /design
//   --height 2400 for a long page (the shell scrolls inside the window, so a full page is the viewport)
// Themes come from the theme cookie, so the server renders each one. Output: WebP, one file per
// page × width × theme, e.g. home-390-dark.webp.
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const base = opt("base", "http://127.0.0.1:3000");
const out = opt("out", "tests/shots");
const scale = Number(opt("scale", "1"));
// the shell scrolls inside the window (fixed height), so "full page" is the viewport: --height sets it (W5)
const height = Number(opt("height", "0"));
const pages = args.filter((a, i) => a.startsWith("/") && !(i > 0 && args[i - 1].startsWith("--")));
if (!pages.length) pages.push("/");

// Resolved at run time, not by svelte-check: Playwright is not a dependency of the site.
const playwright = "playwright";
const { chromium } = (await import(playwright)) as { chromium: { launch(): Promise<any> } };
const sharp = (await import("sharp")).default;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [390, 1440]) {
    for (const theme of ["dark", "light"]) {
      const ctx = await browser.newContext({ viewport: { width, height: height || (width < 600 ? 844 : 900) }, deviceScaleFactor: scale, colorScheme: theme as "dark" | "light" });
      await ctx.addCookies([{ name: "theme", value: theme, url: base }]);
      const page = await ctx.newPage();
      for (const p of pages) {
        await page.goto(base + p, { waitUntil: "networkidle" });
        await page.waitForTimeout(250);
        const name = (p === "/" ? "home" : p.slice(1).replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "")) + `-${width}-${theme}`;
        const png = await page.screenshot({ fullPage: true });
        await sharp(png).webp({ quality: 82 }).toFile(join(out, `${name}.webp`));
        console.log(`${name}.webp`);
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
