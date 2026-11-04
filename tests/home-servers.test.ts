import { expect, test } from "bun:test";
import { boardSum, barRows, isOutage, MAX_PAGES } from "../src/routes/servers/boards.ts";
import { fail, ok } from "#lib/api/result.ts";
import type { Leaderboard } from "#lib/api/types.ts";
import { PLAYTIME } from "#lib/api/metric.ts";

const entry = (i: number, value: number) => ({ rank: i + 1, uuid: `u${i}`, name: `p${i}`, value, unit: "count", display: String(value) });

function board(total: number, perValue = 1) {
  const calls: number[] = [];
  const c = {
    leaderboard: async (_m: unknown, _s: unknown, page: { limit?: number; offset?: number } = {}) => {
      const offset = page.offset ?? 0;
      calls.push(offset);
      const n = Math.max(0, Math.min(page.limit ?? 10, total - offset));
      const data: Leaderboard = { metric: "mined:*", scope: "network", unit: "count", total, entries: Array.from({ length: n }, (_, i) => entry(offset + i, perValue)) };
      return ok(data);
    }
  };
  return { c, calls };
}

test("a total adds every player on every page", async () => {
  const { c, calls } = board(250, 2);
  const r = await boardSum(c, PLAYTIME, "network");
  expect(r.ok && r.data.sum).toBe(500);
  expect(r.ok && r.data.players).toBe(250);
  expect(r.ok && r.data.top.length).toBe(100);
  expect(r.ok && r.data.complete).toBe(true);
  expect(calls.sort((a, b) => a - b)).toEqual([0, 100, 200]);
});

test("an empty scope is ok and empty, with a zero sum", async () => {
  const r = await boardSum(board(0).c, PLAYTIME, "server:nope");
  expect(r.ok && r.empty).toBe(true);
  expect(r.ok && r.data.sum).toBe(0);
});

test("opted-out players are left out of the sum and the count", async () => {
  const r = await boardSum(board(5, 10).c, PLAYTIME, "network", (rows) => rows.filter((e) => e.name !== "p1"));
  expect(r.ok && r.data.sum).toBe(40);
  expect(r.ok && r.data.players).toBe(4);
});

test("a huge board stops at MAX_PAGES and says so", async () => {
  const { c, calls } = board(MAX_PAGES * 100 + 50);
  const r = await boardSum(c, PLAYTIME, "network");
  expect(calls.length).toBe(MAX_PAGES);
  expect(r.ok && r.data.complete).toBe(false);
});

test("a 404 passes through, and a failing later page fails the total", async () => {
  expect(await boardSum({ leaderboard: async () => fail("not_found") }, PLAYTIME, "network")).toMatchObject({ ok: false, kind: "not_found" });
  let n = 0;
  const flaky = { leaderboard: async (_m: unknown, _s: unknown, p: { offset?: number } = {}) => (n++ === 0 ? ok({ metric: "x", scope: "network", unit: "count", total: 150, entries: [entry(0, 1)] } as Leaderboard) : fail("down")) };
  const r = await boardSum(flaky, PLAYTIME, "network");
  expect(isOutage(r)).toBe(true);
});

test("bar rows link to the player", () => {
  expect(barRows([entry(0, 3)], 5)[0]).toMatchObject({ rank: 1, label: "p0", href: "/players/p0" });
  expect(barRows(Array.from({ length: 9 }, (_, i) => entry(i, 1)), 5).length).toBe(5);
});
