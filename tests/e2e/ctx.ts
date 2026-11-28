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
  /** a hidden player or server (the scenario's examples) in the HTML or in any text response the page loaded */
  hidden: string | null;
};

export type Crawl = { pages: CrawledPage[]; foreign: string[]; bodiesChecked: number };

export class CheckError extends Error {}

export function expect(cond: unknown, message: string): asserts cond {
  if (!cond) throw new CheckError(message);
}

const TOKEN = /\bcu_[a-z0-9]+_[a-z0-9]+/i;
/** A token, its env name, or where cakeutils lives (the mock's base URL; a real one is checked by the wire checks). */
export const LEAK = (s: string) => TOKEN.test(s) || s.includes("CAKEUTILS_API_TOKEN") || s.includes("mock.invalid");

/**
 * The busy fixtures' examples of what the site must never show (mock/map.ts): the hidden server "staff", the
 * player on it, and the opted-out player "quietgill". As ids, names and uuids, in any page, JSON or SSE frame.
 */
export const HIDDEN_BUSY = /quietgill|5a1c0de0-0000-4000-8000-0000|bosun|\bstaff\b/i;

/**
 * Chromium logs every failed request as a console error. An unrendered map tile answers 404 on purpose (the
 * edge of the mapped area, MAP-PROGRESS 2026-11-15), so those lines are not errors of the page.
 */
export function isTileMiss(text: string, url: string, origin: string): boolean {
  return /Failed to load resource/.test(text) && /status of 404/.test(text) && url.startsWith(`${origin}/map/t/`);
}

/** A page opened for one check: what it logged, what it asked for, and how to close it. */
export type Opened = {
  page: any;
  /** console errors, page errors and CSP violations (unrendered tiles left out) */
  errors: string[];
  /** requests that left the site */
  foreign: string[];
  /** every request URL the page made, in order (path + query) */
  requests: string[];
  close(): Promise<void>;
};

export type OpenOptions = { width?: number; height?: number; theme?: Theme; js?: boolean; reducedMotion?: boolean; /** a phone: touch, a coarse pointer */ touch?: boolean; /** device pixel ratio (1 unless asked) */ dpr?: number; wait?: "networkidle" | "load" | "domcontentloaded"; before?: (page: any) => Promise<void> };

/** A second site started for one check (other limits, another upstream); `stop` ends it and removes its data. */
export type Booted = { base: string; dir: string; /** what the site has printed so far */ logs(): string; stop(): Promise<void> };
/** `mock: null` starts the build against the cakeutils `env` names; `files` go into its data directory first. */
export type Boot = (env: Record<string, string>, opt?: { mock?: Scenario | null; files?: Record<string, string> }) => Promise<Booted>;

/** The pages a crawl always visits, plus a few links discovered from each hub page. */
const HUBS = ["/", "/servers", "/players", "/leaderboards", "/stats", "/milestones", "/about", "/one-soul", "/map"];
const PER_HUB = 6;

export class Ctx {
  private crawls = new Map<string, Promise<Crawl>>();
  private urls: Promise<string[]> | null = null;

  constructor(
    public readonly base: string,
    public readonly scenario: Scenario,
    private readonly browser: Browser,
    /** starts another site for a check that needs its own settings; null against a site we did not start */
    public readonly boot: Boot | null = null,
    /** what must never show on this site (the busy fixtures' hidden examples, or --hidden on a live site) */
    public readonly hidden: RegExp | null = scenario === "busy" ? HIDDEN_BUSY : null,
    /** `abuse`: also run the checks that load a site we did not start (600 streams from this host) */
    public readonly flags: { abuse: boolean } = { abuse: false }
  ) {}

  get origin(): string {
    return new URL(this.base).origin;
  }

