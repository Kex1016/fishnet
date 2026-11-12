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
import type { Death } from "#lib/network/types.ts";

const busy = () => structuredClone(worldOf("busy"));

function extrasOf(w: World, hidden: string[] = ["onesoul"]) {
  const seen: string[] = [];
  const fetchImpl = (input: string | URL | Request, init?: RequestInit) => {
    const req = new Request(input, init);
    seen.push(new URL(req.url).pathname + new URL(req.url).search);
    return handleMock(w, req);
  };
  const core = createCore({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl, log: () => undefined });
  const x = createExtras(core, { priority: () => "page", hidden: () => new ServerList(hidden), exclude: () => hidden });
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
