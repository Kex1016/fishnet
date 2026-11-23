// End-to-end checks of the live map (line FM, FM-7): /map, /map/<server>, tiles, the live stream, "Show on
// map", One Soul round maps and mini worlds, in a real browser on both mock scenarios; and the security pass:
// no token and no hidden player or server in any page, JSON or stream frame, nothing requested outside the
// site, stream limits under 600 connections from one host. `run.ts` runs these after the site's own checks.
//
// On the busy fixtures (mock/map.ts): survival (overworld with a change log, nether, end, a mini world; live
// positions on), creative (positions off), the hidden server "staff" and the opted-out player "quietgill".
// On a live site (`--base`) only the checks that hold on any network run; they look up a server themselves.
//
// Unrendered tiles answer 404 on purpose (the edge of the mapped area); Chromium logs those as console errors
// and ctx.ts leaves exactly those lines out (MAP-PROGRESS, 2026-11-15).
import { connect, type Socket } from "node:net";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Check } from "./checks.ts";
import { expect, LEAK, type Ctx, type Opened, type Scenario } from "./ctx.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */

const ALL: Scenario[] = ["busy", "fresh", "live"];
const ANY_MAP: Scenario[] = ["busy", "live"];
const BUSY: Scenario[] = ["busy"];

const QUIET = "5a1c0de0-0000-4000-8000-00000000a11e"; // quietgill, opted out
const NOBODY = "0b0d1e55-0000-4000-8000-00000000dead"; // never existed
const PNG = [0x89, 0x50, 0x4e, 0x47];

// ---- helpers

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The servers /map links to (ids); a single server redirects /map to its own map. */
async function mapServers(ctx: Ctx): Promise<string[]> {
  const r = await ctx.get("/map");
  if (r.status !== 200) return [];
  const landed = /^\/map\/([^/]+)$/.exec(new URL(r.url).pathname);
  if (landed) return [decodeURIComponent(landed[1])];
  return [...new Set(((await r.text()).match(/href="\/map\/([A-Za-z0-9._-]+)"/g) ?? []).map((m) => m.slice(11, -1)))];
}

type Frame = { event: string; data: any };

/** The SSE frames of a body read so far: `event:` + `data:` blocks (comments and `retry:` are not frames). */
function frames(text: string): Frame[] {
  const out: Frame[] = [];
  for (const block of text.split("\n\n")) {
    const event = /^event: (.+)$/m.exec(block)?.[1];
    const data = /^data: (.+)$/m.exec(block)?.[1];
    if (!event || !data) continue;
    try {
      out.push({ event, data: JSON.parse(data) });
    } catch {
      /* cut off mid-frame by the read's end */
    }
  }
  return out;
}

/** Reads a stream for `ms` (or until `until` says enough), then hangs up. */
async function listen(url: string, ms: number, until?: (text: string) => boolean, headers: Record<string, string> = {}): Promise<{ status: number; headers: Headers; text: string }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  let text = "";
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { accept: "text/event-stream", ...headers } });
    if (!res.ok || !res.body) return { status: res.status, headers: res.headers, text: await res.text().catch(() => "") };
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        if (until?.(text)) break;
      }
    } catch {
      /* our own hang-up */
    }
    ac.abort();
    return { status: res.status, headers: res.headers, text };
  } catch {
    return { status: 0, headers: new Headers(), text };
  } finally {
    clearTimeout(timer);
  }
}

type Knock = { status: number; retryAfter: string | null; type: string | null; socket: Socket };

