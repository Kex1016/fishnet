// The planned network routes (firsts, criteria, deaths, activity, board history): feature detection, hidden
// servers leaving every answer, `exclude=` on network reads, and the words the pages use.
import { describe, expect, test } from "bun:test";
import { createCore } from "#lib/server/cakeutils/core.ts";
import { createExtras } from "#lib/server/cakeutils/extras.ts";
import { worldOf, type World } from "#lib/server/cakeutils/mock/index.ts";
import { handleMock } from "#lib/server/cakeutils/mock/handler.ts";
import { ServerList } from "#lib/server/hidden-servers-list.ts";
import { causeOf } from "#lib/network/deaths.ts";
import { firstKind, posText } from "#lib/network/words.ts";
import { group } from "#lib/format/stat-display.ts";
import type { Death } from "#lib/network/types.ts";

const busy = () => structuredClone(worldOf("busy"));

function extrasOf(w: World, hidden: string[] = ["onesoul"], optedOut: string[] = []) {
  const seen: string[] = [];
  const fetchImpl = (input: string | URL | Request, init?: RequestInit) => {
    const req = new Request(input, init);
    seen.push(new URL(req.url).pathname + new URL(req.url).search);
    return handleMock(w, req);
  };
  const core = createCore({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl, log: () => undefined });
  const x = createExtras(core, { priority: () => "page", hidden: () => new ServerList(hidden), exclude: () => hidden, hiddenPlayer: (p) => optedOut.includes(p.name) || optedOut.includes(p.uuid) });
  return { x, seen };
}

describe("feature detection", () => {
  test("a proxy with the routes", async () => {
    const { x } = extrasOf(busy());
    for (const f of ["firsts", "criteria", "deaths", "activity", "playtimeMilestones", "history"] as const) expect(await x.enabled(f)).toBe(true);
  });
  test("an older proxy: every widget is off, never empty", async () => {
    const w = busy();
    w.extras = false;
    const { x } = extrasOf(w);
    expect(await x.enabled("firsts")).toBe(false);
    const d = await x.deaths();
    expect(d.ok ? "ok" : d.kind).toBe("off");
    const h = await x.history({ kind: "playtime" });
    expect(h.ok ? "ok" : h.kind).toBe("off");
  });
  test("the probe is remembered", async () => {
    const { x, seen } = extrasOf(busy());
    await x.enabled("deaths");
    await x.enabled("deaths");
    expect(seen.filter((p) => p.startsWith("/v2/deaths")).length).toBe(1);
  });
});

describe("hidden and One Soul servers", () => {
  test("network reads ask cakeutils without them", async () => {
    const { x, seen } = extrasOf(busy());
    await x.deaths({ limit: 5 });
    await x.activityOnline({ bucket: "day" });
    const reads = seen.filter((p) => !p.includes("limit=1&") && !p.endsWith("limit=1"));
    expect(reads.some((p) => p.startsWith("/v2/deaths") && p.includes("exclude=onesoul"))).toBe(true);
    expect(reads.some((p) => p.startsWith("/v2/activity/online") && p.includes("exclude=onesoul"))).toBe(true);
  });
  test("a server scope sends no exclude", async () => {
    const { x, seen } = extrasOf(busy());
    await x.deaths({ scope: "server:survival", limit: 5 });
    const last = seen.at(-1)!;
    expect(last).toContain("scope=server%3Asurvival");
    expect(last).not.toContain("exclude=");
  });
  test("rows that name a hidden server leave the feed", async () => {
    const all = await extrasOf(busy()).x.deaths({ limit: 100 });
    expect(all.ok && all.data.deaths.some((r) => r.server === "survival")).toBe(true);
    const { x } = extrasOf(busy(), ["onesoul", "survival"]);
    const d = await x.deaths({ limit: 100 });
    expect(d.ok).toBe(true);
    if (d.ok) for (const r of d.data.deaths) expect(r.server).not.toBe("survival");
    const f = await x.firsts({ limit: 100 });
    if (f.ok) for (const r of f.data.firsts) expect(r.server).not.toBe("survival");
  });
  test("a hidden server's scope answers not found", async () => {
    const { x } = extrasOf(busy());
    const r = await x.deaths({ scope: "server:onesoul" });
    expect(r.ok ? "ok" : r.kind).toBe("not_found");
  });
});

