// W1: the client's cache, revalidation, single-flight, stale-on-error, rate bucket and milestone
// feature detection, against a scripted fetch and a fake clock (no network, no timers to wait on).
import { describe, expect, test } from "bun:test";
import { createClient, type ClientOptions } from "#lib/server/cakeutils/create.ts";
import { createCore } from "#lib/server/cakeutils/core.ts";
import { mockFetch } from "#lib/server/cakeutils/mock/index.ts";
import { problemCode } from "#lib/api/result.ts";

const TOKEN = "cu_fishnet_S3CRETs3cret";
const T0 = Date.UTC(2026, 10, 4, 18, 0, 0);

type Call = { path: string; method: string; headers: Record<string, string>; body?: string };
type Handler = (c: Call, n: number) => Response | Promise<Response>;

function rig(routes: Record<string, Handler>, extra: Partial<ClientOptions> = {}) {
  let t = T0;
  const calls: Call[] = [];
  const logs: string[] = [];
  const counts = new Map<string, number>();
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(input));
    const path = u.pathname + u.search;
    const c: Call = { path, method: init?.method ?? "GET", headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body as string | undefined };
    calls.push(c);
    const h = routes[path] ?? routes[u.pathname];
    if (!h) return json(404, { type: "urn:cakeutils:problem:not_found", title: "Not Found", status: 404, detail: "no such route" });
    const n = (counts.get(path) ?? 0) + 1;
    counts.set(path, n);
    return h(c, n);
  };
  const opts: ClientOptions = {
    baseUrl: "http://cakeutils.test:8085",
    token: TOKEN,
    fetchImpl,
    log: (l) => logs.push(l),
    now: () => t,
    sleep: async (ms) => {
      t += ms;
    },
    ...extra
  };
  const core = createCore(opts);
  const client = createClient({ ...opts, core });
  return { client, core, calls, logs, advance: (ms: number) => (t += ms), now: () => t, opts };
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  const ct = status >= 400 ? "application/problem+json" : "application/json";
  const cc = status >= 400 ? "no-store" : "private, max-age=5";
  return new Response(JSON.stringify(body), { status, headers: { "content-type": ct, "cache-control": cc, ...headers } });
}

const network = (online: number) => ({ servers: [{ id: "survival", display_name: "Survival", online, waiting: 0, mc_version: "1.21.4", platform: "paper" }], total_online: online });
const etagged = (body: unknown, etag: string) => (c: Call) =>
  c.headers["if-none-match"] === etag ? new Response(null, { status: 304, headers: { etag, "cache-control": "private, max-age=5" } }) : json(200, body, { etag });
const down = () => {
  throw new TypeError("fetch failed: connect ECONNREFUSED http://cakeutils.test:8085/v2/network?token=cu_fishnet_S3CRETs3cret");
};

