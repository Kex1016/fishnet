// End-to-end checks of the map markers (line FMK, FMK-7): points and areas from cakeutils' markers route drawn on
// /map/<server>, the Places popout, popups, `?marker=` deep links, markers.json; and the security pass (nothing of the
// hidden server "staff" anywhere, player text never markup, bad parameters refused before any call, no write method,
// nothing requested outside the site), cakeutils down, crisp labels, phone width and a 1000-marker stress world.
// `run.ts` runs these after map.ts. Folded in from scripts/map-markers-check.ts (FMK-2): the drawing, Places and
// keyboard, deep links, literal titles and the empty world; its pixel-geometry checks (corners on their pixel at every
// zoom, staircase edges, pin tips, title placement) stay in that script, which runs on a busy site of its own.
//
// Busy fixtures (src/lib/server/cakeutils/mock/markers.ts): survival's overworld holds 5 areas and 3 pins (ids 1..8),
// the nether one area (10), the public mini world one point (11), the end none, creative's overworld none; the hidden
// server "staff" holds ids 20 and 21 with titles starting "STAFF ONLY". Fresh: no server has a map.
// A few checks start a site of their own over HTTP against tests/e2e/map-markers-upstream.ts (hostile titles, the
// stress world, a request log), with the real hide lists: the only way to prove "no upstream call" and "cakeutils down".
// On a live site (`--base`) the checks that hold on any network run; they find a world with markers themselves.
import type { Check } from "./checks.ts";
import { expect, LEAK, type Ctx, type Opened, type Scenario } from "./ctx.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */

const ALL: Scenario[] = ["busy", "fresh", "live"];
const ANY_MAP: Scenario[] = ["busy", "live"];
const BUSY: Scenario[] = ["busy"];

const OW = "/map/survival?world=minecraft_overworld";
const PLACES = [4, 8, 5, 7, 6, 1, 2, 3]; // areas by size, largest first, then pins by id
const STAFF = /STAFF ONLY/i;
const MARKER_KEYS = "bbox,bounds,color,color_auto,created_at,id,kind,label,point,polygon,revision,subtitle,title,updated_at";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- helpers

const ready = (page: any) => page.waitForSelector(".mc[data-ready]", { timeout: 20_000 });

function quiet(o: Opened, where: string): void {
  expect(o.errors.length === 0, `${where}: ${o.errors.slice(0, 3).join(" | ")}`);
  expect(o.foreign.length === 0, `${where} asked another site: ${o.foreign.slice(0, 3).join(", ")}`);
}

const drawn = (page: any) => page.evaluate(() => ({ areas: document.querySelectorAll(".mc-area").length, pins: document.querySelectorAll(".mc-pin").length, labels: document.querySelectorAll("canvas.mc-label").length }));
const popupTitle = (page: any) => page.$eval(".mc-mpop .mk-pop__title", (e: HTMLElement) => e.textContent).catch(() => null);
const view = (page: any) => page.evaluate(() => (window as any).__fmap.view());

/** Reads a stream until `until` holds or `ms` passes, then hangs up; `onOpen` runs once the answer's headers are in. */
async function listen(url: string, ms: number, until: (text: string) => boolean, onOpen?: () => Promise<void>): Promise<{ status: number; text: string }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  let text = "";
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { accept: "text/event-stream" } });
    if (!res.ok || !res.body) return { status: res.status, text: await res.text().catch(() => "") };
    void onOpen?.();
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        if (until(text)) break;
      }
    } catch {
      /* our own hang-up */
    }
    ac.abort();
    return { status: res.status, text };
  } catch {
    return { status: 0, text };
  } finally {
    clearTimeout(timer);
  }
}

function frames(text: string): { event: string; data: any }[] {
  const out: { event: string; data: any }[] = [];
  for (const block of text.split("\n\n")) {
    const event = /^event: (.+)$/m.exec(block)?.[1];
    const data = /^data: (.+)$/m.exec(block)?.[1];
    if (!event || !data) continue;
    try {
      out.push({ event, data: JSON.parse(data) });
    } catch {
      /* cut off */
    }
  }
  return out;
}