describe("opted-out players", () => {
  test("their rows leave firsts, criteria, deaths and playtime milestones; a death also when they were the killer", async () => {
    const all = extrasOf(busy()).x;
    const deaths = await all.deaths({ limit: 100 });
    const firsts = await all.firsts({ limit: 100 });
    const criteria = await all.criteria({ limit: 100 });
    const playtime = await all.playtimeMilestones({ limit: 100 });
    if (!deaths.ok || !firsts.ok || !criteria.ok || !playtime.ok) throw new Error("the busy world has every feed");
    const pvp = deaths.data.deaths.find((d) => d.killer_player);
    if (!pvp?.killer_player) throw new Error("the busy world has a death by a player");
    const gone = [pvp.killer_player.name, firsts.data.firsts.find((f) => f.name)!.name!, criteria.data.criteria[0].name, playtime.data.milestones[0].uuid];
    const named = (p: { uuid?: string | null; name?: string | null } | null | undefined) => !!p && (gone.includes(p.name ?? "") || gone.includes(p.uuid ?? ""));

    const { x } = extrasOf(busy(), ["onesoul"], gone);
    const d = await x.deaths({ limit: 100 });
    const f = await x.firsts({ limit: 100 });
    const c = await x.criteria({ limit: 100 });
    const m = await x.playtimeMilestones({ limit: 100 });
    if (!d.ok || !f.ok || !c.ok || !m.ok) throw new Error("still answered");
    expect(d.data.deaths.some((r) => named(r) || named(r.killer_player))).toBe(false);
    expect(f.data.firsts.some(named)).toBe(false);
    expect(c.data.criteria.some(named)).toBe(false);
    expect(m.data.milestones.some(named)).toBe(false);
    // the count drops by the rows that left this page
    const left = deaths.data.deaths.filter((r) => named(r) || named(r.killer_player)).length;
    expect(left).toBeGreaterThan(0);
    expect(d.data.total).toBe(deaths.data.total - left);
    expect(d.data.deaths.length).toBe(deaths.data.deaths.length - left);
  });

  test("nobody opted out: the answer is passed through untouched", async () => {
    const { x } = extrasOf(busy(), []);
    const d = await x.deaths({ limit: 5 });
    expect(d.ok && d.data.deaths.length).toBe(5);
  });
});

describe("board history", () => {
  test("playtime has days, a single stat that is not tracked says so", async () => {
    const { x } = extrasOf(busy());
    const p = await x.history({ kind: "playtime" }, { limit: 3 });
    expect(p.ok && p.data.days.length > 0).toBe(true);
    const s = await x.history({ kind: "stat", type: "minecraft:mined", subject: "minecraft:stone" });
    expect(s.ok && s.data.tracked).toBe(false);
  });
});

describe("words", () => {
  test("first kinds, unknown ones generic", () => {
    expect(firstKind("biome")).toBe("Biome");
    expect(firstKind("new_kind")).toBeTruthy();
  });
  test("positions read as whole blocks", () => {
    expect(posText({ x: 1.6, y: 64, z: -40.2 })).toBe("x 2, y 64, z -40");
  });
  test("death groups", () => {
    const base = { uuid: "u", name: "n", server: "survival", at: 0, cause: "n fell from a high place" } as unknown as Death;
    expect(causeOf({ ...base, killer_player: { uuid: "k", name: "k" } } as Death)).toBe("Killed by a player");
    expect(typeof causeOf(base)).toBe("string");
    expect(causeOf({ ...base, cause: "something new happened" } as Death)).toBe("Other");
  });
});

