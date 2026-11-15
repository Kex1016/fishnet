// FM-0b: world ordering and labels, and the fixture sync (MAP-43): raw vanilla names with order 0, mini worlds,
// string epoch, a 304 without Content-Type, cached tiles of worlds that left /v2/map.
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ok } from "#lib/api/result.ts";
import { sortWorlds, worldLabel } from "#lib/map/worlds.ts";
import { mockFetch } from "#lib/server/cakeutils/mock/index.ts";
import { createTileService } from "#lib/server/map/tiles.ts";

const w = (id: string, name = id, extra: Record<string, unknown> = {}) => ({ id, dimension: null as string | null, name, order: 0, mini: null as string | null, area: null as null | "overworld" | "nether" | "end", ...extra });

describe("worlds.ts", () => {
  test("vanilla first (overworld, nether, end), the rest by name", () => {
    const list = [
      w("minecraft_the_end", "minecraft:the_end", { dimension: "minecraft:the_end" }),
      w("zeta", "Zeta"),
      w("minecraft_the_nether", "minecraft:the_nether", { dimension: "minecraft:the_nether" }),
      w("alpha", "alpha"),
      w("minecraft_overworld", "minecraft:overworld", { dimension: "minecraft:overworld" })
    ];
    expect(sortWorlds(list).map((x) => x.id)).toEqual(["minecraft_overworld", "minecraft_the_nether", "minecraft_the_end", "alpha", "zeta"]);
    expect(list[0]!.id).toBe("minecraft_the_end"); // input untouched
  });
  test("labels", () => {
    expect(worldLabel(w("minecraft_overworld", "minecraft:overworld"))).toBe("Overworld");
    expect(worldLabel(w("minecraft_the_nether", "minecraft:the_nether"))).toBe("The Nether");
    expect(worldLabel(w("minecraft_the_end", "minecraft:the_end"))).toBe("The End");
    expect(worldLabel(w("x", "Creative Plots"))).toBe("Creative Plots");
    expect(worldLabel(w("mymod_deep_dark", "mymod:deep_dark"))).toBe("Deep dark");
    expect(worldLabel(w("a", "<b>x</b>"))).toBe("<b>x</b>"); // text only; the page escapes it
  });
  test("mini worlds come last, grouped by mini, then area; label names the mini", () => {
    const list = [
      w("m_b_end", "Beta Island", { mini: "beta", area: "end" }),
      w("m_a_nether", "Alpha Island", { mini: "alpha", area: "nether" }),
      w("m_a_ow", "Alpha Island", { mini: "alpha", area: "overworld" }),
      w("minecraft_the_end", "minecraft:the_end", { dimension: "minecraft:the_end" }),
      w("minecraft_overworld", "minecraft:overworld", { dimension: "minecraft:overworld" })
    ];
    expect(sortWorlds(list).map((x) => x.id)).toEqual(["minecraft_overworld", "minecraft_the_end", "m_a_ow", "m_a_nether", "m_b_end"]);
    expect(worldLabel(list[2]!)).toBe("Alpha Island · Overworld");
    expect(worldLabel(w("x", "", { mini: "alpha", area: "end" }))).toBe("alpha · The End");
  });
});

async function get(path: string, headers: Record<string, string> = {}) {
  return mockFetch("busy")(new Request(`http://mock/v2${path}`, { headers: { authorization: "Bearer cu_mock_mock", ...headers } }));
}

describe("mock matches the fixtures (MAP-43)", () => {
  test("index: raw vanilla names with order 0; a mini world has mini and area", async () => {
    const r = await get("/map");
    const idx = (await r.json()) as { servers: { server: string; worlds: { id: string; name: string; order: number; mini: string | null; area: string | null }[] }[] };
    const surv = idx.servers.find((s) => s.server === "survival")!;
    expect(surv.worlds.every((x) => x.order === 0)).toBe(true);
    expect(surv.worlds.find((x) => x.id === "minecraft_overworld")!.name).toBe("minecraft:overworld");
    const mini = surv.worlds.filter((x) => x.mini);
    expect(mini.length).toBeGreaterThan(0);
    expect(mini.every((x) => x.area !== null)).toBe(true);
    expect(surv.worlds.filter((x) => !x.mini).every((x) => x.area === null)).toBe(true);
  });
  test("changes: epoch is a string", async () => {
    const c = (await (await get("/map/survival/worlds/minecraft_overworld/changes")).json()) as { epoch: unknown };
    expect(typeof c.epoch).toBe("string");
  });
  test("a 304 has no Content-Type (JSON and tiles)", async () => {
    for (const path of ["/map", "/map/survival/tiles/minecraft_overworld/3/0_0.png"]) {
      const first = await get(path);
      const etag = first.headers.get("etag")!;
      expect(first.headers.get("content-type")).toBeTruthy();
      const again = await get(path, { "if-none-match": etag });
      expect(again.status).toBe(304);
      expect(again.headers.get("content-type")).toBeNull();
    }
  });
  test("a mini world has tiles", async () => {
    expect((await get("/map/survival/tiles/cakeutils_miniservers_skyblock-1_overworld/3/0_0.png")).status).toBe(200);
  });
});

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("tile cache drops worlds that left /v2/map", () => {
  test("a world that is no longer listed loses its tiles; listed ones and finished rounds stay", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fishnet-worlds-"));
    dirs.push(dir);
    const put = (...p: string[]) => {
      mkdirSync(join(dir, ...p.slice(0, -1)), { recursive: true });
      writeFileSync(join(dir, ...p), new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]));
    };
    put("survival", "minecraft_overworld", "3", "0_0.png");
    put("survival", "cakeutils_miniservers_skyblock-1_overworld", "3", "0_0.png");
    put("gone", "minecraft_overworld", "3", "0_0.png");
    put("survival", "@round", "4", "minecraft_overworld", "3", "0_0.png");
    let listed: Map<string, Set<string>> | null = new Map([["survival", new Set(["minecraft_overworld", "cakeutils_miniservers_skyblock-1_overworld"])]]);
    const svc = createTileService({ dir, maxBytes: 0, sweepMs: 0, log: () => {}, visible: () => true, listed: async () => listed, source: async () => ok({ notModified: true, png: null, etag: null, cacheControl: null, lastModified: null }) });
    await svc.sweep();
    expect(existsSync(join(dir, "survival", "cakeutils_miniservers_skyblock-1_overworld"))).toBe(true);
    expect(existsSync(join(dir, "gone", "minecraft_overworld"))).toBe(false); // its server is not listed: its worlds go
    listed = new Map([["survival", new Set(["minecraft_overworld"])]]); // the mini went private
    await svc.sweep();
    expect(existsSync(join(dir, "survival", "cakeutils_miniservers_skyblock-1_overworld"))).toBe(false);
    expect(existsSync(join(dir, "survival", "minecraft_overworld", "3", "0_0.png"))).toBe(true);
    expect(existsSync(join(dir, "survival", "@round", "4", "minecraft_overworld", "3", "0_0.png"))).toBe(true);
    listed = null; // unknown: nothing is dropped
    await svc.sweep();
    expect(existsSync(join(dir, "survival", "minecraft_overworld"))).toBe(true);
    svc.stop();
  });
});
