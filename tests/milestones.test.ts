import { expect, test } from "bun:test";
import { dayGrid, dayStart, firstsByPlayer, nextRung, rowKey, statHref, statLabel, whenOf, whoOf } from "#lib/milestones/helpers.ts";

const row = (o: Record<string, unknown> = {}) => ({ threshold: 100, display: "100", uuid: null, name: null, reached_at: null, backfilled: false, ...o }) as never;

test("when: exact, before tracking, none", () => {
  expect(whenOf({ reached_at: 5, backfilled: false })).toEqual({ state: "at", at: 5 });
  expect(whenOf({ reached_at: null, backfilled: true })).toEqual({ state: "before" });
  expect(whenOf({ reached_at: 5, backfilled: true })).toEqual({ state: "before" });
  expect(whenOf({ reached_at: null, backfilled: false })).toEqual({ state: "none" });
});

test("who needs both uuid and name; the player endpoint's rows have neither field", () => {
  expect(whoOf({ uuid: "u", name: "Ann" })).toEqual({ uuid: "u", name: "Ann" });
  expect(whoOf({ uuid: "u", name: null })).toBeNull();
  expect(whoOf({})).toBeNull();
});

test("stat labels fall back to the key and say 'All' for type totals", () => {
  expect(statLabel({ type: "minecraft:mined", subject: "minecraft:stone", stat_name: "Stone" })).toBe("Stone mined");
  expect(statLabel({ type: "minecraft:mined", subject: "minecraft:diamond_ore", stat_name: null })).toBe("Diamond Ore mined");
  expect(statLabel({ type: "minecraft:mined", subject: "*", stat_name: null })).toBe("Blocks mined");
  expect(statHref({ metric: "mined:minecraft:stone" }, "server:survival")).toBe("/leaderboards/mined%3Aminecraft%3Astone?scope=server%3Asurvival");
  expect(statHref({ metric: "mined:*" })).toBe("/leaderboards/mined%3A*");
  expect(statHref({ metric: "garbage" })).toBeNull();
  expect(rowKey({ metric: "mined:*", threshold: 1000 })).toBe("mined:*#1000");
});

test("firsts: counted per player, ties by name, unknown players skipped", () => {
  const rows = [
    { uuid: "b", name: "Bea" }, { uuid: "a", name: "Ann" }, { uuid: "b", name: "Bea" },
    { uuid: null, name: null }, { uuid: "c", name: "Cy" }, { uuid: "a", name: "Ann" }, {}
  ];
  expect(firstsByPlayer(rows)).toEqual([
    { uuid: "a", name: "Ann", count: 2 }, { uuid: "b", name: "Bea", count: 2 }, { uuid: "c", name: "Cy", count: 1 }
  ]);
  expect(firstsByPlayer([])).toEqual([]);
});

test("next rung is the first one nobody reached; backfilled ones count as reached", () => {
  expect(nextRung([row({ backfilled: true }), row({ reached_at: 1 }), row(), row()])).toBe(2);
  expect(nextRung([row({ reached_at: 1 })])).toBe(-1);
  expect(nextRung([])).toBe(-1);
});

const D = 86_400_000;
const NOW = Date.UTC(2026, 10, 4, 18, 0); // Wed 4 Nov 2026

test("day grid: a new install has no data in any cell", () => {
  const g = dayGrid([], null, NOW);
  expect(g.rows).toHaveLength(7);
  expect(g.rows.every((r) => r.cells.every((c) => c === null))).toBe(true);
});

test("day grid: Monday-first rows, weeks as columns, zero after recording began, null before and after", () => {
  const since = Date.UTC(2026, 10, 2, 9); // Mon 2 Nov
  const g = dayGrid([{ day: dayStart(Date.UTC(2026, 10, 3)), v: 4 }], since, NOW);
  expect(g.weeks).toBe(1);
  expect(g.columns).toEqual(["2 Nov"]);
  expect(g.rows.map((r) => r.cells[0])).toEqual([0, 4, 0, null, null, null, null]); // Mon, Tue=4, Wed=0, rest is the future
});

test("day grid: data older than the cap is clipped to the last 13 weeks", () => {
  const old = Date.UTC(2026, 0, 5);
  const g = dayGrid([{ day: old, v: 1 }], old, NOW);
  expect(g.weeks).toBe(13);
  expect(g.columns).toHaveLength(13);
  expect(dayStart(NOW) - dayStart(old)).toBeGreaterThan(13 * 7 * D);
});
