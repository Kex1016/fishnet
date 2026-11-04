import { expect, test } from "bun:test";
import type { BatchPlayer, PlayerProfile, StatValue } from "#lib/api/types.ts";
import { ok, fail } from "#lib/api/result.ts";
import { compareStats, groupByType, unitRank } from "#lib/players/explore.ts";
import { isUuidName, playerLabel, shortUuid, splitMini, titleCase, typeName } from "#lib/players/names.ts";
import { batchIncludes, compositeValue, includeKey, standing } from "#lib/players/ranks.ts";
import { parseHiddenList } from "#lib/server/hidden-list.ts";
import { COMPOSITES, FEATURED } from "#lib/boards.ts";

const sv = (type: string, subject: string, value: number, unit: StatValue["unit"] = "count", name: string | null = null): StatValue => ({
  type,
  subject,
  name,
  unit,
  value,
  display: String(value),
  icon: null
});

test("names: title case, uuid names, mini keys", () => {
  expect(titleCase("minecraft:diamond_ore")).toBe("Diamond Ore");
  expect(titleCase("create:pressed")).toBe("Pressed");
  expect(typeName([{ key: "minecraft:mined", name: "Mined" }], "minecraft:mined")).toBe("Mined");
  expect(typeName([{ key: "minecraft:mined", name: null }], "minecraft:mined")).toBe("Mined");
  expect(typeName(undefined, "create:pressed")).toBe("Pressed");
  expect(isUuidName("346d7245-336d-40b2-a26d-6f1f316d6d8c")).toBe(true);
  expect(isUuidName("346d7245336d40b2a26d6f1f316d6d8c")).toBe(true);
  expect(isUuidName("Pebblewick")).toBe(false);
  expect(playerLabel("346d7245-336d-40b2-a26d-6f1f316d6d8c")).toBe("Unnamed player");
  expect(playerLabel("Pebblewick")).toBe("Pebblewick");
  expect(shortUuid("346d7245-336d-40b2-a26d-6f1f316d6d8c")).toBe("346d7245");
  expect(splitMini("survival/skyblock-1")).toEqual({ server: "survival", mini: "skyblock-1" });
  expect(splitMini("survival")).toBeNull();
  expect(splitMini("survival/")).toBeNull();
});

test("explorer: biggest first inside one unit, units in reading order, unknown units last", () => {
  expect(unitRank("count")).toBeLessThan(unitRank("ticks"));
  expect(unitRank("ticks")).toBeLessThan(unitRank("distance_cm"));
  expect(unitRank("furlongs" as never)).toBe(10);
  const rows = [
    sv("minecraft:custom", "minecraft:walk_one_cm", 999_999, "distance_cm"),
    sv("minecraft:custom", "minecraft:play_time", 5_000_000, "ticks"),
    sv("minecraft:custom", "minecraft:jump", 12),
    sv("minecraft:custom", "minecraft:deaths", 40),
    sv("minecraft:custom", "minecraft:deaths_b", 40)
  ];
  const sorted = [...rows].sort(compareStats).map((r) => r.subject);
  expect(sorted).toEqual(["minecraft:deaths", "minecraft:deaths_b", "minecraft:jump", "minecraft:play_time", "minecraft:walk_one_cm"]);
});

test("explorer: groups follow the catalogue's order, unknown types after, perType caps rows but keeps total", () => {
  const types = [
    { key: "minecraft:mined", name: "Mined", kind: "block" },
    { key: "minecraft:killed", name: "Killed", kind: "entity" }
  ];
  const rows = [
    sv("minecraft:killed", "minecraft:zombie", 3),
    sv("create:pressed", "minecraft:iron_ingot", 7),
    sv("minecraft:mined", "minecraft:stone", 10),
    sv("minecraft:mined", "minecraft:dirt", 30),
    sv("minecraft:mined", "minecraft:sand", 20)
  ];
  const g = groupByType(rows, types, 2);
  expect(g.map((x) => x.type)).toEqual(["minecraft:mined", "minecraft:killed", "create:pressed"]);
  expect(g[0].name).toBe("Mined");
  expect(g[0].kind).toBe("block");
  expect(g[0].total).toBe(3);
  expect(g[0].stats.map((s) => s.subject)).toEqual(["minecraft:dirt", "minecraft:sand"]);
  expect(g[2].name).toBe("Pressed");
  expect(g[2].kind).toBeNull();
  expect(groupByType(rows, undefined).map((x) => x.type)).toEqual(["minecraft:killed", "create:pressed", "minecraft:mined"]);
  expect(groupByType([], types)).toEqual([]);
});

const profile: PlayerProfile = {
  uuid: "11111111-1111-4111-8111-111111111111",
  name: "Cod",
  online: false,
  server: null,
  first_seen: 1,
  last_seen: 2,
  skin: null,
  prefix: [],
  suffix: [],
  playtime: { scope: "network", total_ms: 3_600_000, by_server: { survival: 3_000_000 }, by_mini: {} }
};
const mined = FEATURED.find((b) => b.id === "mined")!;
const playtime = FEATURED.find((b) => b.id === "playtime")!;