/** One raw connection asking for `path`; it stays open (that is the point) until `socket.destroy()`. */
function knock(base: string, path: string, headers: Record<string, string> = {}): Promise<Knock> {
  const u = new URL(base);
  return new Promise((resolve) => {
    const socket = connect({ host: u.hostname, port: Number(u.port || 80) });
    let buf = "";
    let done = false;
    const finish = (status: number) => {
      if (done) return;
      done = true;
      resolve({ status, retryAfter: /^retry-after: *(.+)$/im.exec(buf)?.[1]?.trim() ?? null, type: /^content-type: *(.+)$/im.exec(buf)?.[1]?.trim() ?? null, socket });
    };
    socket.setTimeout(20_000, () => finish(0));
    socket.on("error", () => finish(0));
    socket.on("close", () => finish(0));
    socket.on("connect", () => {
      const lines = [`GET ${path} HTTP/1.1`, `Host: ${u.host}`, "Accept: text/event-stream", "Connection: keep-alive", ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`)];
      socket.write(`${lines.join("\r\n")}\r\n\r\n`);
    });
    socket.on("data", (chunk) => {
      if (done) return;
      buf += chunk.toString("latin1");
      if (buf.includes("\r\n\r\n")) finish(Number(/^HTTP\/1\.[01] (\d{3})/.exec(buf)?.[1] ?? 0));
    });
  });
}

/** `n` connections held open at once, opened a hundred at a time (a listen backlog is not what is being tested). */
async function flood(base: string, n: number, path: string, headersOf: (i: number) => Record<string, string> = () => ({})): Promise<{ knocks: Knock[]; ok: number; refused: number; other: number; close(): Promise<void> }> {
  const knocks: Knock[] = [];
  for (let i = 0; i < n; i += 100) knocks.push(...(await Promise.all(Array.from({ length: Math.min(100, n - i) }, (_, j) => knock(base, path, headersOf(i + j))))));
  const count = (f: (k: Knock) => boolean) => knocks.filter(f).length;
  return {
    knocks,
    ok: count((k) => k.status === 200),
    refused: count((k) => k.status === 503),
    other: count((k) => k.status !== 200 && k.status !== 503),
    close: async () => {
      for (const k of knocks) k.socket.destroy();
      await sleep(400);
    }
  };
}

/** A page must be quiet: no console error, no CSP violation, nothing asked of another site. */
function quiet(o: Opened, where: string): void {
  expect(o.errors.length === 0, `${where}: ${o.errors.slice(0, 3).join(" | ")}`);
  expect(o.foreign.length === 0, `${where} asked another site: ${o.foreign.slice(0, 3).join(", ")}`);
}

const ready = (page: any) => page.waitForSelector(".mc[data-ready]", { timeout: 20_000 });

/** Every key of the hidden examples (or --hidden names) in a text, or null. */
function seen(ctx: Ctx, text: string): string | null {
  return ctx.hidden ? (ctx.hidden.exec(text)?.[0] ?? null) : null;
}

// ---- the checks

export const MAP_CHECKS: Check[] = [
  {
    name: "map: the entry, the list and each server's page follow what the network has",
    on: ALL,
    run: async (ctx) => {
      const home = await ctx.html("/");
      const r = await ctx.get("/map");
      const linked = /href="\/map"/.test(home);
      if (ctx.scenario === "live") {
        expect(r.status === 200 || r.status === 404, `/map answered ${r.status}`);
        expect(linked === (r.status === 200), r.status === 200 ? "the map answers but the nav has no entry" : "the nav links to a map that is a 404");
        return r.status === 200 ? `${(await mapServers(ctx)).length} servers with a map` : "map off";
      }
      expect(r.status === 200, `/map answered ${r.status}`);
      expect(linked, "the nav has no Map entry");
      const html = await r.text();
      if (ctx.scenario === "fresh") {
        expect(html.includes("No server has a map yet"), '/map does not say "No server has a map yet" on a fresh network');
        for (const p of ["/map/survival", "/map/survival/live", "/map/survival/players.json", "/map/t/survival/minecraft_overworld/3/0_0.png"]) expect((await ctx.get(p)).status === 404, `${p} is not a 404 without a map`);
        expect(!(await ctx.html("/servers/survival")).includes('href="/map/survival"'), "a server without a map links to one");
        expect(/disabled[^>]*>[^<]*(<[^>]+>[^<]*)*Show on map|Show on map/.test(await ctx.html("/players")) === false, "the directory shows a map button");
        return;
      }
      const servers = await mapServers(ctx);
      expect(servers.includes("survival") && servers.includes("creative"), `/map lists ${servers.join(", ") || "nothing"}`);
      expect(html.includes("live positions") && html.includes("no live positions"), "/map does not tell live positions on from off");
      for (const s of servers) expect((await ctx.get(`/map/${s}`)).status === 200, `/map/${s} did not answer 200`);
      // not on the map: a server without one, the hidden one, the One Soul server, nonsense
      for (const s of ["lobby", "staff", "onesoul", "no-such-server", "a%2Fb", "..%2F..", "%00"]) expect((await ctx.get(`/map/${s}`)).status === 404, `/map/${s} is not a 404`);
      expect((await ctx.html("/servers/survival")).includes('href="/map/survival"'), "the server page has no link to its map");
      return `${servers.join(", ")}`;
    }
  },
  {
    name: "map: a server's map fills the area beside the nav, with tiles, dots, popouts and a share link",
    on: ANY_MAP,
    run: async (ctx) => {
      const server = ctx.scenario === "busy" ? "survival" : (await mapServers(ctx))[0];
      if (!server) return "no server has a map";
      const o = await ctx.open(`/map/${server}`);
      try {
        await ready(o.page);
        await o.page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>(".mc__map img.leaflet-tile")].some((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15_000 });
        const box = await o.page.evaluate(() => {
          const area = document.querySelector(".fx-main")!.getBoundingClientRect();
          const stage = document.querySelector(".mc-stage")!.getBoundingClientRect();
          const d = document.documentElement;
          return { area: [area.left, area.top, area.width, area.height], stage: [stage.left, stage.top, stage.width, stage.height], scrolls: d.scrollHeight > d.clientHeight + 1 || d.scrollWidth > d.clientWidth + 1, framed: !!document.querySelector(".fp-page") };
        });
        expect(box.area.every((v: number, i: number) => Math.abs(v - box.stage[i]) <= 1), `the map is ${box.stage.map(Math.round)} in an area of ${box.area.map(Math.round)}`);
        expect(!box.scrolls && !box.framed, "the map page scrolls or sits in a page frame");
        const labels: string[] = await o.page.$$eval("summary", (els: HTMLElement[]) => els.map((e) => e.getAttribute("title") ?? ""));
        for (const l of ["Worlds", "Players", "Share"]) expect(labels.includes(l), `no ${l} popout (${labels.join(", ")})`);
        // the player list is the twin of the dots: same players of this world
        await o.page.click('summary[title="Players"]');
        const twin = await o.page.evaluate(() => ({ rows: document.querySelectorAll(".mc-pop[open] .mp-row").length, dots: document.querySelectorAll(".mc__map .mc-dot-icon").length }));
        if (ctx.scenario === "busy") expect(twin.rows > 0, "nobody is listed on the busy fixtures");
        expect(twin.rows === twin.dots, `${twin.rows} players listed in this world, ${twin.dots} dots drawn`);
        // the address bar is a link to the view: pan with the keyboard, reload, same place
        await o.page.keyboard.press("Escape");
        const first = await o.page.evaluate(() => (window as any).__fmap.view());
        await o.page.focus(".mc__map");
        await o.page.keyboard.press("ArrowRight");
        await o.page.waitForFunction((x: number) => (window as any).__fmap.view().x !== x, first.x, { timeout: 8000 });
        // the link is written a moment after the map stops moving
        await o.page.waitForFunction(
          () => {
            const v = (window as any).__fmap.view();
            const q = new URLSearchParams(location.search);
            return q.get("world") === v.world && Number(q.get("x")) === v.x && Number(q.get("z")) === v.z && Number(q.get("zoom")) === v.zoom;
          },
          null,
          { timeout: 8000 }
        ).catch(() => {});
        const before = await o.page.evaluate(() => ({ v: (window as any).__fmap.view(), q: location.search }));
        const q = new URLSearchParams(before.q);
        expect(Number(q.get("x")) === before.v.x && Number(q.get("z")) === before.v.z && q.get("world") === before.v.world, `the link ${before.q} is not the view ${JSON.stringify(before.v)}`);
        expect(before.v.x !== first.x, "the arrow key did not move the map");
        await o.page.reload({ waitUntil: "networkidle" });
        await ready(o.page);
        const after = await o.page.evaluate(() => (window as any).__fmap.view());
        expect(after.x === before.v.x && after.z === before.v.z && after.zoom === before.v.zoom && after.world === before.v.world, `the link opened ${JSON.stringify(after)}, not ${JSON.stringify(before.v)}`);
        const credit = await o.page.textContent(".mc__credit");
        expect(credit?.includes("squaremap"), "no squaremap credit on the map");
        quiet(o, `/map/${server}`);
        return `${server}: ${twin.dots} dots`;
      } finally {
        await o.close();
      }
    }
  },
  {
    name: "map: without JavaScript it is a still picture with working world and player lists",
    on: ANY_MAP,
    run: async (ctx) => {
      const server = ctx.scenario === "busy" ? "survival" : (await mapServers(ctx))[0];
      if (!server) return "no server has a map";
      const o = await ctx.open(`/map/${server}`, { js: false, wait: "load" });
      try {
        const stills: string[] = await o.page.$$eval(".mc__still img.mc-still__tile", (is: HTMLImageElement[]) => is.map((i) => i.getAttribute("src") ?? ""));
        expect(stills.length > 0 && stills.every((s) => s.startsWith(`/map/t/${encodeURIComponent(server)}/`)), `still tiles: ${stills.slice(0, 2).join(", ") || "none"}`);
        await o.page.click('summary[title="Worlds"]');
        const worlds: string[] = await o.page.$$eval(".mc-pop[open] a.mc-pop__item", (as: HTMLAnchorElement[]) => as.map((a) => a.getAttribute("href") ?? "").filter((h) => h.includes("?world=")));
        expect(worlds.length >= 1, "the Worlds popout lists no world without JavaScript");
        if (ctx.scenario === "busy") {
          expect((await o.page.$$(".mc__still .mc-dot--still")).length > 0, "no still dots on the busy fixtures");
          await o.page.click('summary[title="Players"]');
          expect((await o.page.$$(".mc-pop[open] .mc-pop__item")).length > 0, "the Players popout lists nobody without JavaScript");
          const nether = worlds.find((w) => w.includes("the_nether"))!;
          await o.page.goto(ctx.base + nether, { waitUntil: "load" });
          expect((await o.page.textContent("h1.visually-hidden"))?.includes("Nether"), "the Nether link did not open the Nether");
          expect((await o.page.$$("img.mc-still__tile[src*='minecraft_the_nether']")).length > 0, "the Nether has no still tiles");
        }
        quiet(o, `/map/${server} without JavaScript`);
        return `${stills.length} still tiles, ${worlds.length} worlds`;
      } finally {
        await o.close();
      }
    }
  },
  {
    name: "map tiles: versioned ones are immutable, others revalidate, unrendered and malformed ones are 404s",
    on: ANY_MAP,
    run: async (ctx) => {
      const server = ctx.scenario === "busy" ? "survival" : (await mapServers(ctx))[0];
      if (!server) return "no server has a map";
      const html = await ctx.html(`/map/${server}`);
      const srcs = [...new Set((html.match(/\/map\/t\/[^"'\s<>]+\.png(\?v=[A-Za-z0-9._:%-]+)?/g) ?? []).map((s) => s.replaceAll("&amp;", "&")))];
      expect(srcs.length > 0, "the page names no tile");
      let good: { src: string; res: Response } | null = null;
      for (const src of srcs) {
        const res = await ctx.get(src);
        if (res.status === 200) {
          good = { src, res };
          break;
        }
        expect(res.status === 404, `${src} answered ${res.status}`);
      }
      expect(good, "none of the page's tiles is rendered");
      const { src, res } = good!;
      const bytes = new Uint8Array(await res.arrayBuffer());
      expect(res.headers.get("content-type") === "image/png" && PNG.every((b, i) => bytes[i] === b), `${src} is not a PNG`);
      const bare = src.split("?")[0];
      if (src.includes("?v=")) expect(/immutable/.test(res.headers.get("cache-control") ?? ""), `a versioned tile is not immutable (${res.headers.get("cache-control")})`);
      const plain = await ctx.get(bare);
      const cc = plain.headers.get("cache-control") ?? "";
      expect(plain.status === 200 && /max-age=60\b/.test(cc) && !/immutable/.test(cc), `an unversioned tile answered ${plain.status} with "${cc}"`);
      const etag = plain.headers.get("etag");
      expect(!!etag, "an unversioned tile has no ETag");
      const again = await ctx.get(bare, { headers: { "if-none-match": etag! } });
      expect(again.status === 304 && (await again.arrayBuffer()).byteLength === 0, `If-None-Match answered ${again.status}`);
      // nothing of cakeutils' own answer travels along
      for (const h of ["ratelimit-limit", "ratelimit-remaining", "set-cookie", "www-authenticate", "server-timing"]) expect(!plain.headers.has(h), `a tile carries cakeutils' ${h} header`);
      const dir = bare.slice(0, bare.lastIndexOf("/", bare.lastIndexOf("/") - 1)); // /map/t/<server>/<world>
      const far = await ctx.get(`${dir}/0/9999_9999.png`);
      expect(far.status === 404 && /max-age=300/.test(far.headers.get("cache-control") ?? ""), `an unrendered tile answered ${far.status} "${far.headers.get("cache-control")}"`);
      const bad = [`${dir}/3/0_0.txt`, `${dir}/3/00_0.png`, `${dir}/3/0_0.png%00`, `${dir}/99/0_0.png`, `${dir}/-1/0_0.png`, `${dir}/3/0_99999999999.png`, `${dir}/3/..%2f..%2f0_0.png`, `/map/t/${server}/..%2f..%2fetc/3/0_0.png`, `/map/t/${server}/UPPER/3/0_0.png`, `/map/t/${server}/a..b/3/0_0.png`, `/map/t/..%2f${server}/minecraft_overworld/3/0_0.png`, `/map/t/${server}/round/0/minecraft_overworld/3/0_0.png`, `/map/t/${server}/round/x/minecraft_overworld/3/0_0.png`];
      for (const p of bad) {
        const r = await ctx.get(p);
        expect(r.status === 404 || r.status === 400, `${p} answered ${r.status}`);
        expect(!LEAK(await r.text()), `${p} leaks in its error`);
      }
      if (ctx.scenario === "busy") {
        for (const p of ["/map/t/staff/minecraft_overworld/3/0_0.png", "/map/t/onesoul/minecraft_overworld/3/0_0.png", "/map/t/staff/round/1/minecraft_overworld/3/0_0.png", "/map/t/lobby/minecraft_overworld/3/0_0.png"]) expect((await ctx.get(p)).status === 404, `${p} is not a 404`);
      }
      return `${src}`;
    }
  },
  {
    name: "map live stream: snapshot, moving dots, tile changes in the page's own epoch, nothing but positions",
    on: ANY_MAP,
    run: async (ctx) => {
      const server = ctx.scenario === "busy" ? "survival" : (await mapServers(ctx))[0];
      if (!server) return "no server has a map";
      // connect the way the page does: the address its EventSource uses
      const o = await ctx.open(`/map/${server}`);
      let live: string | undefined;
      try {
        await ready(o.page);
        live = o.requests.find((r) => new RegExp(`^/map/${server}/live\\?`).test(r));
      } finally {
        await o.close();
      }
      if (ctx.scenario === "live" && !live) return "this server sends no live feed";
      expect(live, "the page opened no live stream");
      const page = new URLSearchParams(live!.split("?")[1]);
      const got = await listen(ctx.base + live!, ctx.scenario === "busy" ? 9000 : 5000);
      expect(got.status === 200, `the stream answered ${got.status}`);
      expect((got.headers.get("content-type") ?? "").startsWith("text/event-stream"), `content-type ${got.headers.get("content-type")}`);
      expect(got.headers.get("cache-control") === "no-store" && got.headers.get("x-accel-buffering") === "no" && !got.headers.get("content-encoding"), "the stream may be cached, buffered or compressed");
      expect(got.text.startsWith("retry: 5000\n\n"), "the stream does not open with retry: 5000");
      expect(!LEAK(got.text), "a token or cakeutils' address in the stream");
      const fr = frames(got.text);
      expect(fr[0]?.event === "status" && ["live", "stale", "offline"].includes(fr[0].data.state), `first frame: ${JSON.stringify(fr[0])}`);
      const players = fr.filter((f) => f.event === "players");
      const tiles = fr.filter((f) => f.event === "tiles");
      for (const f of players) {
        expect(Array.isArray(f.data.players) && Array.isArray(f.data.gone) && typeof f.data.at === "number", `a players frame is malformed: ${JSON.stringify(f.data).slice(0, 120)}`);
        for (const p of f.data.players) {
          expect(Object.keys(p).sort().join() === "name,uuid,world,x,yaw,z", `a dot carries ${Object.keys(p).join()}`);
          expect(Number.isInteger(p.x) && Number.isInteger(p.z) && Number.isInteger(p.yaw), `a position is not whole blocks: ${JSON.stringify(p)}`);
        }
      }
      // a reset would mean the hub and the page disagree about the change log (the busy mock once did: epoch)
      for (const f of tiles) {
        if (page.get("epoch")) expect(f.data.epoch === page.get("epoch") && f.data.reset === false, `tiles frame in epoch ${f.data.epoch} reset ${f.data.reset}; the page loaded ${page.get("epoch")}`);
        for (const t of f.data.tiles) expect(String(t[0]).startsWith(`${f.data.epoch}.`) && Number(String(t[0]).split(".").pop()) > Number(page.get("seq") ?? -1), `tile version ${t[0]} is not newer than the page's ${page.get("seq")}`);
      }
      if (ctx.scenario === "busy") {
        expect(players.length >= 3, `${players.length} players frames in 9 s (a snapshot and at least two moves expected)`);
        expect(players[0].data.players.length >= 2 && players.slice(1).every((f) => f.data.players.length <= players[0].data.players.length), "the first frame is not the full snapshot");
        expect(page.get("epoch") && page.get("seq"), `the page connected without its change log position: ${live}`);
        // a stream without a position gets the whole log; a wrong epoch gets a reset
        const cold = frames((await listen(`${ctx.base}/map/survival/live?world=minecraft_overworld`, 4000, (t) => t.includes("event: tiles") && t.endsWith("\n\n"))).text).find((f) => f.event === "tiles");
        expect(cold && cold.data.reset === false && cold.data.tiles.length > 1, "a stream without a position did not get the log");
        const old = frames((await listen(`${ctx.base}/map/survival/live?world=minecraft_overworld&epoch=another&seq=5`, 4000, (t) => t.includes("event: tiles") && t.endsWith("\n\n"))).text).find((f) => f.event === "tiles");
        expect(old && old.data.reset === true, "a stream from another epoch was not told to reload its tiles");
        // a page a few changes behind gets exactly those, in its own epoch, without a reset
        const behind = Number(page.get("seq")) - 3;
        const few = frames((await listen(`${ctx.base}/map/survival/live?world=minecraft_overworld&epoch=${page.get("epoch")}&seq=${behind}`, 4000, (t) => t.includes("event: tiles") && t.endsWith("\n\n"))).text).find((f) => f.event === "tiles");
        expect(few && few.data.reset === false && few.data.epoch === page.get("epoch") && few.data.tiles.length >= 3 && few.data.tiles.length <= 5, `three changes behind got ${JSON.stringify(few?.data).slice(0, 160)}`);
        expect(few!.data.tiles.every((t: [string, number, number, number]) => Number(t[0].split(".").pop()) > behind), "the catch-up repeats changes the page already has");
        // junk parameters never break it
        const junk = await listen(`${ctx.base}/map/survival/live?world=..%2F..&epoch=%3Cscript%3E&seq=-1e9`, 1500);
        expect(junk.status === 200 && !frames(junk.text).some((f) => f.event === "tiles"), "junk parameters got a tiles frame or an error");
      }
      const json = await ctx.get(`/map/${server}/players.json`);
      expect(json.status === 200 || json.status === 503, `players.json answered ${json.status}`);
      if (json.status === 200) {
        const snap = (await json.json()) as any;
        expect(snap.server === server && Array.isArray(snap.players) && ["live", "stale", "offline"].includes(snap.state) && typeof snap.at === "number", `players.json: ${JSON.stringify(snap).slice(0, 160)}`);
        expect(/max-age=2\b/.test(json.headers.get("cache-control") ?? ""), `players.json cache-control ${json.headers.get("cache-control")}`);
      }
      return `${players.length} players frames, ${tiles.length} tiles frames`;
    }
  },
  {
    name: "map: a refused stream falls back to polling players.json, and the dots stay",
    on: BUSY,
    run: async (ctx) => {
      const o = await ctx.open("/map/survival", {
        before: (page) => page.route("**/map/survival/live*", (route: any) => route.fulfill({ status: 503, headers: { "retry-after": "30", "content-type": "text/plain" }, body: "Too many live map streams; try again shortly." }))
      });
      try {
        await ready(o.page);
        // three refusals (1 s and 3 s apart), then the poll
        await o.page.waitForRequest((r: any) => r.url().endsWith("/map/survival/players.json"), { timeout: 15_000 });
        const tries = o.requests.filter((r) => r.startsWith("/map/survival/live")).length;
        expect(tries === 3, `${tries} stream attempts before the fallback (3 expected)`);
        await sleep(600);
        expect((await o.page.$$(".mc__map .mc-dot-icon")).length > 0, "no dots while polling");
        const bad = o.errors.filter((e) => !/status of 503/.test(e));
        expect(bad.length === 0, bad.slice(0, 3).join(" | "));
      } finally {
        await o.close();
      }
    }
  },
  {
    name: "map: a server with live positions off shows the map and says so",
    on: BUSY,
    run: async (ctx) => {
      const o = await ctx.open("/map/creative");
      try {
        await ready(o.page);
        expect((await o.page.textContent(".mp-status"))?.includes("Live positions are off"), "no status line");
        await o.page.click('summary[title="Players"]');
        expect((await o.page.textContent(".mc-pop[open]"))?.includes("Live positions are off"), "the Players popout does not say it");
        expect((await o.page.$$(".mc__map .mc-dot-icon")).length === 0, "dots on a server with positions off");
        expect(!o.requests.some((r) => r.startsWith("/map/creative/live")), "a live stream with nothing to listen for");
        quiet(o, "/map/creative");
      } finally {
        await o.close();
      }
      const snap = (await (await ctx.get("/map/creative/players.json")).json()) as any;
      expect(Array.isArray(snap.players) && snap.players.length === 0, "players.json names players while positions are off");
    }
  },
  {
    name: "map: hidden players and servers are in no page, JSON, tile route or stream frame",
    on: ANY_MAP,
    run: async (ctx) => {
      if (!ctx.hidden) return "no names given (--hidden a,b)";
      const servers = await mapServers(ctx);
      const pages = ["/", "/map", "/servers", "/players", "/about", "/leaderboards", ...servers.flatMap((s) => [`/map/${s}`, `/map/${s}/players.json`])];
      if (ctx.scenario === "busy") {
        pages.push("/players?q=quiet", "/players?online=1", "/map/survival?world=minecraft_the_nether", "/map/survival?world=cakeutils_miniservers_skyblock-1_overworld", "/servers/survival", "/one-soul/map?round=1", `/map/survival?follow=${QUIET}`, "/healthz");
      }
      for (const p of pages) {
        const r = await ctx.get(p);
        const hit = seen(ctx, await r.text());
        expect(!hit, `${p} shows "${hit}"`);
      }
      // the crawl saw every response of every page in a browser, the map's among them
      const crawl = await ctx.crawl(1440, "dark");
      const bad = crawl.pages.filter((p) => p.hidden);
      expect(bad.length === 0, bad.slice(0, 3).map((p) => `${p.url}: ${p.hidden}`).join(" | "));
      // the stream, long enough for a walking player to come by several times
      let framesSeen = 0;
      for (const s of servers.slice(0, 3)) {
        const got = await listen(`${ctx.base}/map/${s}/live`, ctx.scenario === "busy" ? 7000 : 4000);
        if (got.status !== 200) continue;
        const hit = seen(ctx, got.text);
        expect(!hit, `the stream of ${s} carries "${hit}"`);
        framesSeen += frames(got.text).length;
      }
      if (ctx.scenario !== "busy") return `${pages.length} answers, ${framesSeen} frames`;
      // the hidden server and the opted-out player answer like things that do not exist
      for (const p of ["/map/staff", "/map/staff/live", "/map/staff/players.json", "/servers/staff", "/players/quietgill", `/players/${QUIET}`, "/players/Bosun"]) {
        const r = await ctx.get(p);
        expect(r.status === 404, `${p} answered ${r.status}`);
        const hit = seen(ctx, (await r.text()).replaceAll(p, ""));
        expect(!hit, `the 404 of ${p} shows "${hit}"`);
      }
      // following an opted-out player says exactly what following nobody says
      const strip = (html: string, uuid: string) => html.replaceAll(uuid, "UUID").replace(/asOf:\d+/g, "asOf:0").replace(/\b1[0-9]{12}\b/g, "T");
      const [a, b] = await Promise.all([ctx.html(`/map/survival?follow=${QUIET}`), ctx.html(`/map/survival?follow=${NOBODY}`)]);
      expect(!a.includes(QUIET) && !b.includes(NOBODY), "the follow of someone who is not there stays in the page");
      expect(!a.includes("fx-notice") && !b.includes("fx-notice"), "a Notice about someone the page must not know");
      const sa = strip(a, QUIET).match(/link:\{[^}]*\}/)?.[0];
      const sb = strip(b, NOBODY).match(/link:\{[^}]*\}/)?.[0];
      expect(sa === sb, `a hidden player and nobody differ in the page's link: ${sa} vs ${sb}`);
      return `${pages.length} answers, ${crawl.pages.length} crawled pages, ${framesSeen} frames`;
    }
  },
  {
    name: "map: nothing the map sends carries a token, and its pages ask only the site",
    on: ANY_MAP,
    run: async (ctx) => {
      const servers = await mapServers(ctx);
      if (!servers.length) return "no server has a map";
      const s = servers[0];
      const answers = ["/map", `/map/${s}`, `/map/${s}/players.json`, `/map/${s}/live?world=x`, `/map/${s}?world=nope&x=1&z=2&zoom=3&follow=${NOBODY}`, "/map/%00", "/map/t/x/y/z/w.png"];
      for (const p of answers) {
        const r = p.includes("/live") ? await listen(ctx.base + p, 1500) : await ctx.get(p);
        const text = "text" in r && typeof r.text === "string" ? r.text : await (r as Response).text();
        expect(!LEAK(text), `${p} carries a token, its env name or cakeutils' address`);
        const h = [...r.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n");
        expect(!LEAK(h) && !/authorization|ratelimit-/i.test(h), `${p} carries a header it should not: ${h.match(/^(authorization|ratelimit-[a-z]+).*$/im)?.[0] ?? "a token"}`);
      }
      const crawl = await ctx.crawl(1440, "dark");
      const maps = crawl.pages.filter((p) => p.url.startsWith("/map") || p.url.startsWith("/one-soul/map"));
      if (ctx.scenario === "busy") expect(maps.length >= 4, `the crawl reached ${maps.length} map pages`);
      expect(maps.every((p) => !p.leak), `a token in ${maps.find((p) => p.leak)?.url}`);
      expect(crawl.foreign.length === 0, `requests left the site: ${crawl.foreign.slice(0, 3).join(", ")}`);
      const csp = (await ctx.get(`/map/${s}`)).headers.get("content-security-policy") ?? "";
      expect(/connect-src 'self'/.test(csp) && /img-src 'self' data:/.test(csp) && !/unsafe-eval/.test(csp), `the map page's CSP: ${csp}`);
      return `${maps.length} map pages crawled`;
    }
  },
  {
    name: "map: Show on map links a profile to the map and follows the player; the reasons it cannot are shown",
    on: BUSY,
    run: async (ctx) => {
      const snap = (await (await ctx.get("/map/survival/players.json")).json()) as { players: { uuid: string; name: string; world: string }[] };
      const here = snap.players.find((p) => p.world === "minecraft_overworld")!;
      const nether = snap.players.find((p) => p.world === "minecraft_the_nether")!;
      expect(here && nether, "the busy fixtures have nobody in the overworld or the nether");
      const profile = await ctx.html(`/players/${here.name}`);
      expect(profile.includes(`href="/map/survival?follow=${here.uuid}"`), `the profile of ${here.name} has no Show on map link`);
      for (const [who, why] of [["Dace", "is offline"], ["Finnegan_B", "Live positions are off on Creative"], ["Lanternfish", "Lobby has no map"]] as const) {
        const html = await ctx.html(`/players/${who}`);
        expect(/<button[^>]*disabled[^>]*>(<[^>]+>|[^<])*Show on map/.test(html) && html.includes(why), `${who}: no disabled button with "${why}"`);
        expect(!html.includes("?follow="), `${who}: a follow link although the button is disabled`);
      }
      // the link, with JavaScript: the player's world, the chip, the view on them, and the follow in the share link
      const o = await ctx.open(`/map/survival?follow=${nether.uuid}`);
      try {
        await ready(o.page);
        await o.page.waitForSelector(".mc__follow");
        expect((await o.page.textContent(".mc__follow"))?.includes(`Following ${nether.name}`), "no follow chip");
        expect((await o.page.textContent("h1.visually-hidden"))?.includes("Nether"), "the map did not open the followed player's world");
        await o.page.waitForFunction((u: string) => location.search.includes(`follow=${u}`) && /[?&]x=/.test(location.search), nether.uuid, { timeout: 8000 });
        const dist = await o.page.evaluate(async (u: string) => {
          const v = (window as any).__fmap.view();
          const s = await (await fetch("/map/survival/players.json")).json();
          const p = s.players.find((x: any) => x.uuid === u);
          return p ? Math.hypot(p.x - v.x, p.z - v.z) : -1;
        }, nether.uuid);
        expect(dist >= 0 && dist < 48, `the view is ${Math.round(dist)} blocks from the followed player`);
        await o.page.click(".mc__follow");
        await o.page.waitForFunction(() => !document.querySelector(".mc__follow") && !location.search.includes("follow="), null, { timeout: 8000 });
        quiet(o, "following");
      } finally {
        await o.close();
      }
      // not there: a Notice that says why, no chip
      const dace = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.exec(await ctx.html("/players/Dace"))![0];
      const away = await ctx.html(`/map/survival?follow=${dace}`);
      expect(/fx-notice/.test(away) && away.includes("Dace is offline"), "following an offline player shows no Notice");
      const fin = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.exec(await ctx.html("/players/Finnegan_B"))![0];
      const off = await ctx.html(`/map/creative?follow=${fin}`);
      expect(off.includes("Live positions are off on this server"), "following on a server with positions off does not say so");
      return `${here.name}, ${nether.name}`;
    }
  },
  {
    name: "map: mini-server worlds are grouped under their mini, with its stats link and its own tiles",
    on: BUSY,
    run: async (ctx) => {
      const html = await ctx.html("/map/survival");
      const world = "cakeutils_miniservers_skyblock-1_overworld";
      expect(html.includes(`href="/map/survival?world=${world}"`), "the mini world is not in the Worlds popout");
      expect(/class="mc-pop__title"[^>]*>Skyblock 1</.test(html), "the mini's worlds have no group named after it");
      expect(html.includes('href="/leaderboards?scope=mini%3Asurvival%2Fskyblock-1"'), "no link to the mini's stats");
      expect((await ctx.get("/leaderboards?scope=mini%3Asurvival%2Fskyblock-1")).status === 200, "the mini's stats link does not answer");
      const o = await ctx.open(`/map/survival?world=${world}`);
      try {
        await ready(o.page);
        expect((await o.page.textContent("h1.visually-hidden"))?.includes("Skyblock 1"), "the mini world's map is not named after the mini");
        await o.page.waitForFunction((w: string) => [...document.querySelectorAll<HTMLImageElement>(".mc__map img.leaflet-tile")].some((i) => i.complete && i.naturalWidth > 0 && i.src.includes(w)), world, { timeout: 15_000 });
        quiet(o, "the mini world");
      } finally {
        await o.close();
      }
    }
  },
  {
    name: "map: a finished One Soul round is drawn on its tiles; a running round asks for none",
    on: BUSY,
    run: async (ctx) => {
      const done = await ctx.open("/one-soul/map?round=1");
      try {
        await ready(done.page);
        await sleep(400);
        expect(done.requests.some((r) => r.startsWith("/map/t/onesoul/round/1/")), "the finished round asked for no round tile");
        expect(!done.requests.some((r) => /^\/map\/[^/]+\/(live|players\.json)/.test(r)), "a finished round opened a live feed");
        for (const width of [1440, 390]) {
          await done.page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
          await sleep(150);
          const fit = await done.page.evaluate(() => {
            const a = document.querySelector(".fx-main")!.getBoundingClientRect();
            const s = document.querySelector(".mc-stage")!.getBoundingClientRect();
            const d = document.documentElement;
            return { gap: Math.round(a.bottom - s.bottom), left: Math.round(s.left - a.left), right: Math.round(a.right - s.right), scrolls: d.scrollHeight > d.clientHeight + 1 };
          });
          expect(fit.gap === 0 && fit.left === 0 && fit.right === 0 && !fit.scrolls, `at ${width} px the round map leaves ${fit.gap} px under it, ${fit.left} and ${fit.right} px beside it${fit.scrolls ? ", and the page scrolls" : ""}`);
        }
        await done.page.setViewportSize({ width: 1440, height: 900 });
        const drawn = await done.page.evaluate(() => ({ marks: document.querySelectorAll(".mc-mark").length, trails: document.querySelectorAll("path.mc-path").length }));
        expect(drawn.marks > 0 && drawn.trails > 0, `${drawn.marks} marks and ${drawn.trails} trails on the finished round`);
        // layers: keyboard reaches them, a toggle hides and shows its marks
        await done.page.locator("summary[aria-label^='Layers']").focus();
        await done.page.keyboard.press("Enter");
        await done.page.keyboard.press("Tab");
        const layer = await done.page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.layer ?? "");
        expect(layer, "the keyboard does not reach a layer toggle");
        await done.page.keyboard.press("Space");
        expect((await done.page.getAttribute(`.mc-pop__item[data-layer='${layer}']`, "aria-pressed")) === "false", "a layer toggle does not say it is off");
        await done.page.keyboard.press("Space");
        expect((await done.page.locator(".mc-mark").count()) === drawn.marks, "the layer's marks did not come back");
        quiet(done, "/one-soul/map?round=1");
      } finally {
        await done.close();
      }
      const tile = done.requests.find((r) => r.startsWith("/map/t/onesoul/round/1/"))!;
      const t = await ctx.get(tile);
      if (t.status === 200) expect(/immutable/.test(t.headers.get("cache-control") ?? ""), `a finished round's tile is not immutable (${t.headers.get("cache-control")})`);
      // the running round (2): today's SVG map, and the tile route refuses it
      const running = await ctx.open("/one-soul/map?round=2");
      try {
        expect((await running.page.locator("svg[aria-label^='Map of']").count()) > 0, "the running round has no SVG map");
        expect(!running.requests.some((r) => r.startsWith("/map/t/")), "the running round asked for tiles");
        await running.page.goto(`${ctx.base}/one-soul/rounds/2`, { waitUntil: "networkidle" });
        expect(!running.requests.some((r) => r.startsWith("/map/t/")) && (await running.page.locator(".mc").count()) === 0, "the running round's page draws a tile map");
        quiet(running, "the running round");
      } finally {
        await running.close();
      }
      expect((await ctx.get("/map/t/onesoul/round/2/minecraft_overworld/3/0_0.png")).status === 404, "a running round's tile is served");
      expect((await ctx.get("/map/t/onesoul/round/99/minecraft_overworld/3/0_0.png")).status === 404, "a round that never was has tiles");
      const card = await ctx.open("/one-soul/rounds/1");
      try {
        await ready(card.page);
        expect((await card.page.locator(".rm-card .mc-mark").count()) > 0, "the finished round's page has no map card with marks");
        quiet(card, "/one-soul/rounds/1");
      } finally {
        await card.close();
      }
    }
  },
  {
    name: "map at phone width: popouts are sheets inside the screen, controls are finger-sized",
    on: ANY_MAP,
    run: async (ctx) => {
      const server = ctx.scenario === "busy" ? "survival" : (await mapServers(ctx))[0];
      if (!server) return "no server has a map";
      for (const theme of ["dark"] as const) {
        const o = await ctx.open(`/map/${server}`, { width: 390, theme });
        try {
          await ready(o.page);
          for (const label of ["Worlds", "Players", "Share"]) {
            await o.page.click(`summary[title="${label}"]`);
            const r = await o.page.evaluate(() => {
              const p = document.querySelector(".mc-pop[open] .mc-pop__panel")!.getBoundingClientRect();
              const d = document.documentElement;
              return { l: p.left, r: p.right, t: p.top, b: p.bottom, w: innerWidth, h: innerHeight, sw: d.scrollWidth, cw: d.clientWidth };
            });
            expect(r.l >= -0.5 && r.r <= r.w + 0.5 && r.t >= -0.5 && r.b <= r.h + 0.5, `${theme}: the ${label} sheet is at ${Math.round(r.l)}..${Math.round(r.r)} × ${Math.round(r.t)}..${Math.round(r.b)} on a ${r.w} × ${r.h} screen`);
            expect(r.sw <= r.cw + 1, `${theme}: the page scrolls sideways with ${label} open`);
            await o.page.keyboard.press("Escape");
          }
          const look = await o.page.evaluate(() => {
            const chip = getComputedStyle(document.querySelector(".mc-over summary")!);
            const out = { ground: getComputedStyle(document.body).backgroundColor, chip: chip.backgroundColor, ink: chip.color, small: [] as string[] };
            return out;
          });
          expect(look.chip !== "rgba(0, 0, 0, 0)" && look.chip !== look.ink, `${theme}: the popout chips have no surface (${look.chip} on ${look.ink})`);
          quiet(o, `/map/${server} at 390 px, ${theme}`);
        } finally {
          await o.close();
        }
      }
      // a coarse pointer gets 44 px controls (the design system's rule)
      const touch = await ctx.open(`/map/${server}`, { width: 390, touch: true });
      try {
        await ready(touch.page);
        expect(await touch.page.evaluate(() => matchMedia("(pointer: coarse)").matches), "the phone context has no coarse pointer");
        const sizes: { n: string; h: number; w: number }[] = await touch.page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".mc__controls button, .mc-over summary")].map((b) => ({ n: b.getAttribute("aria-label") ?? b.textContent ?? "", h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width })));
        const small = sizes.filter((s) => s.h < 43.5 || s.w < 43.5);
        expect(sizes.length >= 5 && small.length === 0, `controls under 44px on a phone: ${small.map((s) => `${s.n.trim()} ${Math.round(s.w)}×${Math.round(s.h)}`).join(", ")}`);
        // the map itself still pans by touch and the sheet opens by tap
        await touch.page.tap('summary[title="Players"]');
        expect(await touch.page.evaluate(() => !!document.querySelector(".mc-pop[open] .mc-pop__panel")), "a tap does not open the Players sheet");
        quiet(touch, "the map on a phone");
      } finally {
        await touch.close();
      }
    }
  },
  {
    name: "map streams: 600 connections from one host get 4 streams; the rest are refused and the site stays up",
    on: ALL,
    run: async (ctx) => {
      if (ctx.scenario === "fresh") return "no map on a fresh network";
      if (ctx.scenario === "live" && !ctx.flags.abuse) return "skipped on a site we did not start (--abuse runs it)";
      const server = ctx.scenario === "busy" ? "survival" : (await mapServers(ctx))[0];
      if (!server) return "no server has a map";
      const path = `/map/${server}/live`;
      const one = await flood(ctx.base, 600, path);
      let note = "";
      try {
        expect(one.other === 0, `${one.other} of 600 connections got neither a stream nor a refusal`);
        expect(one.ok === 4 && one.refused === 596, `${one.ok} streams and ${one.refused} refusals for one address (4 and 596 expected)`);
        const refusal = one.knocks.find((k) => k.status === 503)!;
        expect(Number(refusal.retryAfter) > 0, "a refusal has no Retry-After");
        // with all 600 connections still open, the site answers
        const t0 = performance.now();
        for (const p of ["/healthz", "/", `/map/${server}`, `/map/${server}/players.json`]) expect((await ctx.get(p)).status === 200, `${p} did not answer under 600 open connections`);
        const health = (await (await ctx.get("/healthz")).json()) as { map?: { streams: number; maxStreams: number } };
        expect(health.map && (ctx.scenario === "live" ? health.map.streams >= 4 : health.map.streams === 4) && health.map.maxStreams >= 4, `/healthz counts ${JSON.stringify(health.map)} streams during the flood`);
        const ms = Math.round(performance.now() - t0);
        expect(ms < 5000, `the site took ${ms} ms for four answers under 600 open connections`);
        note = `${ms} ms for four pages meanwhile`;
      } finally {
        await one.close();
      }
      // the slots come back when the connections go
      const again = await flood(ctx.base, 5, path);
      try {
        expect(again.ok === 4 && again.refused === 1, `after the flood: ${again.ok} streams, ${again.refused} refused (the 4 slots did not all come back)`);
      } finally {
        await again.close();
      }
      if (!ctx.boot) return note;

      // behind a proxy that names the client (Caddy: X-Forwarded-For), with the cap on all streams at 20:
      const site = await ctx.boot({ ADDRESS_HEADER: "x-forwarded-for", XFF_DEPTH: "1", MAP_SSE_MAX: "20" });
      try {
        // 600 addresses: the total holds
        const many = await flood(site.base, 600, "/map/survival/live", (i) => ({ "X-Forwarded-For": `198.18.${i >> 8}.${i & 255}` }));
        expect(many.ok === 20 && many.refused === 580 && many.other === 0, `600 addresses with MAP_SSE_MAX=20: ${many.ok} streams, ${many.refused} refused`);
        await many.close();
        // 600 addresses of one IPv6 /64 are one client (one host owns the whole prefix)
        const v6 = await flood(site.base, 600, "/map/survival/live", (i) => ({ "X-Forwarded-For": `2001:db8:77:1:${(i + 1).toString(16)}::${(i * 7 + 1).toString(16)}` }));
        expect(v6.ok === 4 && v6.refused === 596, `600 addresses of one IPv6 /64: ${v6.ok} streams (4 expected), ${v6.refused} refused`);
        // another /64 and an IPv4 host still get in meanwhile
        const others = await Promise.all([knock(site.base, "/map/survival/live", { "X-Forwarded-For": "2001:db8:77:2::1" }), knock(site.base, "/map/survival/live", { "X-Forwarded-For": "203.0.113.9" })]);
        expect(others.every((k) => k.status === 200), "a neighbour of the flooding prefix was refused");
        for (const k of others) k.socket.destroy();
        await v6.close();
        // a forged left-most X-Forwarded-For entry does not change who the client is (the right-most is Caddy's)
        const forged = await flood(site.base, 12, "/map/survival/live", (i) => ({ "X-Forwarded-For": `10.9.9.${i}, 203.0.113.50` }));
        expect(forged.ok === 4, `a forged X-Forwarded-For got ${forged.ok} streams for one client`);
        await forged.close();
        expect((await fetch(`${site.base}/healthz`)).status === 200, "the site did not survive the floods");
      } finally {
        await site.stop();
      }
      return `${note}; total cap, IPv6 /64 and forged header hold`;
    }
  },
  {
    name: "map over HTTP with the real hide lists: nothing hidden, no token; cakeutils down shows the last good map",
    on: BUSY,
    run: async (ctx) => {
      if (!ctx.boot) return "needs a site of its own";
      // the fixture server as a real cakeutils over HTTP, and the production build pointed at it (no mock mode):
      // the token travels in a header, the hide lists come from the owner's files
      const port = 3190 + Math.floor(Math.random() * 400);
      const upstream = Bun.spawn(["bun", "scripts/mock-server.ts", "busy", String(port)], { stdout: "ignore", stderr: "ignore" });
      const SECRET = "0123456789abcdefghijSECRET";
      const TOKEN = `cu_e2ewire_${SECRET}`; // logs may name its public id (cu_e2ewire), nothing may name the rest
      let site: Awaited<ReturnType<NonNullable<Ctx["boot"]>>> | null = null;
      try {
        const until = Date.now() + 15_000;
        for (;;) {
          try {
            if ((await fetch(`http://127.0.0.1:${port}/v2/map`, { headers: { authorization: `Bearer ${TOKEN}` } })).ok) break;
          } catch {
            /* not up yet */
          }
          expect(Date.now() < until, "the fixture server did not come up");
          await sleep(150);
        }
        site = await ctx.boot(
          { CAKEUTILS_API_URL: `http://127.0.0.1:${port}`, CAKEUTILS_API_TOKEN: TOKEN },
          { mock: null, files: { "hidden.txt": "# opted out\nquietgill\n", "hidden-servers.txt": "staff\n" } }
        );
        const base = site.base;
        const get = (p: string) => fetch(base + p);
        const secret = (s: string) => s.includes(SECRET) || s.includes("e2ewire") || s.includes(`127.0.0.1:${port}`) || s.includes("CAKEUTILS_API_TOKEN");
        const servers = [...new Set(((await (await get("/map")).text()).match(/href="\/map\/([A-Za-z0-9._-]+)"/g) ?? []).map((m) => m.slice(11, -1)))];
        expect(servers.includes("survival") && servers.includes("creative") && !servers.includes("staff"), `over HTTP /map lists ${servers.join(", ")}`);
        const pages = ["/", "/map", "/map/survival", "/map/creative", "/map/survival/players.json", "/players", "/servers", "/about", "/healthz", `/map/survival?follow=${QUIET}`];
        const tile = ((await (await get("/map/survival")).text()).match(/\/map\/t\/survival\/minecraft_overworld\/3\/0_0\.png(\?v=[A-Za-z0-9._-]+)?/) ?? [])[0];
        expect(tile, "the page names no tile at spawn");
        for (const p of pages) {
          const r = await get(p);
          expect(r.status === 200, `over HTTP ${p} answered ${r.status}`);
          const text = await r.text();
          expect(!secret(text), `${p} carries the token or cakeutils' address`);
          const hit = /quietgill|5a1c0de0-0000-4000-8000-0000|bosun|\bstaff\b/i.exec(text)?.[0];
          expect(!hit, `${p} shows "${hit}" with the hide lists in place`);
        }
        for (const p of ["/map/staff", "/map/staff/live", "/map/staff/players.json", "/map/t/staff/minecraft_overworld/3/0_0.png", "/players/quietgill"]) expect((await get(p)).status === 404, `over HTTP ${p} is not a 404`);
        expect((await get(tile!)).status === 200, "the spawn tile did not load over HTTP");
        const live = await listen(`${base}/map/survival/live?world=minecraft_overworld`, 6000);
        expect(live.status === 200 && frames(live.text).filter((f) => f.event === "players").length >= 2, "no moving players over HTTP");
        expect(!secret(live.text) && !/quietgill|5a1c0de0-0000-4000-8000-0000|bosun|\bstaff\b/i.test(live.text), "the stream carries the token or someone hidden");
        const before = (await (await get("/map/survival/players.json")).json()) as any;
        expect(before.state === "live" && before.players.length >= 2, `players.json before the outage: ${before.state}, ${before.players?.length}`);

        // cakeutils goes away: a stream that is open hears about it, and everything keeps answering with what it had
        const outage = listen(`${base}/map/survival/live?world=minecraft_overworld`, 14_000, (t) => frames(t).some((f) => f.event === "status" && f.data.state !== "live"));
        await sleep(1500);
        upstream.kill();
        await upstream.exited;
        const heard = frames((await outage).text).find((f) => f.event === "status" && f.data.state !== "live");
        expect(heard && typeof heard.data.as_of === "number", "an open stream was not told that the positions are stale");
        const page = await get("/map/survival");
        const html = await page.text();
        expect(page.status === 200, `with cakeutils down /map/survival answered ${page.status}`);
        expect(/could not be reached|as of|Positions/.test(html) && !html.includes("Something went wrong"), "with cakeutils down the map page does not say what it is showing");
        expect(html.includes("mc-still__tile"), "with cakeutils down the map page lost its picture");
        const cached = await get(tile!);
        expect(cached.status === 200 && (await cached.arrayBuffer()).byteLength > 100, `with cakeutils down the cached tile answered ${cached.status}`);
        const after = await get("/map/survival/players.json");
        const snap = (await after.json()) as any;
        expect(after.status === 200 && ["stale", "offline"].includes(snap.state) && snap.players.length === before.players.length && typeof snap.at === "number", `with cakeutils down players.json answered ${after.status} ${snap.state} with ${snap.players?.length} players`);
        for (const p of ["/", "/map", "/healthz", "/players"]) {
          const r = await get(p);
          expect(r.status === 200, `with cakeutils down ${p} answered ${r.status}`);
          expect(!secret(await r.text()), `with cakeutils down ${p} carries the token or cakeutils' address`);
        }
        // the token's secret is in no log line and in no file the site wrote (the tile cache, the recorder)
        expect(!site.logs().includes(SECRET), "the site's log names the token");
        const files = readdirSync(site.dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile());
        for (const f of files) expect(!readFileSync(join(f.parentPath, f.name)).includes(SECRET), `${f.name} in the data directory holds the token`);
        return `stream said "${heard!.data.state}", players.json "${snap.state}" with ${snap.players.length} players as of ${new Date(snap.at).toISOString().slice(11, 19)}Z`;
      } finally {
        upstream.kill();
        if (site) await site.stop();
      }
    }
  }
];