  /** Opens `path` in a fresh browser context and records what the page logs and requests. */
  async open(path: string, o: OpenOptions = {}, base: string = this.base): Promise<Opened> {
    const origin = new URL(base).origin;
    const width = o.width ?? 1440;
    const ctx = await this.browser.newContext({
      viewport: { width, height: o.height ?? (width < 600 ? 844 : 900) },
      colorScheme: o.theme ?? "dark",
      javaScriptEnabled: o.js ?? true,
      reducedMotion: o.reducedMotion ? "reduce" : "no-preference",
      hasTouch: !!o.touch,
      isMobile: !!o.touch,
      deviceScaleFactor: o.dpr ?? 1
    });
    if (o.theme) await ctx.addCookies([{ name: "theme", value: o.theme, url: base }]);
    const page = await ctx.newPage();
    page.setDefaultTimeout(15_000);
    const errors: string[] = [];
    const foreign: string[] = [];
    const requests: string[] = [];
    page.on("console", (m: any) => {
      if (m.type() !== "error") return;
      const url: string = m.location()?.url ?? "";
      if (!isTileMiss(m.text(), url, origin)) errors.push(`${m.text()} ${url}`.trim());
    });
    page.on("pageerror", (e: unknown) => errors.push(String(e)));
    page.on("request", (req: any) => {
      const u: string = req.url();
      if (u.startsWith(origin)) requests.push(u.slice(origin.length));
      else if (!u.startsWith("data:") && !u.startsWith("blob:")) foreign.push(u);
    });
    await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`)));
    if (o.before) await o.before(page);
    await page.goto(base + path, { waitUntil: o.wait ?? "networkidle" });
    return { page, errors, foreign, requests, close: () => ctx.close() };
  }

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
    // the table of milestone totals (only linked from the board's heading, which the spread above can miss)
    if ((await this.get("/milestones/players")).status === 200) out.add("/milestones/players");
    // the map (line FM): every server's map (the nav links crowd them out of the spread above), a second world,
    // and the One Soul round map, which draws a finished round on tiles
    const maps = await this.get("/map");
    if (maps.status === 200) {
      const html = await maps.text();
      const servers = [...new Set((html.match(/href="(\/map\/[A-Za-z0-9._-]+)"/g) ?? []).map((m) => m.slice(6, -1)))].slice(0, 4);
      // one server only: /map is that server's map (a redirect)
      const landed = new URL(maps.url).pathname;
      if (/^\/map\/[^/]+$/.test(landed)) servers.push(landed);
      for (const sv of new Set(servers)) {
        out.add(sv);
        const worlds = [...new Set(((await this.html(sv)).match(/href="(\/map\/[^"?]+\?world=[a-z0-9_.-]+)"/g) ?? []).map((m) => m.slice(6, -1)))];
        if (worlds.length > 1) out.add(worlds[worlds.length - 1]);
      }
    }
    if ((await this.get("/one-soul/map")).status === 200) out.add("/one-soul/map");
    if ((await this.get("/one-soul/guide")).status === 200) {
      out.add("/one-soul/guide");
      const secs = [...new Set(((await this.html("/one-soul/guide")).match(/href="(\/one-soul\/guide\/[a-z0-9_-]+)"/g) ?? []).map((m) => m.slice(6, -1)))];
      for (const s of secs.slice(0, 3)) out.add(s);
    }
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
    let hidden: string | null = null;
    let bodiesChecked = 0;
    const secret = this.hidden;
    page.on("console", (m: any) => {
      if (m.type() === "error" && !isTileMiss(m.text(), m.location()?.url ?? "", origin)) errors.push(m.text());
    });
    page.on("pageerror", (e: unknown) => errors.push(String(e)));
    page.on("request", (req: any) => {
      const u: string = req.url();
      if (!u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:")) foreign.add(u);
    });
    const pending: Promise<void>[] = [];
    page.on("response", (res: any) => {
      const type: string = res.headers()["content-type"] ?? "";
      // a live stream never ends: its frames are read by the map checks (map.ts), not here
      if (!/text\/|javascript|json|svg/.test(type) || type.includes("event-stream")) return;
      pending.push(
        res
          .text()
          .then((t: string) => {
            bodiesChecked++;
            if (LEAK(t)) leak = true;
            const m = secret ? secret.exec(t) : null;
            if (m && !hidden) hidden = `${m[0]} in ${new URL(res.url()).pathname}`;
          })
          .catch(() => {})
      );
    });
    const pages: CrawledPage[] = [];
    try {
      for (const u of list) {
        errors.length = 0;
        leak = false;
        hidden = null;
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
        pages.push({ url: u, status: res?.status(), errors: [...errors], overflow, leak, hidden });
      }
    } finally {
      await ctx.close();
    }
    return { pages, foreign: [...foreign], bodiesChecked };
  }
}
