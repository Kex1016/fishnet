import { expect, test, describe } from "bun:test";
import { advCategory, advFeedHref, advHref, advTitle, earnersLabel, fullAdvId, isAdvId, mostCompleted } from "#lib/milestones/advancements.ts";
import { firstsByPlayer } from "#lib/milestones/helpers.ts";
import { createClient } from "#lib/server/cakeutils/create.ts";
import { mockFetch, worldOf } from "#lib/server/cakeutils/mock/index.ts";
import { handleMock } from "#lib/server/cakeutils/mock/handler.ts";
import type { AdvancementDetail, AdvancementFeed, PlayerAdvancements } from "#lib/api/types.ts";

describe("advancement helpers", () => {
  test("titles: the API's, else the id's last segment", () => {
    expect(advTitle({ advancement: "minecraft:story/mine_diamond", title: "Diamonds!" })).toBe("Diamonds!");
    expect(advTitle({ advancement: "minecraft:story/mine_diamond", title: null })).toBe("Mine Diamond");
    expect(advTitle({ advancement: "minecraft:story/mine_diamond", title: "  " })).toBe("Mine Diamond");
    expect(advTitle({ advancement: "create:andesite_alloy" })).toBe("Andesite Alloy");
  });

  test("categories: vanilla tabs by path, mods by namespace", () => {
    expect(advCategory("minecraft:story/mine_diamond")).toBe("Story");
    expect(advCategory("minecraft:end/kill_dragon")).toBe("The End");
    expect(advCategory("minecraft:husbandry/root")).toBe("Husbandry");
    expect(advCategory("minecraft:custom_tab/thing")).toBe("Custom Tab");
    expect(advCategory("minecraft:root")).toBeNull();
    expect(advCategory("farmersdelight:main/get_knife")).toBe("Farmersdelight");
  });

  test("ids: shape check, namespace default, hrefs", () => {
    expect(isAdvId("minecraft:story/mine_diamond")).toBe(true);
    expect(isAdvId("story/mine_diamond")).toBe(true);
    expect(isAdvId("")).toBe(false);
    expect(isAdvId("story//x")).toBe(false);
    expect(isAdvId("Story/Mine")).toBe(false);
    expect(isAdvId("<script>")).toBe(false);
    expect(fullAdvId("story/mine_diamond")).toBe("minecraft:story/mine_diamond");
    expect(fullAdvId("create:x/y")).toBe("create:x/y");
    expect(advHref("story/mine_diamond")).toBe("/advancements/minecraft%3Astory/mine_diamond");
    expect(advFeedHref()).toBe("/advancements");
    expect(advFeedHref("network")).toBe("/advancements");
    expect(advFeedHref("server:survival")).toBe("/advancements?scope=server%3Asurvival");
  });

  test("most completed: by earners, ties by title; earners read as 'first of n'", () => {
    const rows = [
      { advancement: "a", title: "Bee", earners: 3 },
      { advancement: "b", title: "Ant", earners: 3 },
      { advancement: "c", title: "Cat", earners: 9 }
    ] as never[];
    expect(mostCompleted(rows).map((r) => r.title)).toEqual(["Cat", "Ant", "Bee"]);
    expect(mostCompleted(rows, 1)).toHaveLength(1);
    expect(earnersLabel(1)).toBe("the only one so far");
    expect(earnersLabel(0)).toBe("the only one so far");
    expect(earnersLabel(12)).toBe("first of 12");
  });
});

const H = { headers: { authorization: "Bearer cu_mock_mock" } };
const busy = worldOf("busy");
const get = async <T>(path: string, world = busy): Promise<[number, T]> => {
  const r = await handleMock(world, new Request(`http://mock.invalid${path}`, H));
  return [r.status, (r.status === 204 || r.status === 304 ? null : await r.json()) as T];
};