describe("cache", () => {
  test("a fresh answer is served from memory", async () => {
    const r = rig({ "/v2/network": () => json(200, network(3)) });
    const a = await r.client.network();
    r.advance(4_000);
    const b = await r.client.network();
    expect(a.ok && b.ok).toBe(true);
    expect(r.calls.length).toBe(1);
    if (b.ok) expect(b.asOf).toBe(T0);
  });

  test("TTL floors per route class: boards 15 s, catalogue 10 min, icons forever", async () => {
    const board = { metric: "playtime", scope: "network", unit: "ms", total: 1, entries: [{ rank: 1, uuid: "u", name: "a", value: 1, unit: "ms", display: "0m" }] };
    const sha = "a".repeat(64);
    const r = rig({
      "/v2/leaderboards/playtime": () => json(200, board),
      "/v2/stats/types": () => json(200, { types: [] }),
      [`/v2/icons/${sha}.png`]: () => new Response(new Uint8Array([137, 80]), { headers: { "content-type": "image/png", "cache-control": "private, max-age=31536000, immutable", etag: `"${sha}"` } })
    });
    await r.client.leaderboard({ kind: "playtime" });
    await r.client.statTypes();
    await r.client.icon(sha);
    r.advance(14_000);
    await r.client.leaderboard({ kind: "playtime" });
    r.advance(9 * 60_000);
    await r.client.statTypes();
    r.advance(30 * 86_400_000);
    const icon = await r.client.icon(sha);
    expect(r.calls.length).toBe(3);
    expect(icon.ok && Array.from(icon.data.png)).toEqual([137, 80]);
  });

  test("past its TTL an answer is served at once while one refresh runs behind it", async () => {
    const r = rig({ "/v2/network": (_c, n) => json(200, network(n)) });
    await r.client.network();
    r.advance(7_000); // TTL 5 s, refresh window 10 s
    const [a, b] = await Promise.all([r.client.network(), r.client.network()]);
    expect(a.ok && a.data.total_online).toBe(1);
    expect(b.ok && b.data.total_online).toBe(1);
    await Bun.sleep(0);
    expect(r.calls.length).toBe(2);
    const c = await r.client.network();
    expect(c.ok && c.data.total_online).toBe(2);
    expect(c.ok && c.stale).toBe(false);
  });

  test("ETag revalidation: 304 keeps the data and moves asOf", async () => {
    const r = rig({ "/v2/network": etagged(network(5), 'W/"abc"') });
    await r.client.network();
    r.advance(60_000);
    const b = await r.client.network();
    expect(r.calls.length).toBe(2);
    expect(r.calls[1].headers["if-none-match"]).toBe('W/"abc"');
    expect(b.ok && b.data.total_online).toBe(5);
    expect(b.ok && b.asOf).toBe(T0 + 60_000);
  });

  test("concurrent misses share one request", async () => {
    const r = rig({ "/v2/players?q=a": () => json(200, { total: 0, players: [] }) });
    const rs = await Promise.all(Array.from({ length: 20 }, () => r.client.players({ q: "a" })));
    expect(r.calls.length).toBe(1);
    expect(rs.every((x) => x.ok && x.empty)).toBe(true);
  });

  test("batch is keyed by its body", async () => {
    const r = rig({ "/v2/players:batch": (c) => json(200, { players: JSON.parse(c.body!).refs.map((ref: string) => ({ ref })) }) });
    await r.client.batch(["a"], ["playtime"]);
    await r.client.batch(["a"], ["playtime"]);
    await r.client.batch(["b"], ["playtime"]);
    expect(r.calls.length).toBe(2);
    expect(r.calls[0].method).toBe("POST");
    expect(r.calls[0].headers["content-type"]).toBe("application/json");
  });

  test("404 and 400 are answers, remembered briefly", async () => {
    const r = rig({
      "/v2/leaderboards/stats/mined/minecraft:stone": () => json(404, { type: "urn:cakeutils:problem:not_found", title: "Not Found", status: 404, detail: "x" }),
      "/v2/leaderboards/stats/custom/*": () => json(400, { type: "urn:cakeutils:problem:mixed_units", title: "Bad Request", status: 400, detail: "x" })
    });
    const a = await r.client.leaderboard({ kind: "stat", type: "minecraft:mined", subject: "minecraft:stone" });
    const b = await r.client.leaderboard({ kind: "stat", type: "minecraft:mined", subject: "minecraft:stone" });
    expect(!a.ok && a.kind).toBe("not_found");
    expect(!b.ok && b.kind).toBe("not_found");
    const c = await r.client.leaderboard({ kind: "stat", type: "minecraft:custom", subject: "*" });
    expect(!c.ok && c.kind).toBe("bad_request");
    if (!c.ok) expect(problemCode(c)).toBe("mixed_units");
    expect(r.calls.length).toBe(2);
    r.advance(16_000);
    await r.client.leaderboard({ kind: "stat", type: "minecraft:mined", subject: "minecraft:stone" });
    expect(r.calls.length).toBe(3);
  });

  test("an unreadable body is 'down', never a throw", async () => {
    const r = rig({ "/v2/network": () => new Response("<html>gateway</html>", { status: 200, headers: { "content-type": "text/html" } }) });
    const a = await r.client.network();
    expect(!a.ok && a.kind).toBe("down");
  });
});

