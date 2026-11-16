import { describe, expect, test } from "bun:test";
import { featuredLeaderboard, readerFor } from "#lib/server/featured.ts";
import { findFeatured, type FeaturedBoard } from "#lib/boards.ts";
import { metricKey, type Metric } from "#lib/api/metric.ts";
import { fail, ok, type Result } from "#lib/api/result.ts";
import type { Leaderboard } from "#lib/api/types.ts";

const diamonds = findFeatured("diamonds")!;
const ORE = "mined:minecraft:diamond_ore";
const DEEP = "mined:minecraft:deepslate_diamond_ore";
const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

type Rows = [number, string, number][];
function client(boards: Record<string, Rows | "down" | "missing">) {
  const calls: { key: string; scope: string; offset: number }[] = [];
  const c = {
    leaderboard: async (m: Metric, scope = "network", page: { limit?: number; offset?: number } = {}): Promise<Result<Leaderboard>> => {
      const key = metricKey(m);
      const offset = page.offset ?? 0;
      calls.push({ key, scope, offset });
      const b = boards[key] ?? "missing";
      if (b === "missing") return fail("not_found");
      if (b === "down") return fail("down");
      const entries = b.map(([n, name, value], i) => ({ rank: i + 1, uuid: uuid(n), name, value, unit: "count", display: String(value) }));
      return ok({ metric: key, scope, unit: "count", total: entries.length, entries: entries.slice(offset, offset + (page.limit ?? 50)) }, 1000);
    }
  };
  return { c: c as never, calls };
}

describe("featured boards with also", () => {
  test("adds diamond ore and deepslate diamond ore per player, inside the one scope", async () => {
    const { c, calls } = client({
      [ORE]: [[1, "A", 5], [2, "B", 3]],
      [DEEP]: [[2, "B", 10], [3, "C", 4]]
    });
    const r = await featuredLeaderboard(c, diamonds, "server:survival", { limit: 10 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.entries.map((e) => [e.rank, e.name, e.value])).toEqual([[1, "B", 13], [2, "A", 5], [3, "C", 4]]);
    expect(r.data.total).toBe(3);
    expect(r.data.metric).toBe("diamonds");
    expect(new Set(calls.map((x) => x.scope))).toEqual(new Set(["server:survival"]));
  });

  test("pages the combined board and memoises it per reader", async () => {
    const { c, calls } = client({ [ORE]: [[1, "A", 5], [2, "B", 3], [3, "C", 2]], [DEEP]: [] });
    const r = await featuredLeaderboard(c, diamonds, "network", { limit: 1, offset: 1 });
    expect(r.ok && r.data.entries.map((e) => [e.rank, e.name])).toEqual([[2, "B"]]);
    const before = calls.length;
    await featuredLeaderboard(c, diamonds, "network", { limit: 1, offset: 2 });
    expect(calls.length).toBe(before);
  });

  test("a part nobody mined yet counts as nothing; both missing is not_found", async () => {
    const one = await featuredLeaderboard(client({ [DEEP]: [[1, "A", 7]] }).c, diamonds, "network");
    expect(one.ok && one.data.entries.map((e) => e.value)).toEqual([7]);
    const none = await featuredLeaderboard(client({}).c, diamonds, "network");
    expect(!none.ok && none.kind).toBe("not_found");
  });

  test("cakeutils down passes through", async () => {
    const r = await featuredLeaderboard(client({ [ORE]: [[1, "A", 1]], [DEEP]: "down" }).c, diamonds, "network");
    expect(!r.ok && r.kind).toBe("down");
  });

  test("a board without also is the API board unchanged", async () => {
    const fish: FeaturedBoard = findFeatured("fish")!;
    const { c, calls } = client({ "custom:minecraft:fish_caught": [[1, "A", 2]] });
    const r = await featuredLeaderboard(c, fish, "network", { limit: 10 });
    expect(r.ok && r.data.metric).toBe("custom:minecraft:fish_caught");
    expect(calls.length).toBe(1);
    expect(readerFor(c, fish)).toBe(c);
  });

  test("readerFor answers the board's metric combined and passes others through", async () => {
    const { c } = client({ [ORE]: [[1, "A", 1]], [DEEP]: [[1, "A", 2]], "mined:minecraft:stone": [[2, "B", 9]] });
    const r = readerFor(c, diamonds);
    const d = await r.leaderboard(diamonds.metric, "network", { limit: 10 });
    expect(d.ok && d.data.entries[0].value).toBe(3);
    const s = await r.leaderboard({ kind: "stat", type: "minecraft:mined", subject: "minecraft:stone" }, "network", { limit: 10 });
    expect(s.ok && s.data.entries[0].value).toBe(9);
  });
});