/** The servers /map links to, and each one's worlds (from the Worlds popout's links). */
async function mapWorlds(ctx: Ctx, base = ctx.base): Promise<{ server: string; world: string }[]> {
  const r = await fetch(`${base}/map`);
  if (r.status !== 200) return [];
  const landed = /^\/map\/([^/]+)$/.exec(new URL(r.url).pathname);
  const servers = landed ? [landed[1]] : [...new Set(((await r.text()).match(/href="\/map\/([A-Za-z0-9._-]+)"/g) ?? []).map((m) => m.slice(11, -1)))];
  const out: { server: string; world: string }[] = [];
  for (const s of servers) {
    const html = await (await fetch(`${base}/map/${s}`)).text();
    for (const w of new Set((html.match(/href="\/map\/[^"?]+\?world=([a-z0-9_.-]+)"/g) ?? []).map((m) => m.split("world=")[1].slice(0, -1)))) out.push({ server: s, world: w });
  }
  return out;
}

/** The first world (on a live site) whose markers.json has markers, or null. */
async function worldWithMarkers(ctx: Ctx): Promise<{ server: string; world: string; body: any } | null> {
  for (const sw of await mapWorlds(ctx)) {
    const r = await ctx.get(`/map/${sw.server}/markers.json?world=${sw.world}`);
    if (r.status !== 200) continue;
    const body = (await r.json()) as any;
    if (body.markers?.length) return { ...sw, body };
  }
  return null;
}

type Wire = { base: string; upstream: string; requests(): Promise<string[]>; reset(): Promise<void>; bump(server: string, world: string): Promise<number>; down(): Promise<void>; stop(): Promise<void>; logs(): string };

/**
 * The production build against tests/e2e/map-markers-upstream.ts over HTTP (no mock mode), with the owner's hide
 * lists: staff hidden, quietgill opted out. `down()` stops the upstream (cakeutils goes away).
 */
async function wire(ctx: Ctx, variant: "hostile" | "stress"): Promise<Wire> {
  const port = 3600 + Math.floor(Math.random() * 300);
  const upstream = `http://127.0.0.1:${port}`;
  const proc = Bun.spawn(["bun", "tests/e2e/map-markers-upstream.ts", variant, String(port)], { stdout: "ignore", stderr: "ignore" });
  const auth = { authorization: "Bearer cu_e2emk_0123456789abcdefSECRET" };
  const until = Date.now() + 15_000;
  for (;;) {
    try {
      if ((await fetch(`${upstream}/__e2e/requests`)).ok) break;
    } catch {
      /* not up yet */
    }
    if (Date.now() > until) {
      proc.kill();
      throw new Error("the markers upstream did not come up");
    }
    await sleep(150);
  }
  let site: Awaited<ReturnType<NonNullable<Ctx["boot"]>>>;
  try {
    site = await ctx.boot!({ CAKEUTILS_API_URL: upstream, CAKEUTILS_API_TOKEN: auth.authorization.slice(7) }, { mock: null, files: { "hidden.txt": "quietgill\n", "hidden-servers.txt": "staff\n" } });
  } catch (e) {
    proc.kill();
    throw e;
  }
  return {
    base: site.base,
    upstream,
    logs: site.logs,
    requests: async () => (await (await fetch(`${upstream}/__e2e/requests`)).json()) as string[],
    reset: async () => void (await fetch(`${upstream}/__e2e/reset`, { method: "POST" })),
    bump: async (server, world) => ((await (await fetch(`${upstream}/__mock/markers/bump?server=${server}&world=${world}`, { method: "POST" })).json()) as { rev: number }).rev,
    down: async () => {
      proc.kill();
      await proc.exited;
    },
    stop: async () => {
      proc.kill();
      await site.stop();
    }
  };
}

/** A world id or a server cakeutils must never be asked about: refused by the site with 404 before any call. */
const BAD_WORLDS = ["", "MINECRAFT_OVERWORLD", "Minecraft_overworld", "..", "..%2F..%2Fetc%2Fpasswd", "../minecraft_overworld", "a%2Fb", "minecraft_overworld%2F..", "%00", "minecraft_overworld%00", "minecraft_overworld%0a", "a%20b", "a".repeat(65), "%3Cscript%3E"];

// ---- the checks

export const MARKER_CHECKS: Check[] = [
  {
    name: "map markers: drawn on the map, counted in Layers and toggled; Places lists them in the tab order; Enter opens one",
    on: ANY_MAP,
    run: async (ctx) => {
      let path = `${OW}&x=60&z=-50&zoom=3`;
      let want = { areas: 5, pins: 3 };
      if (ctx.scenario === "live") {
        const w = await worldWithMarkers(ctx);
        if (!w) return "no world has markers yet";
        path = `/map/${w.server}?world=${w.world}`;
        want = { areas: w.body.markers.filter((m: any) => m.kind !== "point").length, pins: w.body.markers.filter((m: any) => m.kind === "point").length };
      }
      const o = await ctx.open(path);
      try {
        await ready(o.page);
        const first = await drawn(o.page);
        expect(first.areas === want.areas && first.pins === want.pins, `drawn ${first.areas} areas and ${first.pins} pins, ${want.areas} and ${want.pins} expected`);
        await o.page.click('summary[title="Layers"]');
        const row = o.page.locator('.mc-pop[open] button[data-layer="markers"]');
        expect((await row.textContent())?.includes(String(want.areas + want.pins)), `the Markers layer row says "${(await row.textContent())?.trim()}"`);
        await row.click();
        const off = await drawn(o.page);
        expect(off.areas + off.pins + off.labels === 0 && (await row.getAttribute("aria-pressed")) === "false", `the Markers toggle left ${JSON.stringify(off)}`);
        await row.click();
        expect(JSON.stringify(await drawn(o.page)).startsWith(`{"areas":${want.areas},"pins":${want.pins}`), "the Markers toggle did not bring them back");
        await o.page.keyboard.press("Escape");
        // Tab walks the markers in the Places order
        const n = want.areas + want.pins;
        await o.page.locator(want.areas ? ".mc-area" : ".mc-pin").first().focus();
        const tabbed: string[] = [await o.page.evaluate(() => document.activeElement!.getAttribute("aria-label") ?? "")];
        for (let i = 1; i < n; i++) {
          await o.page.keyboard.press("Tab");
          tabbed.push(await o.page.evaluate(() => document.activeElement!.getAttribute("aria-label") ?? ""));
        }
        await o.page.click('summary[title="Places"]');
        const listed: string[] = await o.page.$$eval(".mc-pop[open] button[data-place]", (bs: HTMLElement[]) => bs.map((b) => b.getAttribute("aria-label") ?? ""));
        const ids: number[] = await o.page.$$eval(".mc-pop[open] button[data-place]", (bs: HTMLElement[]) => bs.map((b) => Number(b.dataset.place)));
        expect(JSON.stringify(tabbed) === JSON.stringify(listed), `Tab order ${JSON.stringify(tabbed)} vs Places ${JSON.stringify(listed)}`);
        if (ctx.scenario === "busy") {
          expect(JSON.stringify(ids) === JSON.stringify(PLACES), `Places order ${ids}`);
          expect(listed[2] === "Market, area, 31 × 18 blocks" && listed[5] === "Spawn, point", `accessible names ${JSON.stringify(listed)}`);
        }
        // arrows move, Enter centres the map and opens the popup with the focus inside
        await o.page.locator(".mc-pop[open] button[data-place]").first().focus();
        await o.page.keyboard.press("ArrowDown");
        const second = await o.page.evaluate(() => Number((document.activeElement as HTMLElement).dataset.place));
        expect(second === ids[1], `ArrowDown went to ${second}, not ${ids[1]}`);
        await o.page.keyboard.press("Enter");
        await o.page.waitForSelector(".mc-mpop .mk-pop");
        expect((await o.page.$(".mc-pop[open]")) === null, "the Places popout stayed open after Enter");
        expect(await o.page.evaluate(() => document.activeElement?.classList.contains("mk-pop")), "the focus did not move into the popup");
        await o.page.waitForFunction((id: number) => new URLSearchParams(location.search).get("marker") === String(id), second, { timeout: 5000 });
        await o.page.keyboard.press("Escape");
        await o.page.waitForSelector(".mc-mpop", { state: "detached", timeout: 3000 });
        quiet(o, path);
        return `${want.areas} areas, ${want.pins} pins`;
      } finally {
        await o.close();
      }
    }
  },
  {
    name: "map markers: ?marker= opens the marker in whichever world holds it; an unknown or hidden id opens the map with a Notice",
    on: BUSY,
    run: async (ctx) => {
      // the nether's and the mini world's markers, from a link without a world
      for (const [id, world, title] of [[10, "minecraft_the_nether", "Fortress"], [11, "cakeutils_miniservers_skyblock-1_overworld", "Island"]] as const) {
        const o = await ctx.open(`/map/survival?marker=${id}`);
        try {
          await ready(o.page);
          await o.page.waitForSelector(".mc-mpop .mk-pop");
          const v = await view(o.page);
          expect(v.world === world, `?marker=${id} opened ${v.world}`);
          expect((await popupTitle(o.page)) === title, `?marker=${id} popup: ${await popupTitle(o.page)}`);
          await o.page.waitForFunction((id: number) => new URLSearchParams(location.search).get("marker") === String(id) && location.search.includes("world="), id, { timeout: 5000 });
          quiet(o, `?marker=${id}`);
        } finally {
          await o.close();
        }
      }
      // without JavaScript the load already chose the world
      const still = await ctx.html("/map/survival?marker=10");
      expect(/<h1[^>]*visually-hidden[^>]*>[^<]*Nether/.test(still), "?marker=10 without JavaScript does not open the nether");
      // the link's own world: the view stays where the link says
      const own = await ctx.open("/map/survival?world=minecraft_overworld&x=300&z=300&zoom=3&marker=1");
      try {
        await ready(own.page);
        await own.page.waitForSelector(".mc-mpop .mk-pop");
        const v = await view(own.page);
        expect(v.x === 300 && v.z === 300 && v.zoom === 3, `the link's view moved to ${JSON.stringify(v)}`);
        quiet(own, "?marker=1 with a view");
      } finally {
        await own.close();
      }
      // unknown, and the hidden server's ids (no world of survival holds them): the same answer
      const answers: string[] = [];
      for (const id of ["99999", "20", "21"]) {
        const o = await ctx.open(`/map/survival?marker=${id}`);
        try {
          await ready(o.page);
          expect((await o.page.textContent(".mc-over"))?.includes("This marker is not on the map any more"), `no Notice for ?marker=${id}`);
          expect((await view(o.page)).world === "minecraft_overworld" && (await o.page.$(".mc-mpop .mk-pop")) === null, `?marker=${id} opened a world or a popup`);
          await o.page.waitForFunction(() => !location.search.includes("marker="), null, { timeout: 5000 });
          const html: string = await o.page.content();
          expect(!STAFF.test(html), `?marker=${id} shows a staff title`);
          // what the page knows about the link (moving players and nonces differ between any two loads)
          const page = await ctx.html(`/map/survival?marker=${id}`);
          answers.push([/link:\{[^}]*\}/, /markerId:[^,]+/, /markerMissing:[^,]+/, /markerFit:[^,]+/, /markers:\{world:"[^"]+",state:"[^"]+",rev:\d+/].map((re) => re.exec(page)?.[0] ?? "MISSING").join(" "));
          quiet(o, `?marker=${id}`);
        } finally {
          await o.close();
        }
      }
      expect(answers[1] === answers[0] && answers[2] === answers[0] && !answers[0].includes("MISSING"), `a hidden server's marker id and an unknown one answer differently: ${answers.join(" | ")}`);
      const bad = await ctx.open("/map/survival?marker=abc");
      try {
        await ready(bad.page);
        expect(!(await bad.page.textContent(".mc-over"))?.includes("not on the map any more"), "a Notice for a malformed id");
      } finally {
        await bad.close();
      }
    }
  },
  {
    name: "map markers: an empty world says so in Places; a world or a network without a map draws nothing and logs nothing",
    on: ALL,
    run: async (ctx) => {
      if (ctx.scenario === "fresh") {
        for (const p of ["/map/survival/markers.json?world=minecraft_overworld", "/map/creative/markers.json?world=minecraft_overworld"]) expect((await ctx.get(p)).status === 404, `${p} is not a 404 on a fresh network`);
        const o = await ctx.open("/map");
        try {
          expect((await o.page.$$(".mc-area, .mc-pin, canvas.mc-label, summary[title='Places']")).length === 0, "a fresh network draws markers or a Places popout");
          quiet(o, "/map on a fresh network");
        } finally {
          await o.close();
        }
        return "no map, no markers";
      }
      if (ctx.scenario === "live") return "the live network decides which worlds are empty";
      for (const path of ["/map/survival?world=minecraft_the_end", "/map/creative?world=minecraft_overworld"]) {
        const o = await ctx.open(path);
        try {
          await ready(o.page);
          await o.page.click('summary[title="Places"]');
          expect((await o.page.textContent(".mc-pop[open]"))?.includes("No markers in this world yet"), `${path}: no EmptyState in Places`);
          expect((await o.page.$$(".mc-area, .mc-pin, canvas.mc-label")).length === 0 && (await o.page.$('summary[title="Layers"]')) === null, `${path}: something drawn, or a Markers layer`);
          quiet(o, path);
        } finally {
          await o.close();
        }
        // without JavaScript the same EmptyState is in the page
        expect((await ctx.html(path)).includes("No markers in this world yet"), `${path} without JavaScript has no EmptyState`);
      }
      // a world cakeutils has no markers route for (One Soul, unknown): 404, nothing drawn on the page that links it
      for (const p of ["/map/onesoul/markers.json?world=minecraft_overworld", "/map/survival/markers.json?world=no_such_world", "/map/lobby/markers.json?world=minecraft_overworld"]) expect((await ctx.get(p)).status === 404, `${p} is not a 404`);
    }
  },
  {
    name: "map markers: markers.json answers like cakeutils (ETag, 304, cache), refuses bad parameters with 404 and has no write method",
    on: ANY_MAP,
    run: async (ctx) => {
      let server = "survival";
      let world = "minecraft_overworld";
      if (ctx.scenario === "live") {
        const w = await worldWithMarkers(ctx);
        const any = w ?? (await mapWorlds(ctx))[0];
        if (!any) return "no server has a map";
        server = any.server;
        world = any.world;
      }
      const path = `/map/${server}/markers.json?world=${world}`;
      const r = await ctx.get(path);
      expect(r.status === 200, `${path} answered ${r.status}`);
      const etag = r.headers.get("etag") ?? "";
      const cc = r.headers.get("cache-control") ?? "";
      expect(/^"m\d+"$/.test(etag) && /private/.test(cc) && /max-age=(15|5)\b/.test(cc) && (r.headers.get("content-type") ?? "").startsWith("application/json"), `headers: etag ${etag}, cache-control ${cc}, ${r.headers.get("content-type")}`);
      const body = (await r.json()) as any;
      expect(body.server === server && body.world === world && typeof body.rev === "number" && etag === `"m${body.rev}"` && Array.isArray(body.markers), `body ${JSON.stringify(body).slice(0, 160)}`);
      expect(Object.keys(body).sort().join() === "markers,rev,server,uni,world", `top-level keys ${Object.keys(body).sort().join()}`);
      for (const m of body.markers) expect(Object.keys(m).sort().join() === MARKER_KEYS, `marker ${m.id} carries ${Object.keys(m).sort().join()}`);
      if (ctx.scenario === "busy") expect(body.rev === 9 && body.markers.length === 8, `survival's overworld: rev ${body.rev}, ${body.markers.length} markers`);
      for (const h of ["ratelimit-limit", "ratelimit-remaining", "set-cookie", "authorization", "www-authenticate"]) expect(!r.headers.has(h), `markers.json carries ${h}`);
      if (!r.headers.get("x-stale")) {
        for (const inm of [etag, "*", `W/${etag}`, `"x", ${etag}`]) {
          const again = await ctx.get(path, { headers: { "if-none-match": inm } });
          expect(again.status === 304 && (await again.arrayBuffer()).byteLength === 0 && again.headers.get("etag") === etag, `If-None-Match ${inm} answered ${again.status}`);
        }
        expect((await ctx.get(path, { headers: { "if-none-match": '"m999999"' } })).status === 200, "an old ETag got a 304");
      }
      for (const w of BAD_WORLDS) {
        const b = await ctx.get(`/map/${server}/markers.json?world=${w}`);
        const t = await b.text();
        expect(b.status === 404, `world=${w.slice(0, 30)} answered ${b.status}`);
        expect(!LEAK(t) && !/"markers"/.test(t), `world=${w.slice(0, 30)} answered with markers or a leak`);
      }
      expect((await ctx.get(`/map/${server}/markers.json`)).status === 404, "markers.json without a world is not a 404");
      for (const s of ["STAFF", "..", "a%2Fb", "%00", "x".repeat(80)]) expect((await ctx.get(`/map/${s}/markers.json?world=${world}`)).status === 404, `server ${s.slice(0, 20)} is not a 404`);
      // read-only: no method but GET (and HEAD) does anything on any marker path
      for (const p of [path, `/map/${server}?world=${world}&marker=1`]) {
        for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
          const w = await ctx.get(p, { method, headers: { "content-type": "application/json", origin: ctx.origin }, body: JSON.stringify({ id: 1, title: "changed" }) });
          expect([403, 404, 405].includes(w.status), `${method} ${p} answered ${w.status}`);
        }
      }
      const after = (await (await ctx.get(path)).json()) as any;
      expect(after.rev === body.rev, "the markers changed after the write attempts");
      return `${body.markers.length} markers, ${etag}, ${BAD_WORLDS.length} bad worlds refused`;
    }
  },
  {
    name: "map markers: no hidden player or server in any world's markers, page or page data",
    on: ANY_MAP,
    run: async (ctx) => {
      if (!ctx.hidden) return "no names given (--hidden a,b)";
      const worlds = await mapWorlds(ctx);
      let markers = 0;
      for (const { server, world } of worlds) {
        for (const p of [`/map/${server}/markers.json?world=${world}`, `/map/${server}?world=${world}`, `/map/${server}/__data.json?world=${world}`]) {
          const r = await ctx.get(p);
          const t = await r.text();
          const hit = ctx.hidden.exec(t)?.[0] ?? STAFF.exec(t)?.[0];
          expect(!hit, `${p} shows "${hit}"`);
          if (p.includes("markers.json") && r.status === 200) markers += ((JSON.parse(t) as any).markers ?? []).length;
        }
      }
      if (ctx.scenario === "busy") {
        for (const p of ["/map/staff/markers.json?world=minecraft_overworld", "/map/staff?marker=20", "/map/survival/markers.json?world=minecraft_overworld&server=staff"]) {
          const r = await ctx.get(p);
          expect(!STAFF.test(await r.text()), `${p} shows a staff marker`);
          if (p.startsWith("/map/staff")) expect(r.status === 404, `${p} answered ${r.status}`);
        }
      }
      return `${worlds.length} worlds, ${markers} markers`;
    }
  },
  {
    name: "map markers over HTTP: no staff marker anywhere, bad parameters never reach cakeutils, hostile titles stay text, live events carry only a rev",
    on: BUSY,
    run: async (ctx) => {
      if (!ctx.boot) return "needs a site of its own";
      const site = await wire(ctx, "hostile");
      const get = (p: string, init?: RequestInit) => fetch(site.base + p, init);
      try {
        // 1. refused before any call: a bad world, the hidden server, a write
        await site.reset();
        for (const w of BAD_WORLDS) expect((await get(`/map/survival/markers.json?world=${w}`)).status === 404, `world=${w.slice(0, 30)} is not a 404`);
        for (const w of ["minecraft_overworld", "minecraft_the_nether", "minecraft_the_end"]) {
          const r = await get(`/map/staff/markers.json?world=${w}`);
          expect(r.status === 404 && !STAFF.test(await r.text()), `/map/staff/markers.json?world=${w} answered ${r.status}`);
        }
        for (const method of ["POST", "PUT", "PATCH", "DELETE"]) expect([403, 404, 405].includes((await get(`/map/survival/markers.json?world=minecraft_overworld`, { method, headers: { origin: site.base } })).status), `${method} on markers.json`);
        const early = await site.requests();
        expect(!early.some((r) => r.includes("/markers")), `the refused requests reached cakeutils: ${early.filter((r) => r.includes("/markers")).slice(0, 3).join(", ")}`);
        expect(early.every((r) => r.startsWith("GET ")), `the site sent cakeutils a ${early.find((r) => !r.startsWith("GET "))}`);

        // 2. no staff marker in any page, page data or JSON (the pages of every survival world, and staff's own ids)
        const worlds = ["minecraft_overworld", "minecraft_the_nether", "minecraft_the_end", "cakeutils_miniservers_skyblock-1_overworld"];
        const paths = ["/", "/map", "/map/survival", "/map/survival/players.json", "/healthz", ...worlds.flatMap((w) => [`/map/survival?world=${w}`, `/map/survival/markers.json?world=${w}`, `/map/survival/__data.json?world=${w}`]), "/map/survival?marker=20", "/map/survival?marker=21", "/map/survival/__data.json?marker=20"];
        for (const p of paths) {
          const r = await get(p);
          const t = await r.text();
          expect(r.status === 200, `${p} answered ${r.status}`);
          const hit = STAFF.exec(t)?.[0] ?? /\bstaff\b|quietgill|bosun/i.exec(t)?.[0];
          expect(!hit, `${p} shows "${hit}"`);
          expect(!t.includes("0123456789abcdefSECRET") && !t.includes(site.upstream.slice(7)), `${p} carries the token or cakeutils' address`);
        }
        for (const p of ["/map/staff", "/map/staff?marker=20", "/map/staff/live", "/map/STAFF/markers.json?world=minecraft_overworld"]) expect((await get(p)).status === 404, `${p} is not a 404`);

        // 3. the live stream: a marker change in survival is one `markers` event {world, rev}; staff's change is nothing
        let bumped = 0;
        const live = await listen(
          `${site.base}/map/survival/live?world=minecraft_overworld`,
          48_000,
          (t) => frames(t).some((f) => f.event === "markers"),
          async () => {
            await sleep(2500); // the hub's first answer is its baseline (FMK-3)
            bumped = await site.bump("survival", "minecraft_overworld");
            await site.bump("staff", "minecraft_overworld");
          }
        );
        expect(live.status === 200, `the stream answered ${live.status}`);
        const mk = frames(live.text).filter((f) => f.event === "markers");
        expect(mk.length === 1 && mk[0].data.world === "minecraft_overworld" && mk[0].data.rev === bumped && Object.keys(mk[0].data).sort().join() === "rev,world", `markers events: ${JSON.stringify(mk.map((f) => f.data))} (rev ${bumped} expected)`);
        expect(!STAFF.test(live.text) && !/\bstaff\b|quietgill|bosun/i.test(live.text), "the stream names the hidden server or player");
        const fresh = await get("/map/survival/markers.json?world=minecraft_overworld", { headers: { "cache-control": "no-cache" } });
        expect(fresh.headers.get("etag") === `"m${bumped}"`, `markers.json after the event: ${fresh.headers.get("etag")}`);
        const all = await site.requests();
        expect(!all.some((r) => /\/v2\/map\/staff\//.test(r)), `the site asked cakeutils about the hidden server: ${all.find((r) => /\/v2\/map\/staff\//.test(r))}`);

        // 4. hostile titles in the nether: text in the popup, Places, accessible names; drawn as glyphs; nothing runs
        const html = await (await get("/map/survival?world=minecraft_the_nether")).text();
        expect(!html.includes("<img src=x") && !html.includes("<script>window.__pwned") && !html.includes("<svg onload"), "a hostile title is raw markup in the page's HTML");
        const titles = ["<img src=x onerror=window.__pwned=1>", "</script><script>window.__pwned=4</script>", "§cRed §lbold &a amp <red>tag</red>", "Café 東京 Ελλάδα Привет ☃ ½"];
        const o = await ctx.open("/map/survival?world=minecraft_the_nether&x=0&z=-40&zoom=2", { before: (page) => page.on("dialog", (d: any) => void d.dismiss()) }, site.base);
        try {
          await ready(o.page);
          await sleep(600);
          const names: string[] = await o.page.$$eval(".mc-area, .mc-pin", (es: Element[]) => es.map((e) => e.getAttribute("aria-label") ?? ""));
          for (const t of titles) expect(names.some((n) => n.startsWith(`${t}, `)), `no accessible name starts with ${JSON.stringify(t)}: ${JSON.stringify(names)}`);
          await o.page.click('summary[title="Places"]');
          const rows: string[] = await o.page.$$eval(".mc-pop[open] button[data-place] .mc-pop__grow", (es: HTMLElement[]) => es.map((e) => e.textContent ?? ""));
          for (const t of titles) expect(rows.includes(t), `Places has no row ${JSON.stringify(t)}`);
          await o.page.keyboard.press("Escape");
          const labels = new Set<string>();
          for (const [id, t] of [[30, titles[0]], [31, titles[1]], [32, titles[2]], [33, titles[3]]] as const) {
            await o.page.evaluate((id: number) => (window as any).__fmap.showMarker(id, { animate: false }), id);
            await o.page.waitForSelector(`.mc-mpop .mk-pop[data-marker="${id}"]`);
            const got = await o.page.$eval(".mc-mpop .mk-pop", (e: HTMLElement) => ({ title: e.querySelector(".mk-pop__title")!.textContent, sub: e.querySelector(".mk-pop__sub")?.textContent ?? null, label: e.getAttribute("aria-label"), els: e.querySelectorAll("img, script, svg, b, red").length }));
            expect(got.title === t && got.label?.startsWith(`${t}, `) && got.els === 0, `popup ${id}: ${JSON.stringify(got)}`);
            // fitted to the area, its title is drawn as glyphs on a canvas (nothing of it in the DOM but the canvas)
            await sleep(400);
            for (const c of await o.page.$$eval("canvas.mc-label", (cs: HTMLElement[]) => cs.map((c) => `${c.dataset.marker}:${c.childNodes.length}`))) labels.add(c);
          }
          expect(["30:0", "32:0", "33:0"].every((l) => labels.has(l)), `titles drawn: ${[...labels].join(", ")} (30, 32 and 33 expected, with no child nodes)`);
          const sub = await o.page.evaluate(async () => {
            (window as any).__fmap.showMarker(30, { animate: false });
            await new Promise((r) => setTimeout(r, 300));
            return document.querySelector(".mc-mpop .mk-pop__sub")?.textContent ?? null;
          });
          expect(sub === "<img src=x onerror=window.__pwned=2>\n</script><script>window.__pwned=3</script>\n&amp; &lt;b&gt; {@html x}", `subtitle ${JSON.stringify(sub)}`);
          const pin = await o.page.$eval('.mc-pin[aria-label^="</script>"]', (e: HTMLElement) => e.style.getPropertyValue("--pin"));
          expect(pin === "#808080", `a colour that is not #rrggbb reached the CSS as ${JSON.stringify(pin)}`);
          const after = await o.page.evaluate(() => ({ pwned: (window as any).__pwned, imgs: document.querySelectorAll('img[src="x"]').length, svgs: document.querySelectorAll("svg[onload]").length, scripts: [...document.scripts].filter((s) => /^window\.__pwned=\d$/.test((s.textContent ?? "").trim())).length, reds: document.querySelectorAll("red").length }));
          expect(after.pwned === undefined && after.imgs + after.svgs + after.scripts + after.reds === 0, `a title became markup: ${JSON.stringify(after)}`);
          quiet(o, "the hostile nether");
        } finally {
          await o.close();
        }
        return `${paths.length} answers clean, 1 markers event (rev ${bumped}), 4 hostile titles as text`;
      } finally {
        await site.stop();
      }
    }
  },
  {
    name: "map markers with cakeutils down: the last good list with \"as of\" and a Notice in Places, the map keeps drawing, nothing 500s",
    on: BUSY,
    run: async (ctx) => {
      if (!ctx.boot) return "needs a site of its own";
      const site = await wire(ctx, "hostile");
      const get = (p: string) => fetch(site.base + p);
      let lastGood = 0;
      try {
        const good = (await (await get("/map/survival/markers.json?world=minecraft_overworld")).json()) as any;
        expect(good.markers?.length === 8, `before the outage: ${good.markers?.length} markers`);
        const kept = await ctx.open(`${OW}&x=60&z=-50&zoom=3`, {}, site.base);
        try {
          await ready(kept.page);
          const before = await drawn(kept.page);
          await site.down();
          // the cached list is fresh for 30 s; past that, the first failed refresh marks it stale
          const t0 = Date.now();
          let stale: Response | null = null;
          while (Date.now() - t0 < 60_000) {
            const r = await get("/map/survival/markers.json?world=minecraft_overworld");
            expect(r.status === 200, `markers.json answered ${r.status} with cakeutils down`);
            if (r.headers.get("x-stale") === "1") {
              stale = r;
              break;
            }
            await r.arrayBuffer();
            await sleep(2000);
          }
          expect(stale, "markers.json never said its list is stale (x-stale) within 60 s of the outage");
          const asOf = Number(stale!.headers.get("x-as-of"));
          lastGood = asOf;
          const body = (await stale!.json()) as any;
          expect(body.markers.length === 8 && body.rev === good.rev && asOf > 0 && asOf <= t0, `the stale list: ${body.markers.length} markers, rev ${body.rev}, as of ${asOf}`);
          expect(/max-age=5\b/.test(stale!.headers.get("cache-control") ?? ""), `a stale list is cached ${stale!.headers.get("cache-control")}`);
          expect(JSON.stringify(await drawn(kept.page)) === JSON.stringify(before), "the open map lost its markers");
          quiet({ ...kept, errors: kept.errors.filter((e) => !/status of 50[23]/.test(e)) }, "the open map during the outage");
        } finally {
          await kept.close();
        }
        // a new visit: the page, the markers drawn, Places with the Notice and "as of"
        const o = await ctx.open(`${OW}&x=60&z=-50&zoom=3`, {}, site.base);
        try {
          expect(o.page.url().startsWith(site.base), "the page did not load");
          await ready(o.page);
          const d = await drawn(o.page);
          expect(d.areas === 5 && d.pins === 3, `with cakeutils down the map draws ${JSON.stringify(d)}`);
          await o.page.click('summary[title="Places"]');
          const text: string = (await o.page.textContent(".mc-pop[open]")) ?? "";
          expect(/could not be refreshed, as of \d{1,2}:\d{2}/.test(text) && (await o.page.$(".mc-pop[open] .fx-notice")) !== null, `Places with cakeutils down: ${text.slice(0, 200)}`);
          expect((await o.page.$$(".mc-pop[open] button[data-place]")).length === 8, "Places lost the last good list");
          // the time is when the list was last good, not when the page asked again (the page refetches as its stream opens)
          await sleep(1500);
          const shown = /as of (\d{2}:\d{2}) UTC/.exec((await o.page.textContent(".mc-pop[open] .fx-notice")) ?? "")?.[1];
          if (shown) expect(shown === new Date(lastGood).toISOString().slice(11, 16), `Places says "as of ${shown} UTC", the list was last good at ${new Date(lastGood).toISOString().slice(11, 16)}`);
          await o.page.locator('.mc-pop[open] button[data-place="5"]').click();
          await o.page.waitForSelector(".mc-mpop .mk-pop");
          expect((await popupTitle(o.page)) === "Market", "a popup does not open with cakeutils down");
          quiet({ ...o, errors: o.errors.filter((e) => !/status of 50[23]/.test(e)) }, "the map with cakeutils down");
        } finally {
          await o.close();
        }
        // nothing is a 500: pages, the JSON routes, a deep link, a world never asked before
        const codes: string[] = [];
        for (const p of ["/", "/map", "/map/survival", "/map/survival?marker=10", "/map/survival?marker=99999", "/map/survival/markers.json?world=minecraft_the_nether", "/map/survival/markers.json?world=minecraft_the_end", "/map/survival?world=minecraft_the_end"]) {
          const r = await get(p);
          await r.arrayBuffer();
          codes.push(`${r.status}`);
          expect(r.status < 500 || r.status === 503, `with cakeutils down ${p} answered ${r.status}`);
          if (!p.includes("markers.json")) expect(r.status === 200, `with cakeutils down ${p} answered ${r.status}`);
        }
        expect(!site.logs().includes("0123456789abcdefSECRET"), "the site's log names the token");
        return `last good list served stale; answers ${codes.join(" ")}`;
      } finally {
        await site.stop();
      }
    }
  },
  {
    name: "map markers render: labels are crisp at DPR 2; at 390 px, Places and the popup fit and nothing scrolls sideways",
    on: ANY_MAP,
    run: async (ctx) => {
      let path = `${OW}&x=40&z=-50&zoom=4`;
      if (ctx.scenario === "live") {
        const w = await worldWithMarkers(ctx);
        if (!w) return "no world has markers yet";
        path = `/map/${w.server}?world=${w.world}`;
      }
      const crisp = await ctx.open(path, { dpr: 2 });
      let checked = 0;
      try {
        await ready(crisp.page);
        // a few views (busy: Market and River bend at two zooms each); a live site: as it opens
        const views = ctx.scenario === "busy" ? [{ x: 35, z: -51, zoom: 5 }, { x: 35, z: -51, zoom: 4 }, { x: 206, z: 106, zoom: 5 }, { x: 206, z: 106, zoom: 4 }] : [null];
        const res: any[] = [];
        for (const v of views) {
          if (v) await crisp.page.evaluate((v: any) => (window as any).__fmap.setView(v, false), v);
          await sleep(500);
          res.push(...(await crisp.page.evaluate(() =>
          [...document.querySelectorAll<HTMLCanvasElement>("canvas.mc-label")].map((c) => {
            const r = c.getBoundingClientRect();
            const px = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
            const alphas = new Set<number>();
            const colours = new Set<string>();
            for (let i = 0; i < px.length; i += 4) {
              alphas.add(px[i + 3]);
              if (px[i + 3] === 255) colours.add(`${px[i]},${px[i + 1]},${px[i + 2]}`);
            }
            return { id: c.dataset.marker, w: c.width, h: c.height, cw: r.width, ch: r.height, alphas: [...alphas], colours: colours.size, aria: c.getAttribute("aria-hidden") };
          })
          )));
        }
        if (ctx.scenario === "busy") expect(res.length >= 3, `${res.length} titles drawn in four views`);
        for (const l of res) {
          expect(Math.abs(l.w - l.cw * 2) <= 1 && Math.abs(l.h - l.ch * 2) <= 1, `title ${l.id}: backing store ${l.w}×${l.h} for ${l.cw}×${l.ch} CSS px at DPR 2`);
          expect(l.alphas.every((a: number) => a === 0 || a === 255), `title ${l.id} has smoothed alpha ${l.alphas.filter((a: number) => a !== 0 && a !== 255).slice(0, 5)}`);
          expect(l.colours <= 2 && l.aria === "true", `title ${l.id}: ${l.colours} opaque colours (shadow and tint), aria-hidden ${l.aria}`);
          checked++;
        }
        quiet(crisp, "DPR 2");
      } finally {
        await crisp.close();
      }
      for (const theme of ["dark"] as const) {
        const o = await ctx.open(path, { width: 390, theme, touch: true });
        try {
          await ready(o.page);
          await o.page.tap('summary[title="Places"]');
          const sheet = await o.page.evaluate(() => {
            const p = document.querySelector(".mc-pop[open] .mc-pop__panel")!.getBoundingClientRect();
            const d = document.documentElement;
            return { l: p.left, r: p.right, t: p.top, b: p.bottom, w: innerWidth, h: innerHeight, side: d.scrollWidth > d.clientWidth + 1 };
          });
          expect(sheet.l >= -0.5 && sheet.r <= sheet.w + 0.5 && sheet.t >= -0.5 && sheet.b <= sheet.h + 0.5 && !sheet.side, `${theme}: Places at ${Math.round(sheet.l)}..${Math.round(sheet.r)} × ${Math.round(sheet.t)}..${Math.round(sheet.b)} on ${sheet.w} × ${sheet.h}${sheet.side ? ", the page scrolls sideways" : ""}`);
          const rows = await o.page.$$eval(".mc-pop[open] button[data-place]", (bs: HTMLElement[]) => bs.map((b) => b.getBoundingClientRect().height));
          expect(rows.every((h: number) => h >= 43.5), `${theme}: Places rows under 44 px on a phone: ${rows.map(Math.round)}`);
          // the longest title in the list opens a popup that fits the screen
          await o.page.locator(".mc-pop[open] button[data-place]").first().tap();
          await o.page.waitForSelector(".mc-mpop .mk-pop");
          await sleep(400);
          const pop = await o.page.evaluate(() => {
            const p = document.querySelector(".mc-mpop")!.getBoundingClientRect();
            const d = document.documentElement;
            return { l: p.left, r: p.right, t: p.top, b: p.bottom, w: innerWidth, h: innerHeight, side: d.scrollWidth > d.clientWidth + 1 };
          });
          expect(pop.l >= -0.5 && pop.r <= pop.w + 0.5 && pop.t >= -0.5 && pop.b <= pop.h + 0.5 && !pop.side, `${theme}: the popup at ${Math.round(pop.l)}..${Math.round(pop.r)} × ${Math.round(pop.t)}..${Math.round(pop.b)} on ${pop.w} × ${pop.h}`);
          quiet(o, `390 px ${theme}`);
        } finally {
          await o.close();
        }
      }
      return `${checked} titles crisp at DPR 2`;
    }
  },
  {
    name: "map markers stress: 1000 markers and 66 000 corners in one world draw, zoom and open quickly",
    on: BUSY,
    run: async (ctx) => {
      if (!ctx.boot) return "needs a site of its own";
      const site = await wire(ctx, "stress");
      try {
        const json = await fetch(`${site.base}/map/survival/markers.json?world=minecraft_overworld`);
        const bytes = (await json.arrayBuffer()).byteLength;
        expect(json.status === 200, `markers.json answered ${json.status}`);
        const page = await fetch(`${site.base}${OW}&x=0&z=0&zoom=2`);
        const pageBytes = (await page.arrayBuffer()).byteLength;
        const o = await ctx.open(`${OW}&x=0&z=0&zoom=2`, { wait: "domcontentloaded", before: (p) => p.addInitScript(() => {
          (window as any).__long = [];
          new PerformanceObserver((l) => (window as any).__long.push(...l.getEntries().map((e) => e.duration))).observe({ type: "longtask", buffered: true });
        }) }, site.base);
        try {
          await ready(o.page);
          const drawnAt: number = await o.page.waitForFunction(() => (document.querySelectorAll(".mc-area").length + document.querySelectorAll(".mc-pin").length >= 1000 ? performance.now() : 0), null, { timeout: 30_000, polling: "raf" }).then((h: any) => h.jsonValue());
          const nav: number = await o.page.evaluate(() => (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming).domContentLoadedEventEnd);
          const count = await drawn(o.page);
          expect(count.areas === 700 && count.pins === 300, `drawn ${JSON.stringify(count)} of 700 areas and 300 pins`);
          // zoom in and out: each zoom end recomputes the titles of every area (brief §5.2)
          const zooms: number[] = [];
          for (const zoom of [3, 4, 5, 4, 3, 2, 1, 0, 2]) {
            zooms.push(
              await o.page.evaluate(async (zoom: number) => {
                const t0 = performance.now();
                (window as any).__fmap.setView({ zoom }, false);
                const pane = document.querySelector<HTMLElement>(".leaflet-mc-labels-pane");
                for (let i = 0; i < 400 && pane && pane.style.visibility === "hidden"; i++) await new Promise((r) => setTimeout(r, 5));
                await new Promise((r) => requestAnimationFrame(() => r(null)));
                return performance.now() - t0;
              }, zoom)
            );
          }
          // a pan across the big rings, then a popup from Places
          const t0 = Date.now();
          await o.page.evaluate(() => (window as any).__fmap.setView({ x: -4000, z: 3000, zoom: 1 }, false));
          await o.page.click('summary[title="Places"]');
          const listed = (await o.page.$$(".mc-pop[open] button[data-place]")).length;
          await o.page.locator('.mc-pop[open] button[data-place="1005"]').click();
          await o.page.waitForSelector(".mc-mpop .mk-pop");
          const pick = Date.now() - t0;
          const long: number[] = await o.page.evaluate(() => (window as any).__long);
          const longest = Math.round(Math.max(0, ...long));
          const draw = Math.round(drawnAt - nav);
          const zoomMax = Math.round(Math.max(...zooms));
          expect(listed === 1000, `Places lists ${listed} of 1000`);
          expect(draw < 4000, `the 1000 markers took ${draw} ms to draw after the page loaded`);
          expect(zoomMax < 1500, `a zoom end took ${zoomMax} ms (titles of 700 areas)`);
          quiet(o, "the stress world");
          return `markers.json ${Math.round(bytes / 1024)} KiB, page ${Math.round(pageBytes / 1024)} KiB; drawn ${draw} ms after DOMContentLoaded; zoom end ${Math.round(Math.min(...zooms))}..${zoomMax} ms; Places pick ${pick} ms; longest task ${longest} ms`;
        } finally {
          await o.close();
        }
      } finally {
        await site.stop();
      }
    }
  }
];