describe("the mock's advancement routes behave like cakeutils (D-111)", () => {
  test("the feed: newest first, first = the earliest completion, imported only before live tracking on an imported server", async () => {
    const [st, feed] = await get<AdvancementFeed>("/v2/milestones/advancements?limit=100");
    expect(st).toBe(200);
    expect(feed.scope).toBe("network");
    expect(feed.total).toBeGreaterThan(10);
    expect(feed.milestones.length).toBe(Math.min(100, feed.total));
    for (let i = 1; i < feed.milestones.length; i++) expect(feed.milestones[i - 1].earned_at).toBeGreaterThanOrEqual(feed.milestones[i].earned_at);
    const now = Date.now();
    for (const m of feed.milestones) {
      expect(m.uuid && m.name && m.server && m.title).toBeTruthy();
      expect(m.earners).toBeGreaterThanOrEqual(1);
      expect(m.earned_at).toBeLessThanOrEqual(now);
      const since = now - busy.advancements_since_ago_ms;
      if (m.imported) {
        expect(m.earned_at).toBeLessThan(since + 1000);
        expect(busy.advancements_imported).toContain(m.server);
      } else expect(m.earned_at).toBeGreaterThan(since - 1000);
    }
    // the network first is the earliest of the servers' firsts, and says where
    const one = feed.milestones[0];
    const [, d] = await get<AdvancementDetail>(`/v2/milestones/advancement?id=${encodeURIComponent(one.advancement)}`);
    // the mock clocks each answer at request time, so two answers differ by a few ms
    expect(Math.abs(d.network!.earned_at - one.earned_at)).toBeLessThan(500);
    expect(d.network?.server).toBe(one.server);
    expect(d.servers.length).toBeGreaterThan(0);
    expect(Math.abs(Math.min(...d.servers.map((s) => s.earned_at)) - one.earned_at)).toBeLessThan(500);
    // every server with it appears once; the network's earners are distinct players, never a sum of servers
    expect(new Set(d.servers.map((s) => s.server)).size).toBe(d.servers.length);
    expect(d.network!.earners).toBeLessThanOrEqual(d.servers.reduce((a, s) => a + s.earners, 0));
    expect(d.network!.earners).toBeGreaterThanOrEqual(Math.max(...d.servers.map((s) => s.earners)));
  });

  test("scopes: a server has its own firsts; an unknown server is empty; a mini scope is a 400", async () => {
    const [, survival] = await get<AdvancementFeed>("/v2/milestones/advancements?scope=server:survival&limit=100");
    expect(survival.scope).toBe("server:survival");
    expect(survival.milestones.every((m) => m.server === "survival")).toBe(true);
    const [, creative] = await get<AdvancementFeed>("/v2/milestones/advancements?scope=server:creative&limit=100");
    expect(creative.total).toBeGreaterThan(0);
    expect(creative.milestones.every((m) => !m.imported)).toBe(true); // creative never ran the import
    const [st0, none] = await get<AdvancementFeed>("/v2/milestones/advancements?scope=server:no-such");
    expect(st0).toBe(200);
    expect(none.total).toBe(0);
    const [st1] = await get("/v2/milestones/advancements?scope=mini:survival/skyblock-1");
    expect(st1).toBe(400);
    const [st2] = await get("/v2/players/Kelpie/advancement-milestones?scope=mini:survival/skyblock-1");
    expect(st2).toBe(400);
  });

  test("one advancement: minecraft: may be omitted, unknown → 404, missing id → 400", async () => {
    const [a, d1] = await get<AdvancementDetail>("/v2/milestones/advancement?id=story/mine_diamond");
    const [b, d2] = await get<AdvancementDetail>("/v2/milestones/advancement?id=minecraft:story/mine_diamond");
    expect(a).toBe(200);
    expect(b).toBe(200);
    expect({ ...d1, network: d1.network?.name, servers: d1.servers.length }).toEqual({ ...d2, network: d2.network?.name, servers: d2.servers.length });
    expect(d1.advancement).toBe("minecraft:story/mine_diamond");
    expect(d1.title).toBe("Diamonds!");
    expect((await get("/v2/milestones/advancement?id=minecraft:nope/zz"))[0]).toBe(404);
    expect((await get("/v2/milestones/advancement"))[0]).toBe(400);
    expect((await get("/v2/milestones/advancement?id=%20"))[0]).toBe(400);
  });

  test("a player's firsts carry no uuid/name and match the feed", async () => {
    const [, feed] = await get<AdvancementFeed>("/v2/milestones/advancements?limit=100");
    const top = firstsByPlayer(feed.milestones)[0];
    const [st, mine] = await get<PlayerAdvancements>(`/v2/players/${top.name}/advancement-milestones?limit=100`);
    expect(st).toBe(200);
    expect(mine.uuid).toBe(top.uuid);
    expect(mine.total).toBe(top.count);
    for (const m of mine.milestones) {
      expect("uuid" in m).toBe(false);
      expect("name" in m).toBe(false);
      expect(feed.milestones.find((f) => f.advancement === m.advancement)?.uuid).toBe(top.uuid);
    }
    const [st2, nobody] = await get<PlayerAdvancements>("/v2/players/no_such_player_zz/advancement-milestones");
    expect(st2).toBe(404);
    expect(nobody).toBeTruthy();
  });

  test("fresh: a proxy without D-111 answers 404 on every advancement route", async () => {
    const fresh = worldOf("fresh");
    expect((await get("/v2/milestones/advancements", fresh))[0]).toBe(404);
    expect((await get("/v2/milestones/advancement?id=story/root", fresh))[0]).toBe(404);
  });
});

