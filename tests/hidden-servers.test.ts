// Hidden servers: the list file, the client wrapper (src/lib/server/cakeutils/hide.ts) and the mock's
// `exclude=` (cakeutils D-113), against the busy fixtures (servers lobby, survival, creative, events).
import { describe, expect, test } from "bun:test";
import { createClient } from "#lib/server/cakeutils/create.ts";
import { hideServers } from "#lib/server/cakeutils/hide.ts";
import { mockFetch } from "#lib/server/cakeutils/mock/index.ts";
import { parseServerList, ServerList } from "#lib/server/hidden-servers-list.ts";
import { ok } from "#lib/api/result.ts";
import type { Client } from "#lib/server/cakeutils/client.ts";
import type { Leaderboard, Playtime } from "#lib/api/types.ts";

const base = () => createClient({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl: mockFetch("busy") });
const hiding = (ids: string[]) => {
  const list = new ServerList(ids);
  return hideServers(createClient({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl: mockFetch("busy"), exclude: () => list.ids }), () => list);
};

describe("the hide list", () => {
  test("one id per line, comments and blanks ignored, bad lines reported", () => {
    const { list, bad } = parseServerList("# hidden\ncreative\n\n  events  # for staff\nnot an id\n");
    expect(list.ids).toEqual(["creative", "events"]);
    expect(bad).toEqual(["not an id"]);
  });
  test("scopes on a hidden server", () => {
    const l = new ServerList(["survival"]);
    expect(l.hidesScope("server:survival")).toBe(true);
    expect(l.hidesScope("mini:survival/vault")).toBe(true);
    expect(l.hidesScope("server:lobby")).toBe(false);
    expect(l.hidesScope("network")).toBe(false);
    expect(l.hidesMiniKey("survival/vault")).toBe(true);
  });
});

describe("hideServers", () => {
  test("the network list and online count leave hidden servers out", async () => {
    const all = await base().network();
    const hidden = await hiding(["creative"]).network();
    if (!all.ok || !hidden.ok) throw new Error("network failed");
    const creative = all.data.servers.find((s) => s.id === "creative")!;
    expect(hidden.data.servers.map((s) => s.id)).not.toContain("creative");
    expect(hidden.data.total_online).toBe(all.data.total_online - creative.online);
  });

  test("a hidden server's scope answers like an unknown one", async () => {
    const c = hiding(["survival"]);
    for (const r of [
      await c.leaderboard({ kind: "playtime" }, "server:survival"),
      await c.leaderboard({ kind: "playtime" }, "mini:survival/vault"),
      await c.milestones({ scope: "server:survival" }),
      await c.advancements({ scope: "server:survival" })
    ])
      expect(r.ok ? "ok" : r.kind).toBe("not_found");
    const minis = await c.miniServers();
    expect(minis.ok && minis.data.mini_servers.some((m) => m.server === "survival")).toBe(false);
  });

  test("network boards come from cakeutils without the hidden servers, never a sum of the rest", async () => {
    const all = await base().leaderboard({ kind: "playtime" }, "network", { limit: 100 });
    const survival = await base().leaderboard({ kind: "playtime" }, "server:survival", { limit: 100 });
    const hidden = await hiding(["survival"]).leaderboard({ kind: "playtime" }, "network", { limit: 100 });
    if (!all.ok || !survival.ok || !hidden.ok) throw new Error("board failed");
    expect(hidden.data.excluded).toEqual([]); // applied, and the id stripped before any page sees it
    const before = new Map(all.data.entries.map((e) => [e.uuid, e.value]));
    const there = new Map(survival.data.entries.map((e) => [e.uuid, e.value]));
    for (const e of hidden.data.entries) expect(e.value).toBe(before.get(e.uuid)! - (there.get(e.uuid) ?? 0));
  });

  test("players on a hidden server read as offline, and their playtime leaves it out", async () => {
    const c = hiding(["survival"]);
    const online = await c.players({ online: true, limit: 100 });
    expect(online.ok && online.data.players.some((p) => p.server === "survival")).toBe(false);
    const all = await base().players({ online: true, limit: 100 });
    const someone = all.ok ? all.data.players.find((p) => p.server === "survival") : undefined;
    if (someone) {
      const p = await c.player(someone.uuid);
      expect(p.ok && p.data.online).toBe(false);
      expect(p.ok && p.data.server).toBe(null);
      expect(p.ok && "survival" in p.data.playtime.by_server).toBe(false);
    }
  });

  test("an older cakeutils without `excluded`: playtime fixed here, stats flagged for the notice", async () => {
    const list = new ServerList(["creative"]);
    const old: Playtime = { scope: "network", total_ms: 1000, by_server: { creative: 300, lobby: 600 }, by_mini: { "creative/x": 10 } } as Playtime;
    const board = { metric: "playtime", scope: "network", unit: "ms", total: 0, entries: [] } as unknown as Leaderboard;
    const inner = { ...base(), playtime: async () => ok(old), leaderboard: async () => ok(board) } as Client;
    const c = hideServers(inner, () => list);
    expect(c.exclusionStatus().unsupported).toBe(false);
    const pt = await c.playtime("x");
    expect(pt.ok && pt.data.total_ms).toBe(700);
    expect(pt.ok && pt.data.by_mini).toEqual({});
    await c.leaderboard({ kind: "playtime" });
    expect(c.exclusionStatus()).toEqual({ hidden: 1, unsupported: true });
  });

  test("advancement firsts and the detail page leave the hidden server out", async () => {
    const c = hiding(["survival"]);
    const feed = await c.advancements({ limit: 100 });
    expect(feed.ok && feed.data.milestones.some((m) => m.server === "survival")).toBe(false);
    const one = feed.ok ? feed.data.milestones[0] : undefined;
    if (one) {
      const d = await c.advancement(one.advancement);
      expect(d.ok && d.data.servers.some((s) => s.server === "survival")).toBe(false);
    }
  });

  test("nothing hidden: answers pass through unchanged", async () => {
    const c = hiding([]);
    const a = await base().network();
    const b = await c.network();
    expect(b.ok && a.ok && b.data.servers.length).toBe(a.ok ? a.data.servers.length : -1);
  });
});
