// What a check gets: plain fetches against the site and one memoised browser crawl per width and
// theme (status, console errors, sideways overflow, token leaks and foreign requests for every page
// the crawl reaches). Playwright is resolved at run time like scripts/screenshots.ts does: it is on the
// machine (the cloud container, a developer's laptop), not a dependency of the site.

export type Scenario = "busy" | "fresh" | "live";
export type Theme = "dark" | "light";

// Playwright's types are not available to svelte-check (not a dependency), so the browser is loose.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Browser = any;

export type CrawledPage = {
  url: string;
  status: number | undefined;
  errors: string[];
  /** elements past the right edge, or scroll containers wider than themselves */
  overflow: string[];
  /** a token or its env name in the HTML or in any text response the page loaded */
  leak: boolean;
};

export type Crawl = { pages: CrawledPage[]; foreign: string[]; bodiesChecked: number };

export class CheckError extends Error {}

export function expect(cond: unknown, message: string): asserts cond {
  if (!cond) throw new CheckError(message);
}

const TOKEN = /\bcu_[a-z0-9]+_[a-z0-9]+/i;
const LEAK = (s: string) => TOKEN.test(s) || s.includes("CAKEUTILS_API_TOKEN");

/** The pages a crawl always visits, plus a few links discovered from each hub page. */
const HUBS = ["/", "/servers", "/players", "/leaderboards", "/stats", "/milestones", "/about"];
const PER_HUB = 6;

export class Ctx {
  private crawls = new Map<string, Promise<Crawl>>();
  private urls: Promise<string[]> | null = null;

  constructor(
    public readonly base: string,
    public readonly scenario: Scenario,
    private readonly browser: Browser
  ) {}

  get(path: string, init: RequestInit & { theme?: Theme } = {}): Promise<Response> {
    const { theme, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (theme) headers.set("cookie", `theme=${theme}`);
    return fetch(this.base + path, { ...rest, headers, redirect: rest.redirect ?? "follow" });
  }

  async html(path: string, init: RequestInit & { theme?: Theme } = {}): Promise<string> {
    return (await this.get(path, init)).text();
  }

  /** Every URL the crawl visits: the hubs that answer, and up to PER_HUB same-site links from each. */
  async pages(): Promise<string[]> {
    if (!this.urls) this.urls = this.discover();
    return this.urls;
  }

  private async discover(): Promise<string[]> {
    const out = new Set<string>();
    for (const hub of HUBS) {
      const r = await this.get(hub);
      if (r.status !== 200) continue;
      out.add(hub);
      const html = await r.text();
      const links = [...new Set((html.match(/href="(\/[^"#]*)"/g) ?? []).map((m) => m.slice(6, -1)))].filter(
        (h) => !h.startsWith("/img/") && !HUBS.includes(h) && !h.startsWith("/design")
      );
      // a spread: first, middle and last links reach different kinds of pages (a profile, a board, a subject)
      const picked = links.length <= PER_HUB ? links : Array.from({ length: PER_HUB }, (_, i) => links[Math.floor((i * (links.length - 1)) / (PER_HUB - 1))]);
      for (const h of picked) out.add(h);
    }
    out.add("/?view=tables");
    return [...out];
  }

  /** One browser pass over `pages()` at a width and theme; the same pass is shared by every check that asks. */
  crawl(width: 390 | 1440, theme: Theme): Promise<Crawl> {
    const key = `${width}:${theme}`;
    let c = this.crawls.get(key);
    if (!c) {
      c = this.runCrawl(width, theme);
      this.crawls.set(key, c);
    }
    return c;
  }

  private async runCrawl(width: number, theme: Theme): Promise<Crawl> {
    const list = await this.pages();
    const origin = new URL(this.base).origin;
    const ctx = await this.browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, colorScheme: theme });
    await ctx.addCookies([{ name: "theme", value: theme, url: this.base }]);
    const page = await ctx.newPage();
    const errors: string[] = [];
    const foreign = new Set<string>();
    let leak = false;
    let bodiesChecked = 0;
    page.on("console", (m: any) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e: unknown) => errors.push(String(e)));
    page.on("request", (req: any) => {
      const u: string = req.url();
      if (!u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:")) foreign.add(u);
    });
    const pending: Promise<void>[] = [];
    page.on("response", (res: any) => {
      const type: string = res.headers()["content-type"] ?? "";
      if (!/text\/|javascript|json|svg/.test(type)) return;
      pending.push(
        res
          .text()
          .then((t: string) => {
            bodiesChecked++;
            if (LEAK(t)) leak = true;
          })
          .catch(() => {})
      );
    });
    const pages: CrawledPage[] = [];
    try {
      for (const u of list) {
        errors.length = 0;
        leak = false;
        pending.length = 0;
        const res = await page.goto(this.base + u, { waitUntil: "networkidle" });
        await Promise.all(pending);
        const overflow: string[] = await page.evaluate(() => {
          const w = document.documentElement.clientWidth;
          const out: string[] = [];
          const scrolls = (el: Element) => /auto|scroll/.test(getComputedStyle(el).overflowX);
          // an element inside a horizontal scroll region that itself fits (a wide table's wrapper) is meant to be wider
          const wrapped = (el: Element) => {
            for (let a = el.parentElement; a; a = a.parentElement) if (scrolls(a) && a.getBoundingClientRect().right <= w + 1) return true;
            return false;
          };
          const name = (el: Element) => `${el.tagName.toLowerCase()}.${(el.getAttribute("class") ?? "").split(" ")[0]}`;
          for (const el of Array.from(document.querySelectorAll("body *"))) {
            const r = el.getBoundingClientRect();
            if (r.right > w + 1 && r.width > 0 && !wrapped(el)) {
              out.push(`${name(el)} reaches ${Math.round(r.right)}px of ${w}`);
              if (out.length >= 3) break;
            }
          }
          const d = document.scrollingElement!;
          if (d.scrollWidth > d.clientWidth + 1) out.push(`the page scrolls sideways (${d.scrollWidth} > ${d.clientWidth})`);
          for (const el of Array.from(document.querySelectorAll("body *"))) {
            if (/auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollWidth > el.clientWidth + 1 && !scrolls(el)) out.push(`${name(el)} scrolls sideways (${el.scrollWidth} > ${el.clientWidth})`);
          }
          return out;
        });
        pages.push({ url: u, status: res?.status(), errors: [...errors], overflow, leak });
      }
    } finally {
      await ctx.close();
    }
    return { pages, foreign: [...foreign], bodiesChecked };
  }
}
