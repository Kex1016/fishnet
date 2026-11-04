import { beforeEach, describe, expect, mock, test } from "bun:test";
import { distribution, median, playerHref, playerLabel, scopeLabel, scopeMinis, sum } from "../src/routes/leaderboards/board.ts";
import { COMPOSITES, compositeHref, featuredFor, findComposite, findFeatured, FEATURED } from "#lib/boards.ts";
import { boardHref, metricKey } from "#lib/api/metric.ts";
import { ok, fail } from "#lib/api/result.ts";
import type { Leaderboard } from "#lib/api/types.ts";

// composite.server.ts reaches the opt-out list, which reads $app/env (not there under bun test): nobody is hidden here
mock.module("../src/lib/server/hidden.ts", () => ({
  isHidden: () => false,
  isHiddenPlayer: () => false,
  withoutHidden: <T>(rows: T[]) => rows
}));
const { compositeBoard, includeFor, resetCompositeMemo } = await import("../src/routes/leaderboards/composite.server.ts");

describe("config", () => {
  test("featured ids resolve and never collide with criterion form", () => {
    for (const b of FEATURED) expect(b.id.includes(":")).toBe(false);
    expect(findFeatured("diamonds")?.metric).toEqual({ kind: "stat", type: "minecraft:mined", subject: "minecraft:diamond_ore" });
    expect(featuredFor({ kind: "stat", type: "minecraft:mined", subject: "*" })?.id).toBe("mined");
    expect(findComposite("travel")?.parts.length).toBe(11);
    expect(findFeatured("travel")).toBeUndefined();
    expect(compositeHref(COMPOSITES[0], "server:survival")).toBe("/leaderboards/travel?scope=server%3Asurvival");
    expect(metricKey(FEATURED[0].metric)).toBe("playtime");
    expect(boardHref(findFeatured("fish")!.metric)).toBe("/leaderboards/custom%3Aminecraft%3Afish_caught");
  });
});

describe("board helpers", () => {
  test("scope labels use display names and fall back to ids", () => {
    const servers = [{ id: "survival", display_name: "Survival" }];
    expect(scopeLabel("network", servers)).toBe("Network");
    expect(scopeLabel("server:survival", servers)).toBe("Survival");
    expect(scopeLabel("server:gone", servers)).toBe("gone");
    expect(scopeLabel("mini:survival/sky-1", servers, [{ server: "survival", id: "sky-1", display_name: "Skyblock 1" }])).toBe("Skyblock 1");
    expect(scopeLabel("junk", servers)).toBe("Network");
  });

  test("the viewed mini stays in the switch even when it is empty right now", () => {
    expect(scopeMinis("mini:survival/sky-2", [{ server: "survival", id: "sky-1", display_name: "Skyblock 1" }]).map((m) => m.id)).toEqual(["sky-1", "sky-2"]);
    expect(scopeMinis("server:survival", [])).toEqual([]);
  });

  test("a UUID name is shown as a short player id and linked by uuid", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    expect(playerLabel({ uuid, name: uuid })).toBe("Player 123e4567");
    expect(playerHref({ uuid, name: uuid })).toBe(`/players/${uuid}`);
    expect(playerLabel({ uuid, name: "Roach" })).toBe("Roach");
    expect(playerHref({ uuid, name: "a b" })).toBe("/players/a%20b");
  });

  test("median and sum", () => {
    expect(median([])).toBeNull();
    expect(median([5])).toBe(5);
    expect(median([1, 9, 3])).toBe(3);
    expect(median([1, 2, 3, 10])).toBe(3);
    expect(sum([1, 2, 3])).toBe(6);
  });

  test("distribution: tenfold steps, empty steps kept at 0, units from the base step", () => {
    const d = distribution([1, 5, 9, 10, 99, 100, 100000], "count");
    expect(d.map((p) => p.label)).toEqual(["1 to 10", "10 to 100", "100 to 1k", "1k to 10k", "10k to 100k", "100k to 1M"]);
    expect(d.map((p) => p.v)).toEqual([3, 2, 1, 0, 0, 1]);
    expect(d[0].display).toBe("3 players");
    const t = distribution([100, 72_000 * 3, 72_000 * 500], "ticks");
    expect(t[0].label).toBe("under 1h");
    expect(t.map((p) => p.v)).toEqual([1, 1, 0, 1]);
    expect(distribution([], "count")).toEqual([]);
    expect(distribution([0, -1], "count")).toEqual([]);
    expect(distribution([1000, 1000], "count").map((p) => p.v)).toEqual([2]);
  });
});

// ---- composite boards, against a fake reader (the real one is the cached client)

