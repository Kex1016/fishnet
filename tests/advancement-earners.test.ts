// Advancement search (matchAdvancements) and the list of players who have an advancement (cakeutils
// listAdvancementEarners): the mock behaves like the proxy, the client hides opted-out players and detects a
// proxy without the route.
import { describe, expect, test } from "bun:test";
import { matchAdvancements } from "#lib/milestones/advancements.ts";
import { createCore } from "#lib/server/cakeutils/core.ts";
import { createExtras } from "#lib/server/cakeutils/extras.ts";
import { worldOf, type World } from "#lib/server/cakeutils/mock/index.ts";
import { handleMock } from "#lib/server/cakeutils/mock/handler.ts";
import { ServerList } from "#lib/server/hidden-servers-list.ts";
import type { AdvancementEarners } from "#lib/network/types.ts";
import type { AdvancementFeed } from "#lib/api/types.ts";

const busy = () => structuredClone(worldOf("busy"));
const H = { headers: { authorization: "Bearer cu_mock_mock" } };
async function get<T>(w: World, path: string): Promise<{ status: number; body: T }> {
  const r = await handleMock(w, new Request(`http://mock.invalid${path}`, H));
  return { status: r.status, body: (await r.json()) as T };
}
function extrasOf(w: World, optedOut: string[] = []) {
  const fetchImpl = (input: string | URL | Request, init?: RequestInit) => handleMock(w, new Request(input, init));
  const core = createCore({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl, log: () => undefined });
  return createExtras(core, { priority: () => "page", hidden: () => new ServerList(["onesoul"]), exclude: () => ["onesoul"], hiddenPlayer: (p) => optedOut.includes(p.name) });
}

describe("advancement search", () => {
  const rows = [
    { advancement: "minecraft:story/mine_diamond", title: "Diamonds!" },
    { advancement: "minecraft:story/enter_the_nether", title: "We Need to Go Deeper" },
    { advancement: "minecraft:adventure/kill_a_mob", title: "Monster Hunter" },
    { advancement: "minecraft:nether/obtain_crying_obsidian", title: "Who is Cutting Onions?" },
    { advancement: "create:andesite_alloy", title: null }
  ];
  test("title or id, any case, title prefixes first", () => {
    expect(matchAdvancements(rows, "DIAM").map((r) => r.advancement)).toEqual(["minecraft:story/mine_diamond"]);
    expect(matchAdvancements(rows, "mine diamond").map((r) => r.advancement)).toEqual(["minecraft:story/mine_diamond"]);
    expect(matchAdvancements(rows, "nether").map((r) => r.advancement)).toEqual(["minecraft:story/enter_the_nether", "minecraft:nether/obtain_crying_obsidian"]);
    expect(matchAdvancements(rows, "hunter").map((r) => r.advancement)).toEqual(["minecraft:adventure/kill_a_mob"]);
    expect(matchAdvancements(rows, "andesite").map((r) => r.advancement)).toEqual(["create:andesite_alloy"]);
    expect(matchAdvancements(rows, "w").map((r) => r.title)).toEqual(["We Need to Go Deeper", "Who is Cutting Onions?"]);
    expect(matchAdvancements(rows, "  ")).toEqual([]);
    expect(matchAdvancements(rows, "zzz")).toEqual([]);
  });
});

describe("the mock's earners route", () => {
  test("every player once, earliest first, rank 1 = the network's first earner", async () => {
    const w = busy();
    const feed = await get<AdvancementFeed>(w, "/v2/milestones/advancements?limit=100");
    const top = [...feed.body.milestones].sort((a, b) => b.earners - a.earners)[0];
    const r = await get<AdvancementEarners>(w, `/v2/milestones/advancement/earners?id=${top.advancement}&limit=100`);
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(top.earners);
    expect(r.body.earners[0].uuid).toBe(top.uuid!);
    expect(r.body.earners[0].rank).toBe(1);
    expect(new Set(r.body.earners.map((e) => e.uuid)).size).toBe(r.body.earners.length);
    const times = r.body.earners.map((e) => e.earned_at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    const page2 = await get<AdvancementEarners>(w, `/v2/milestones/advancement/earners?id=${top.advancement}&limit=1&offset=1`);
    expect(page2.body.earners.map((e) => e.rank)).toEqual(top.earners > 1 ? [2] : []);
  });
  test("a server scope, an unknown id, a missing id, a mini scope", async () => {
    const w = busy();
    const feed = await get<AdvancementFeed>(w, "/v2/milestones/advancements?limit=1");
    const a = feed.body.milestones[0];
    const s = await get<AdvancementEarners>(w, `/v2/milestones/advancement/earners?id=${a.advancement}&scope=server:${a.server}`);
    expect(s.body.earners.every((e) => e.server === a.server)).toBe(true);
    expect((await get(w, "/v2/milestones/advancement/earners?id=minecraft:nope")).status).toBe(404);
    expect((await get(w, "/v2/milestones/advancement/earners")).status).toBe(400);
    expect((await get(w, `/v2/milestones/advancement/earners?id=${a.advancement}&scope=mini:creative/plots`)).status).toBe(400);
  });
});

describe("the client", () => {
  test("on with the route, off without it (fresh)", async () => {
    expect(await extrasOf(busy()).enabled("earners")).toBe(true);
    const x = extrasOf(structuredClone(worldOf("fresh")));
    const r = await x.advancementEarners("minecraft:story/mine_diamond");
    expect(r.ok ? "ok" : r.kind).toBe("off");
  });
  test("opted-out players leave the list", async () => {
    const w = busy();
    const feed = await get<AdvancementFeed>(w, "/v2/milestones/advancements?limit=100");
    const top = [...feed.body.milestones].sort((a, b) => b.earners - a.earners)[0];
    const all = await extrasOf(w).advancementEarners(top.advancement, { limit: 100 });
    if (!all.ok) throw new Error("expected ok");
    const name = all.data.earners[0].name;
    const hidden = await extrasOf(w, [name]).advancementEarners(top.advancement, { limit: 100 });
    if (!hidden.ok) throw new Error("expected ok");
    expect(hidden.data.earners.some((e) => e.name === name)).toBe(false);
    expect(hidden.data.total).toBe(all.data.total - 1);
  });
});
