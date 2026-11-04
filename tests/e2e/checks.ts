// The end-to-end checks (PLAN §7, W10): what every scenario must do in a real browser. `run.ts` boots
// the production build on the fixtures and calls these; against the live site only the checks tagged
// `live` run (they must hold on a real network too, whatever has or has not happened on it yet).
//
// Each check throws on failure (the message says what was seen) and may return a short note.
import type { Ctx, Scenario } from "./ctx.ts";
import { expect } from "./ctx.ts";

export type Check = { name: string; on: Scenario[]; run: (ctx: Ctx) => Promise<string | void> };

const ALL: Scenario[] = ["busy", "fresh", "live"];
const MOCK: Scenario[] = ["busy", "fresh"];

/** The pages everyone has, whatever the data. */
const FIXED = ["/", "/servers", "/players", "/leaderboards", "/stats", "/about"];

const TOKEN = /\bcu_[a-z0-9]+_[a-z0-9]+/i;

export const CHECKS: Check[] = [
  {
    name: "every page answers 200",
    on: ALL,
    run: async (ctx) => {
      for (const p of [...FIXED, "/healthz"]) {
        const r = await ctx.get(p);
        expect(r.status === 200, `${p} answered ${r.status}`);
      }
      const ms = await ctx.get("/milestones");
      if (ctx.scenario === "busy") expect(ms.status === 200, `/milestones answered ${ms.status} with milestones on`);
      if (ctx.scenario === "fresh") expect(ms.status === 404, `/milestones answered ${ms.status} with milestones off (404 expected)`);
      if (ctx.scenario === "live") expect(ms.status === 200 || ms.status === 404, `/milestones answered ${ms.status}`);
      return ctx.scenario === "live" ? `milestones ${ms.status === 200 ? "on" : "off"}` : undefined;
    }
  },
  {
    name: "the milestones entry follows the feature flag",
    on: ALL,
    run: async (ctx) => {
      const home = await ctx.html("/");
      const about = await ctx.html("/about");
      const on = (await ctx.get("/milestones")).status === 200;
      const linked = /href="\/milestones"/.test(home);
      expect(linked === on, on ? "milestones are on but the nav has no entry" : "milestones are off but the nav still links to them");
      expect(about.includes(on ? ">on<" : ">off<"), `/about does not say milestones are ${on ? "on" : "off"}`);
      if (!on) expect(!/data-stub|No milestones for this stat|Latest milestones/.test(home), "a milestone section is rendered on the home page while milestones are off");
    }
  },
  {
    name: "/healthz describes the site",
    on: ALL,
    run: async (ctx) => {
      const r = await ctx.get("/healthz");
      expect(r.headers.get("cache-control") === "no-store", "healthz is cacheable");
      const j = (await r.json()) as Record<string, unknown>;
      expect(j.status === "ok", `status ${String(j.status)}`);
      const c = j.cakeutils as Record<string, unknown> | undefined;
      expect(typeof c?.reachable === "boolean", "cakeutils.reachable missing");
      expect(ctx.scenario === "live" ? j.mock === null : j.mock === ctx.scenario, `mock is ${String(j.mock)}`);
      expect(!TOKEN.test(JSON.stringify(j)), "a token in /healthz");
      return `cakeutils ${c!.reachable ? "reachable" : "unreachable"}, recording since ${String(j.recordingSince)}`;
    }
  },
  {
    name: "security headers and a strict CSP on every page",
    on: ALL,
    run: async (ctx) => {
      for (const p of ["/", "/players", "/about"]) {
        const r = await ctx.get(p);
        const csp = r.headers.get("content-security-policy") ?? "";
        expect(csp.includes("default-src 'self'"), `${p}: CSP default-src is not 'self' (${csp || "no CSP"})`);
        expect(csp.includes("frame-ancestors 'none'"), `${p}: CSP allows framing`);
        expect(!/script-src[^;]*'unsafe-inline'/.test(csp), `${p}: CSP allows inline scripts`);
        expect(r.headers.get("x-content-type-options") === "nosniff", `${p}: no nosniff`);
        expect(!!r.headers.get("referrer-policy"), `${p}: no referrer-policy`);
      }
    }
  },
  {
    name: "no token reaches the browser",
    on: ALL,
    run: async (ctx) => {
      const c = await ctx.crawl(1440, "dark");
      const leaks = c.pages.filter((p) => p.leak).map((p) => p.url);
      expect(leaks.length === 0, `a token or its env name in: ${leaks.slice(0, 5).join(", ")}`);
      return `${c.pages.length} pages, ${c.bodiesChecked} responses scanned`;
    }
  },
  {
    name: "no third-party requests from the browser",
    on: ALL,
    run: async (ctx) => {
      const c = await ctx.crawl(1440, "dark");
      expect(c.foreign.length === 0, `requests left the site: ${c.foreign.slice(0, 5).join(", ")}`);
    }
  },
  {
    name: "no console errors on any page",
    on: ALL,
    run: async (ctx) => {
      const c = await ctx.crawl(1440, "dark");
      const bad = c.pages.filter((p) => p.errors.length);
      expect(bad.length === 0, bad.slice(0, 5).map((p) => `${p.url}: ${p.errors[0].slice(0, 160)}`).join(" | "));
    }
  },
  {
    name: "nothing scrolls sideways at 390 px, dark and light",
    on: ALL,
    run: async (ctx) => {
      for (const theme of ["dark", "light"] as const) {
        const c = await ctx.crawl(390, theme);
        const bad = c.pages.filter((p) => p.overflow.length);
        expect(bad.length === 0, `${theme}: ${bad.slice(0, 5).map((p) => `${p.url}: ${p.overflow[0]}`).join(" | ")}`);
      }
    }
  },
  {
    name: "nothing scrolls sideways at 1440 px",
    on: ALL,
    run: async (ctx) => {
      const c = await ctx.crawl(1440, "dark");
      const bad = c.pages.filter((p) => p.overflow.length);
      expect(bad.length === 0, bad.slice(0, 5).map((p) => `${p.url}: ${p.overflow[0]}`).join(" | "));
    }
  },
  {
    name: "the theme follows the cookie and the system otherwise",
    on: ALL,
    run: async (ctx) => {
      for (const theme of ["dark", "light"] as const) {
        const html = await ctx.html("/", { theme });
        expect(new RegExp(`<html[^>]*data-theme="${theme}"`).test(html), `theme cookie ${theme} not applied to <html>`);
      }
      const none = await ctx.html("/");
      expect(!/<html[^>]*data-theme="(dark|light)"/.test(none), "a theme is forced without a cookie");
      expect(/aria-label="[^"]*theme/i.test(none) || /ThemeToggle|fp-theme/.test(none), "no theme toggle in the shell");
    }
  },
  {
    name: "a fresh network shows every empty state on purpose",
    on: ["fresh"],
    run: async (ctx) => {
      const want: Record<string, string[]> = {
        "/": ["Nobody is online right now", "Nobody has played on the network yet", "No history yet", "Recording since"],
        "/players": ["No one has joined yet"],
        "/players?online=1": ["No one has joined yet"],
        "/leaderboards": ["No one has played here yet", "No stat boards yet"],
        "/leaderboards/playtime": ["No one has recorded this yet"],
        "/stats": ["Nothing recorded yet"],
        "/servers/survival": ["Nobody is on right now", "No one has played on this server yet", "No history yet", "Recording since"],
        "/about": [">off<"]
      };
      for (const [p, texts] of Object.entries(want)) {
        const html = await ctx.html(p);
        for (const t of texts) expect(html.includes(t), `${p} does not say "${t}"`);
      }
      // a stat nobody recorded is "nobody yet", never an error page
      const r = await ctx.get("/leaderboards/mined:minecraft:stone");
      expect(r.status === 200, `an unrecorded stat board answered ${r.status}`);
      expect((await r.text()).includes("fp-empty"), "an unrecorded stat board has no empty state");
    }
  },
  {
    name: "a busy network shows real rows, faces, segments and charts",
    on: ["busy"],
    run: async (ctx) => {
      const board = await ctx.html("/leaderboards/playtime");
      expect((board.match(/<tr/g) ?? []).length >= 11, "the playtime board has fewer than 10 rows");
      const players = await ctx.html("/players");
      const links = [...new Set(players.match(/href="\/players\/[^"]+"/g) ?? [])];
      expect(links.length >= 10, `the directory lists ${links.length} players`);
      expect(/src="\/img\/face\/[0-9a-f-]+\.png"/.test(players), "the directory has no faces from our own route");
      const name = links.map((l) => l.slice(15, -1)).find((n) => !/^[0-9a-f-]{36}$/.test(n))!;
      const profile = await ctx.html(`/players/${name}`);
      expect(profile.includes(`<h1`) && profile.includes(decodeURIComponent(name)), `the profile of ${name} has no heading`);
      expect(profile.includes("fp-tile__label"), "the profile has no playtime tiles");
      expect(profile.includes('aria-label="Scope"'), "the profile has no scope switch");
      const scoped = await ctx.get(`/players/${name}?scope=server%3Asurvival`);
      expect(scoped.status === 200, `a scoped profile answered ${scoped.status}`);
      const ms = await ctx.html("/milestones");
      expect((ms.match(/class="fp-ms[\s"]/g) ?? []).length >= 5, "the milestone feed has fewer than 5 rows");
      expect(ms.includes("Reached before tracking began") || ms.includes("<time"), "milestone rows have no time or backfill tag");
      const stats = await ctx.html("/stats");
      const subject = (stats.match(/href="(\/stats\/subject\/[^"]+)"/) ?? [])[1];
      expect(!!subject, "the catalogue links no subject");
      const sub = await ctx.get(subject!);
      expect(sub.status === 200, `${subject} answered ${sub.status}`);
      const server = await ctx.html("/servers/survival");
      expect(server.includes("Busiest hours") && server.includes("fp-plot__cell--"), "the server page has no heatmap cells");
      expect(/<svg[^>]*class="fp-plot/.test(server), "the server page has no chart drawn on the server");
      const home = await ctx.html("/");
      expect(/fp-seg-text|fp-faces/.test(home), "the home page shows no faces or segments");
      return `profile ${decodeURIComponent(name)}, subject ${decodeURIComponent(subject!.slice(15))}`;
    }
  },
  {
    name: "the tables view renders every chart's table twin",
    on: ["busy"],
    run: async (ctx) => {
      for (const p of ["/?view=tables", "/servers/survival?view=tables", "/milestones?view=tables"]) {
        const html = await ctx.html(p);
        const tables = (html.match(/<table class="fp-table"/g) ?? []).length;
        expect(tables >= 2, `${p} renders ${tables} tables`);
        expect(/aria-current="true"[^>]*>[^<]*Tables|Tables<\/a>/.test(html) || /aria-current/.test(html), `${p}: the view switch does not mark Tables`);
        expect(!/<svg[^>]*class="fp-plot\b/.test(html), `${p} still draws charts in the tables view`);
      }
    }
  },
  {
    name: "missing things are pages, never crashes",
    on: ALL,
    run: async (ctx) => {
      const cases: [string, number[], string?][] = [
        ["/players/nobody_such_player_zz", [404], "This page wandered off"],
        ["/servers/no-such-server", [404]],
        ["/no-such-route", [404]],
        ["/leaderboards/mined:minecraft:unobtainium_zz", [200], "fp-empty"],
        ["/leaderboards?scope=garbage", [200]],
        ["/leaderboards?scope=server%3Ano-such-server", [200]],
        ["/players?q=zzzzqq", [200], "fp-empty"],
        ["/players?offset=99999", [200]],
        ["/stats/subject/minecraft%3Ano_such_thing_zz", [200, 404]],
        ["/stats/no_such_type_zz", [200, 404]],
        ["/img/face/not-a-uuid.png", [404]],
        ["/img/icon/nothex.png", [404]]
      ];
      if (ctx.scenario !== "fresh") cases.push(["/milestones?scope=mini%3Asurvival%2Fskyblock-1", [200, 404]], ["/milestones?type=no_such_type_zz", [200, 404]]);
      for (const [p, statuses, text] of cases) {
        const r = await ctx.get(p);
        expect(statuses.includes(r.status), `${p} answered ${r.status}`);
        const body = await r.text();
        expect(!body.includes("Something went wrong"), `${p} shows the error page`);
        if (text) expect(body.includes(text), `${p} does not say "${text}"`);
      }
    }
  },
  {
    name: "images come from our own routes with long caches",
    on: ALL,
    run: async (ctx) => {
      const players = await ctx.html("/players");
      const srcs = [...new Set((players.match(/\ssrc="([^"]+)"/g) ?? []).map((s) => s.slice(6, -1)))];
      expect(srcs.every((s) => s.startsWith("/") || s.startsWith("data:")), `an image from elsewhere: ${srcs.find((s) => !s.startsWith("/") && !s.startsWith("data:"))}`);
      const face = srcs.find((s) => s.startsWith("/img/face/"));
      if (face) {
        const r = await ctx.get(face, { redirect: "manual" });
        expect(r.status === 200 || (r.status === 302 && (r.headers.get("location") ?? "").startsWith("/")), `${face} answered ${r.status} → ${r.headers.get("location")}`);
        if (r.status === 200) expect((r.headers.get("content-type") ?? "").startsWith("image/png"), `${face} is ${r.headers.get("content-type")}`);
      }
      const stats = await ctx.html("/stats");
      const icon = (stats.match(/\/img\/icon\/[0-9a-f]+\.png/) ?? [])[0];
      if (icon) {
        const r = await ctx.get(icon);
        expect(r.status === 200 && (r.headers.get("content-type") ?? "").startsWith("image/png"), `${icon} answered ${r.status} ${r.headers.get("content-type")}`);
        expect(/max-age=\d{4,}/.test(r.headers.get("cache-control") ?? ""), `${icon} is not cached long (${r.headers.get("cache-control")})`);
      }
      const dflt = await ctx.get("/img/face-default.png");
      expect(dflt.status === 200, `the default head answered ${dflt.status}`);
      return `${face ? "face" : "no face"}, ${icon ? "icon" : "no icon yet"}`;
    }
  },
  {
    name: "the design preview is hidden in production",
    on: ["live"],
    run: async (ctx) => {
      for (const p of ["/design", "/design/charts"]) {
        const r = await ctx.get(p);
        expect(r.status === 404, `${p} answered ${r.status} on the live site`);
      }
    }
  }
];

