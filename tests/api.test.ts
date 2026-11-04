import { expect, test } from "bun:test";
import { boardHref, metricKey, parseMetric } from "#lib/api/metric.ts";
import { listIsEmpty, problemCode, fail } from "#lib/api/result.ts";
import { parseScope, scopeOf } from "#lib/api/scope.ts";

test("scopes round-trip and reject junk", () => {
  expect(parseScope(undefined)).toEqual({ kind: "network" });
  expect(parseScope("server:survival")).toEqual({ kind: "server", server: "survival" });
  expect(parseScope("mini:survival/skyblock-1")).toEqual({ kind: "mini", server: "survival", mini: "skyblock-1" });
  expect(scopeOf({ kind: "mini", server: "a", mini: "b" })).toBe("mini:a/b");
  expect(parseScope("server:")).toBeNull();
  expect(parseScope("mini:a")).toBeNull();
  expect(parseScope("mini:a/b/c")).toBeNull();
  expect(parseScope("global")).toBeNull();
});

test("metrics in criterion form", () => {
  expect(parseMetric("playtime")).toEqual({ kind: "playtime" });
  expect(parseMetric("mined:minecraft:stone")).toEqual({ kind: "stat", type: "minecraft:mined", subject: "minecraft:stone" });
  expect(parseMetric("mined:*")).toEqual({ kind: "stat", type: "minecraft:mined", subject: "*" });
  expect(parseMetric("create:pressed:minecraft:iron_ingot")).toEqual({ kind: "stat", type: "create:pressed", subject: "minecraft:iron_ingot" });
  expect(parseMetric("mined")).toBeNull();
  expect(parseMetric("mined::stone")).toBeNull();
  expect(metricKey({ kind: "stat", type: "minecraft:killed", subject: "minecraft:zombie" })).toBe("killed:minecraft:zombie");
  expect(boardHref({ kind: "stat", type: "minecraft:mined", subject: "*" }, "server:survival")).toBe("/leaderboards/mined%3A*?scope=server%3Asurvival");
});

test("results", () => {
  expect(listIsEmpty({ total: 0, entries: [] })).toBe(true);
  expect(listIsEmpty({ total: 3, entries: [] })).toBe(false);
  expect(listIsEmpty({ types: [] })).toBe(true);
  expect(listIsEmpty({ uuid: "x" })).toBe(false);
  expect(problemCode(fail("bad_request", { problem: { type: "urn:cakeutils:problem:mixed_units", title: "", status: 400, detail: "" } }))).toBe("mixed_units");
  expect(problemCode(fail("down"))).toBeNull();
});