describe("cakeutils down", () => {
  test("the last good answer is served as stale, with its own asOf, up to 24 h", async () => {
    let up = true;
    const r = rig({ "/v2/network": () => (up ? json(200, network(4)) : down()) });
    await r.client.network();
    up = false;
    r.advance(60_000);
    const a = await r.client.network();
    expect(a.ok && a.stale).toBe(true);
    expect(a.ok && a.asOf).toBe(T0);
    expect(a.ok && a.data.total_online).toBe(4);
    // within the cool-down no request goes out
    const n = r.calls.length;
    r.advance(1_000);
    await r.client.network();
    expect(r.calls.length).toBe(n);
    // past 24 h: a failure that says when the last good answer was
    r.advance(24 * 3_600_000);
    const b = await r.client.network();
    expect(!b.ok && b.kind).toBe("down");
    expect(!b.ok && b.asOf).toBe(T0);
  });

  test("a new key while down fails fast with 'down', and recovery clears stale", async () => {
    let up = false;
    const r = rig({ "/v2/network": () => (up ? json(200, network(2)) : down()), "/v2/mini-servers": () => json(200, { mini_servers: [] }) });
    const a = await r.client.network();
    expect(!a.ok && a.kind).toBe("down");
    const before = r.calls.length;
    const b = await r.client.miniServers(); // circuit open: no request
    expect(!b.ok && b.kind).toBe("down");
    expect(r.calls.length).toBe(before);
    up = true;
    r.advance(6_000);
    const c = await r.client.network();
    expect(c.ok && !c.stale).toBe(true);
    expect(r.core.status().reachable).toBe(true);
  });

  test("health is never served stale", async () => {
    let up = true;
    const r = rig({ "/v2/health": () => (up ? json(200, { status: "ok", version: "2" }) : down()) });
    expect((await r.client.health()).ok).toBe(true);
    up = false;
    r.advance(30_000);
    const h = await r.client.health();
    expect(!h.ok && h.kind).toBe("down");
  });

  test("5xx counts as down and opens the cool-down", async () => {
    const r = rig({ "/v2/network": () => json(503, { type: "urn:cakeutils:problem:internal", title: "x", status: 503, detail: "x" }) });
    const a = await r.client.network();
    expect(!a.ok && a.kind).toBe("down");
    expect(!a.ok && a.status).toBe(503);
    expect(r.core.status().reachable).toBe(false);
  });

  test("a hanging cakeutils times out into 'down'", async () => {
    const hanging = rig({}, {
      timeoutMs: { page: 30 },
      fetchImpl: (_i, init) =>
        new Promise((_res, rej) => init?.signal?.addEventListener("abort", () => rej(init.signal!.reason)))
    });
    const a = await hanging.client.network();
    expect(!a.ok && a.kind).toBe("down");
    expect(hanging.logs.join("\n")).toContain("no answer within 0.03 s");
  });

  test("logs show the token's id and scheme://host:port only, once per outage", async () => {
    let up = false;
    const r = rig({ "/v2/network": () => (up ? json(200, network(1)) : down()) });
    for (let i = 0; i < 5; i++) {
      await r.client.network();
      r.advance(6_000);
    }
    up = true;
    await r.client.network();
    const all = r.logs.join("\n");
    expect(r.logs.length).toBe(2);
    expect(all).toContain("cu_fishnet");
    expect(all).toContain("http://cakeutils.test:8085");
    expect(all).not.toContain("S3CRET");
    expect(all).not.toContain("/v2");
    expect(all).toContain("reachable again");
    expect(JSON.stringify(r.core.status())).not.toContain("S3CRET");
  });

  test("401/403 log a hint about the token, not the token", async () => {
    const r = rig({ "/v2/network": () => json(401, { type: "urn:cakeutils:problem:unauthorized", title: "Unauthorized", status: 401, detail: "x" }) });
    const a = await r.client.network();
    expect(!a.ok && a.kind).toBe("down");
    expect(r.logs[0]).toContain("cu_fishnet");
    expect(r.logs[0]).not.toContain("S3CRET");
  });
});