test("ranks: include keys and the batch list stay inside the API's limits", () => {
  expect(includeKey({ kind: "playtime" })).toBe("playtime");
  expect(includeKey({ kind: "stat", type: "minecraft:mined", subject: "*" })).toBe("stats:mined:*");
  expect(includeKey({ kind: "stat", type: "create:pressed", subject: "minecraft:iron_ingot" })).toBe("stats:create:pressed:minecraft:iron_ingot");
  const inc = batchIncludes(FEATURED, COMPOSITES);
  expect(inc.length).toBeLessThanOrEqual(32);
  expect(new Set(inc).size).toBe(inc.length);
  expect(inc).not.toContain("playtime");
  expect(inc).toContain("stats:mined:*");
});

test("ranks: on the board, below the page, never did it, board missing", () => {
  const board = ok({ metric: "mined:*", scope: "network", unit: "count", total: 40, entries: [{ rank: 1, uuid: "x", name: "A", value: 100, unit: "count", display: "100" }, { rank: 2, uuid: profile.uuid, name: "Cod", value: 50, unit: "count", display: "50" }] });
  const me: BatchPlayer = { ref: profile.uuid, uuid: profile.uuid, name: "Cod", online: false, server: null, stats: { "stats:mined:*": sv("minecraft:mined", "*", 50) } };
  const on = standing(mined, board, me, profile, "network", 100)!;
  expect(on.rank).toBe(2);
  expect(on.total).toBe(40);
  expect(on.display).toBe("50");
  expect(on.href).toBe("/leaderboards/mined%3A*");

  const below = standing(mined, ok({ ...board.data, entries: [board.data.entries[0]] }), me, profile, "server:survival", 100)!;
  expect(below.rank).toBeNull();
  expect(below.value).toBe(50);
  expect(below.href).toBe("/leaderboards/mined%3A*?scope=server%3Asurvival");

  const never = standing(mined, ok({ ...board.data, entries: [board.data.entries[0]] }), { ...me, stats: {} }, profile, "network", 100)!;
  expect(never.rank).toBeNull();
  expect(never.value).toBe(0);
  expect(never.display).toBe("0");

  expect(standing(mined, fail("not_found"), me, profile, "network", 100)).toBeNull();
  expect(standing(mined, fail("down"), me, profile, "network", 100)).toBeNull();

  const pt = standing(playtime, ok({ metric: "playtime", scope: "network", unit: "ms", total: 3, entries: [] }), null, profile, "network", 100)!;
  expect(pt.rank).toBeNull();
  expect(pt.value).toBe(3_600_000);
  expect(pt.display).toBe("1h 0m");
  const ptServer = standing(playtime, ok({ metric: "playtime", scope: "server:survival", unit: "ms", total: 3, entries: [] }), { ...me, playtime: { scope: "server:survival", total_ms: 60_000, by_server: {}, by_mini: {} } }, profile, "server:survival", 100)!;
  expect(ptServer.value).toBe(60_000);
});

test("ranks: a composite adds the parts inside one scope and never two units", () => {
  const travel = COMPOSITES.find((c) => c.id === "travel")!;
  const me: BatchPlayer = {
    ref: "r",
    uuid: profile.uuid,
    name: "Cod",
    online: false,
    server: null,
    stats: {
      "stats:custom:minecraft:walk_one_cm": sv("minecraft:custom", "minecraft:walk_one_cm", 150_000, "distance_cm"),
      "stats:custom:minecraft:swim_one_cm": sv("minecraft:custom", "minecraft:swim_one_cm", 50_000, "distance_cm"),
      "stats:custom:minecraft:fly_one_cm": sv("minecraft:custom", "minecraft:fly_one_cm", 7, "count")
    }
  };
  expect(compositeValue(travel, me)).toEqual({ value: 200_000, display: "2.00 km" });
  expect(compositeValue(travel, { ...me, stats: {} })).toBeNull();
  expect(compositeValue(travel, null)).toBeNull();
});

test("hidden list: uuids with or without dashes, names, comments, case", () => {
  const list = parseHiddenList("# opted out\n346D7245-336d-40b2-a26d-6f1f316d6d8c\n\n  Saltmarsh  # asked on 3 Nov\n");
  expect(list.size).toBe(2);
  expect(list.has("346d7245336d40b2a26d6f1f316d6d8c")).toBe(true);
  expect(list.has("saltmarsh")).toBe(true);
  expect(list.hasPlayer({ uuid: "00000000-0000-4000-8000-000000000000", name: "SALTMARSH" })).toBe(true);
  expect(list.hasPlayer({ uuid: "00000000-0000-4000-8000-000000000000", name: "Pebblewick" })).toBe(false);
  expect(parseHiddenList("").size).toBe(0);
  expect(parseHiddenList("").has("anyone")).toBe(false);
});