describe("real cakeutils answers (claude/onesoul captures)", () => {
  test("a first reads from its detail, never as a bare id", async () => {
    const { firstLine } = await import("#lib/network/words.ts");
    const base = { uuid: "u", name: "Bea", at: 1, server: "onesoul", backfilled: false, imported: false };
    // rows as captured from /v2/firsts?scope=round:onesoul/1
    const crit = firstLine({ ...base, kind: "criterion", title: "minecraft:adventure/adventuring_time", detail: { advancement: "minecraft:adventure/adventuring_time", criterion: "minecraft:plains" } });
    expect(crit).toEqual({ text: "Adventuring Time: Plains", href: "/advancements/minecraft%3Aadventure/adventuring_time" });
    const stat = firstLine({ ...base, kind: "stat", title: "Number of Deaths", detail: { metric: "custom:minecraft:deaths", type: "minecraft:custom", subject: "minecraft:deaths", threshold: 1, unit: "count", display: "1" } });
    expect(stat.text.endsWith(": 1")).toBe(true);
    expect(stat.href).toStartWith("/leaderboards/");
    expect(firstLine({ ...base, kind: "biome", title: "minecraft:cherry_grove", detail: { biome: "minecraft:cherry_grove" } }).text).toBe("First into Cherry grove");
    expect(firstLine({ ...base, kind: "item", title: "", detail: { item: "minecraft:elytra", via: "crafted" } }).text).toBe("First to craft Elytra");
    expect(firstLine({ ...base, kind: "something_new", title: "Did a new thing", detail: null }).text).toBe("Did a new thing");
  });
  test("titles as cakeutils writes them: a name or a key, a duration for playtime, no holder when none is known", async () => {
    const { firstLine } = await import("#lib/network/words.ts");
    const base = { uuid: null, name: null, at: null, server: null, backfilled: true, imported: false };
    // playtime: the title is the duration alone
    expect(firstLine({ ...base, kind: "playtime", title: "100h 0m", detail: { threshold_ms: 360_000_000, display: "100h 0m" } })).toEqual({ text: "First to 100h 0m played", href: "/leaderboards/playtime" });
    // a place the catalogue has no name for: the title is its key
    expect(firstLine({ ...base, kind: "dimension", title: "minecraft:the_nether", detail: { dimension: "minecraft:the_nether" } }).text).toBe("First into The nether");
    expect(firstLine({ ...base, kind: "structure", title: "Ancient City", detail: { structure: "minecraft:ancient_city" } }).text).toBe("First into Ancient City");
    expect(firstLine({ ...base, kind: "item", title: "Elytra", detail: { item: "minecraft:elytra", via: "picked_up" } }).text).toBe("First to pick up Elytra");
    // a count reads grouped like every other number on the site; other units keep the API's text
    expect(firstLine({ ...base, kind: "stat", title: "Stone", detail: { type: "minecraft:mined", subject: "minecraft:stone", threshold: 100000, unit: "count", display: "100000" } }).text).toBe(`Stone mined: ${group(100000)}`);
    expect(firstLine({ ...base, kind: "stat", title: "Walk One cm", detail: { type: "minecraft:custom", subject: "minecraft:walk_one_cm", threshold: 100000, unit: "distance_cm", display: "1 km" } }).text).toEndWith(": 1 km");
  });
  test("a 64-bit world seed survives parsing exactly", async () => {
    const { parseJson } = await import("#lib/server/cakeutils/core.ts");
    const d = parseJson('{"seed": -4172144997902289642, "archive": "world", "small": 12, "ms": 1794463781803}') as Record<string, unknown>;
    expect(d.seed).toBe("-4172144997902289642");
    expect(d.small).toBe(12);
    expect(d.ms).toBe(1794463781803);
  });
});