describe("the client's advancement routes", () => {
  test("busy: on, feed and detail typed; a mini scope is bad_request; an unknown id not_found", async () => {
    const client = createClient({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl: mockFetch("busy") });
    expect(await client.advancementsEnabled()).toBe(true);
    const feed = await client.advancements({ limit: 3 });
    expect(feed.ok && feed.data.milestones.length).toBe(3);
    const mini = await client.advancements({ scope: "mini:survival/skyblock-1" });
    expect(!mini.ok && mini.kind).toBe("bad_request");
    const d = await client.advancement("story/mine_diamond");
    expect(d.ok && d.data.network?.name).toBeTruthy();
    const none = await client.advancement("minecraft:nope/zz");
    expect(!none.ok && none.kind).toBe("not_found");
    const mine = await client.playerAdvancements("Kelpie", { limit: 2 });
    expect(mine.ok && mine.data.uuid).toBeTruthy();
  });

  test("fresh: off, and every advancement call says so without a request", async () => {
    const client = createClient({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl: mockFetch("fresh") });
    expect(await client.advancementsEnabled()).toBe(false);
    expect(await client.milestonesEnabled()).toBe(false);
    for (const r of [await client.advancements(), await client.advancement("story/root"), await client.playerAdvancements("x")]) {
      expect(!r.ok && r.kind).toBe("off");
    }
  });

  test("a D-109 proxy without D-111: milestones on, advancements off", async () => {
    const base = mockFetch("busy");
    const fetchImpl: typeof base = (input, init) => {
      const u = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (u.pathname.startsWith("/v2/milestones/advancement") || u.pathname.endsWith("/advancement-milestones")) {
        return Promise.resolve(new Response(JSON.stringify({ type: "urn:cakeutils:problem:not_found", title: "Not Found", status: 404, detail: "no such route" }), { status: 404, headers: { "content-type": "application/problem+json" } }));
      }
      return base(input, init);
    };
    const client = createClient({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl });
    expect(await client.milestonesEnabled()).toBe(true);
    expect(await client.advancementsEnabled()).toBe(false);
    const r = await client.advancements();
    expect(!r.ok && r.kind).toBe("off");
  });
});