const CM = (n: number) => n * 100;
function entry(i: number, name: string, value: number) {
  return { rank: i, uuid: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`, name, value, unit: "distance_cm", display: "" };
}
const board = (entries: ReturnType<typeof entry>[], total = entries.length): Leaderboard => ({ metric: "custom:minecraft:walk_one_cm", scope: "network", unit: "distance_cm", total, entries });
const stat = (subject: string, value: number, unit = "distance_cm") => ({ type: "minecraft:custom", subject, name: null, unit, value, display: "", icon: null });

describe("compositeBoard", () => {
  beforeEach(() => resetCompositeMemo());
  const parts = findComposite("travel")!;

  function reader(opts: { players: ReturnType<typeof entry>[]; values: Record<string, Record<string, number>>; unitOverride?: Record<string, string>; walkFails?: boolean }) {
    const calls = { leaderboard: 0, batch: 0, lastInclude: [] as string[], scopes: [] as string[] };
    const c = {
      leaderboard: async (_m: unknown, scope: string, page: { limit?: number; offset?: number } = {}) => {
        calls.leaderboard++;
        calls.scopes.push(scope);
        if (opts.walkFails) return fail("not_found");
        const off = page.offset ?? 0;
        return ok(board(opts.players.slice(off, off + (page.limit ?? 10)), opts.players.length), 1000);
      },
      batch: async (refs: string[], include: string[], scope?: string) => {
        calls.batch++;
        calls.lastInclude = include;
        calls.scopes.push(scope ?? "network");
        return ok({
          scope: scope ?? "network",
          not_found: [],
          players: refs.map((uuid) => {
            const p = opts.players.find((x) => x.uuid === uuid)!;
            const stats: Record<string, ReturnType<typeof stat>> = {};
            for (const [subject, v] of Object.entries(opts.values[uuid] ?? {})) stats[`stats:custom:${subject}`] = stat(subject, v, opts.unitOverride?.[subject]);
            return { ref: uuid, uuid, name: p.name, online: false, server: null, stats };
          })
        }, 2000);
      }
    };
    return { c: c as never, calls };
  }

  test("adds each player's parts inside the one scope, ranks them, ties by uuid", async () => {
    const players = [entry(1, "A", CM(10)), entry(2, "B", CM(5)), entry(3, "C", CM(1))];
    const { c, calls } = reader({
      players,
      values: {
        [players[0].uuid]: { "minecraft:walk_one_cm": CM(10), "minecraft:swim_one_cm": CM(1) },
        [players[1].uuid]: { "minecraft:walk_one_cm": CM(5), "minecraft:fly_one_cm": CM(6) },
        [players[2].uuid]: { "minecraft:walk_one_cm": CM(1), "minecraft:boat_one_cm": CM(10) }
      }
    });
    const r = await compositeBoard(c, parts, "server:survival");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // all three come to 11 m, so the tie is broken by uuid: A, B, C
    expect(r.data.entries.map((e) => [e.rank, e.name, e.value])).toEqual([[1, "A", CM(11)], [2, "B", CM(11)], [3, "C", CM(11)]]);
    expect(r.data.metric).toBe("travel");
    expect(r.data.scope).toBe("server:survival");
    expect(r.data.unit).toBe("distance_cm");
    expect(r.data.entries[0].display).toBe("11.0 m");
    expect(calls.scopes.every((s) => s === "server:survival")).toBe(true);
    expect(calls.lastInclude).toHaveLength(11);
    expect(calls.lastInclude[0]).toBe("stats:custom:minecraft:walk_one_cm");
  });

  test("ignores parts in another unit and players with nothing", async () => {
    const players = [entry(1, "A", CM(10)), entry(2, "B", CM(5))];
    const { c } = reader({
      players,
      values: { [players[0].uuid]: { "minecraft:walk_one_cm": CM(10), "minecraft:swim_one_cm": 999 }, [players[1].uuid]: {} },
      unitOverride: { "minecraft:swim_one_cm": "count" }
    });
    const r = await compositeBoard(c, parts, "network");
    if (!r.ok) throw new Error("not ok");
    expect(r.data.entries.map((e) => [e.name, e.value])).toEqual([["A", CM(10)]]);
    expect(r.data.total).toBe(1);
  });

  test("pages through the universe and batches 100 at a time", async () => {
    const players = Array.from({ length: 230 }, (_, i) => entry(i + 1, `P${i + 1}`, CM(230 - i)));
    const values = Object.fromEntries(players.map((p) => [p.uuid, { "minecraft:walk_one_cm": p.value }]));
    const { c, calls } = reader({ players, values });
    const r = await compositeBoard(c, parts, "network");
    if (!r.ok) throw new Error("not ok");
    expect(r.data.entries).toHaveLength(230);
    expect(r.data.capped).toBe(false);
    expect(calls.leaderboard).toBe(3);
    expect(calls.batch).toBe(3);
    expect(r.data.entries[0].name).toBe("P1");
    expect(r.asOf).toBe(1000);
  });

  test("a never-recorded universe stat is not_found; a result is memoised for 15 s, a failure is not", async () => {
    const failing = reader({ players: [], values: {}, walkFails: true });
    const a = await compositeBoard(failing.c, parts, "network");
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.kind).toBe("not_found");
    await new Promise((r) => setTimeout(r, 0));
    await compositeBoard(failing.c, parts, "network");
    expect(failing.calls.leaderboard).toBe(2);

    const players = [entry(1, "A", CM(1))];
    const good = reader({ players, values: { [players[0].uuid]: { "minecraft:walk_one_cm": CM(1) } } });
    await compositeBoard(good.c, parts, "network", () => 0);
    await compositeBoard(good.c, parts, "network", () => 14_999);
    expect(good.calls.batch).toBe(1);
    await compositeBoard(good.c, parts, "network", () => 15_000);
    expect(good.calls.batch).toBe(2);
    await compositeBoard(good.c, parts, "server:x", () => 15_000);
    expect(good.calls.batch).toBe(3);
  });

  test("includes: playtime cannot be a part", () => {
    expect(includeFor({ kind: "playtime" })).toBeNull();
    expect(includeFor({ kind: "stat", type: "create:pressed", subject: "minecraft:iron_ingot" })).toBe("stats:create:pressed:minecraft:iron_ingot");
  });
});