describe("rate limits", () => {
  test("429 honours Retry-After: no requests until it passes, stale served meanwhile", async () => {
    let limited = false;
    const r = rig({
      "/v2/network": () => (limited ? json(429, { type: "urn:cakeutils:problem:rate_limited", title: "x", status: 429, detail: "x" }, { "retry-after": "7" }) : json(200, network(9))),
      "/v2/mini-servers": () => json(200, { mini_servers: [] })
    });
    await r.client.network();
    limited = true;
    r.advance(30_000);
    const a = await r.client.network();
    expect(a.ok && a.stale).toBe(true);
    const n = r.calls.length;
    const b = await r.client.miniServers(); // nothing cached: rate_limited without asking
    expect(!b.ok && b.kind).toBe("rate_limited");
    expect(!b.ok && b.retryAfter).toBe(7);
    expect(r.calls.length).toBe(n);
    r.advance(7_000);
    limited = false;
    const c = await r.client.miniServers();
    expect(c.ok).toBe(true);
  });

  test("the site's own bucket: pages wait briefly, then answer rate_limited", async () => {
    const paths: Record<string, Handler> = {};
    for (let i = 0; i < 10; i++) paths[`/v2/players/p${i}`] = () => json(200, { uuid: `p${i}` });
    const r = rig(paths, { ratePerMinute: 60, burst: 3, waitMs: { page: 500 } });
    const rs = [];
    for (let i = 0; i < 5; i++) rs.push(await r.client.player(`p${i}`));
    // 3 from the burst; then 1 token per second, longer than the 0.5 s a page may wait
    expect(rs.filter((x) => x.ok).length).toBe(3);
    expect(rs.slice(3).every((x) => !x.ok && x.kind === "rate_limited")).toBe(true);
  });

  test("background requests leave the reserve to pages", async () => {
    const paths: Record<string, Handler> = {};
    for (let i = 0; i < 10; i++) paths[`/v2/players/p${i}`] = () => json(200, { uuid: `p${i}` });
    const r = rig(paths, { ratePerMinute: 60, burst: 4, waitMs: { background: 0, page: 0 } });
    const bg = createClient({ ...r.opts, core: r.core, priority: "background" });
    const got = [];
    for (let i = 0; i < 4; i++) got.push((await bg.player(`p${i}`)).ok);
    expect(got).toEqual([true, true, false, false]); // half the bucket is kept for pages
    expect((await r.client.player("p5")).ok).toBe(true);
    expect((await r.client.player("p6")).ok).toBe(true);
  });

  test("a priority function is asked on every call (the recorder's context)", async () => {
    let inRecorder = false;
    const paths: Record<string, Handler> = {};
    for (let i = 0; i < 10; i++) paths[`/v2/players/p${i}`] = () => json(200, { uuid: `p${i}` });
    const r = rig(paths, { ratePerMinute: 60, burst: 2, waitMs: { background: 0, page: 0 } });
    const c = createClient({ ...r.opts, core: r.core, priority: () => (inRecorder ? "background" : "page") });
    inRecorder = true;
    expect((await c.player("p0")).ok).toBe(true);
    expect((await c.player("p1")).ok).toBe(false); // burst 2, reserve 1: background may not take the last
    inRecorder = false;
    expect((await c.player("p2")).ok).toBe(true);
  });
});

describe("milestones feature detection", () => {
  test("404 on /v2/milestones turns every milestone call off, and it turns on by itself", async () => {
    let on = false;
    const feed = { scope: "network", total: 0, milestones: [] };
    const r = rig({
      "/v2/milestones": () => (on ? json(200, feed) : json(404, { type: "urn:cakeutils:problem:not_found", title: "Not Found", status: 404, detail: "no such route" }))
    });
    expect(await r.client.milestonesEnabled()).toBe(false);
    const a = await r.client.milestones();
    expect(!a.ok && a.kind).toBe("off");
    const l = await r.client.milestoneLadder("minecraft:mined", "minecraft:stone");
    expect(!l.ok && l.kind).toBe("off");
    on = true;
    r.advance(5 * 60_000);
    expect(await r.client.milestonesEnabled()).toBe(false); // checked every 10 min
    r.advance(6 * 60_000);
    expect(await r.client.milestonesEnabled()).toBe(true);
    const b = await r.client.milestones();
    expect(b.ok && b.empty).toBe(true);
  });

  test("down: last known value; never seen: off", async () => {
    let up = true;
    const r = rig({ "/v2/milestones": () => (up ? json(200, { scope: "network", total: 1, milestones: [{}] }) : down()) });
    expect(await r.client.milestonesEnabled()).toBe(true);
    up = false;
    r.advance(11 * 60_000);
    expect(await r.client.milestonesEnabled()).toBe(true);
    const fresh = rig({ "/v2/milestones": down });
    expect(await fresh.client.milestonesEnabled()).toBe(false);
  });
});

describe("against the mock", () => {
  test("busy: data, 304 through the fixture server, not_found for an unknown player", async () => {
    let t = T0;
    const client = createClient({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl: mockFetch("busy"), now: () => t });
    const n = await client.network();
    expect(n.ok && n.data.servers.length).toBeGreaterThan(0);
    t += 60_000;
    const again = await client.network();
    expect(again.ok && again.asOf).toBe(t);
    const p = await client.player("nobody_by_this_name");
    expect(!p.ok && p.kind).toBe("not_found");
    expect(await client.milestonesEnabled()).toBe(true);
  });

  test("fresh: empty boards, milestones off", async () => {
    const client = createClient({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl: mockFetch("fresh") });
    const b = await client.leaderboard({ kind: "playtime" });
    expect(b.ok && b.empty).toBe(true);
    expect(await client.milestonesEnabled()).toBe(false);
    const m = await client.milestones();
    expect(!m.ok && m.kind).toBe("off");
  });
});
