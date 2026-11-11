import { describe, expect, test } from "bun:test";
import { boxOf, byDimension, gridStep, toShape, trailPaths, withoutLiving } from "#lib/onesoul/map.ts";
import { causeGroup, causes, deathsPerDay, perRound, signupsOverTime, survivalPerSoul, timeToClaim } from "#lib/onesoul/charts.ts";
import type { Feature, Soul } from "#lib/onesoul/types.ts";

const pt = (kind: string, x: number, z: number, dim: string, props: Record<string, unknown> = {}): Feature => ({ type: "Feature", id: `${kind}-${x}-${z}`, geometry: { type: "Point", coordinates: [x, z, 64] }, properties: { kind, dim, ...props } });

describe("One Soul map data", () => {
  test("positions are [x, z, y]: x east, z south, nothing flipped", () => {
    const m = toShape(pt("death", 10, -20, "minecraft:overworld", { name: "a", turn: 2 }), 1);
    expect(m && "x" in m ? [m.x, m.z, m.y] : null).toEqual([10, -20, 64]);
    expect(m && "href" in m ? m.href : null).toBe("/one-soul/rounds/1/2");
  });
  test("one map per dimension, the usual three first, modded ones after", () => {
    const maps = byDimension(
      [pt("grave", 0, 0, "mod:aether"), pt("death", 0, 0, "minecraft:the_end"), pt("spawn", 0, 0, "minecraft:overworld"), pt("death", 5, 5, "minecraft:the_nether")].map((f) => toShape(f, 1)!)
    );
    expect(maps.map((m) => m.dim)).toEqual(["minecraft:overworld", "minecraft:the_nether", "minecraft:the_end", "mod:aether"]);
  });
  test("unknown geometry and kinds never crash", () => {
    expect(toShape({ type: "Feature", geometry: { type: "Polygon", coordinates: [] }, properties: { dim: "x" } }, 1)).toBeNull();
    expect(toShape({ type: "Feature", geometry: null, properties: {} }, 1)).toBeNull();
    expect((toShape(pt("beacon", 1, 2, "minecraft:overworld"), 1) as { kind: string }).kind).toBe("other");
  });
  test("the box keeps room around the points and a sane shape", () => {
    const b = boxOf([{ id: "a", kind: "death", dim: "d", x: 0, z: 0, y: null, title: "", detail: null, href: null }], []);
    expect(b.w).toBeGreaterThanOrEqual(64);
    expect(gridStep(1000)).toBe(200);
    expect(gridStep(80)).toBe(20);
  });
  test("nothing of the living soul: no trail, no death, a waystone does not name them", () => {
    const fc = {
      type: "FeatureCollection" as const,
      features: [
        { type: "Feature" as const, geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] }, properties: { kind: "trail", dim: "d", uuid: "u1", outcome: "playing" } },
        { type: "Feature" as const, geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] }, properties: { kind: "trail", dim: "d", uuid: "u2", outcome: "died" } },
        { type: "Feature" as const, geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] }, properties: { kind: "trail", dim: "d", uuid: "u1", outcome: "died" } },
        pt("death", 1, 1, "d", { uuid: "u1", final: false }),
        pt("waystone", 2, 2, "d", { first_by: { uuid: "u1", name: "Living" } })
      ]
    };
    const out = withoutLiving(fc, { uuid: "u1" }).features;
    expect(out.map((f) => f.properties.kind)).toEqual(["trail", "waystone"]);
    expect(out[0].properties.uuid).toBe("u2");
    expect(out[1].properties.first_by).toBeNull();
    expect(withoutLiving(fc, null).features.length).toBe(4);
  });
  test("a trail in points form becomes one path per segment, from [at, x, y, z]", () => {
    const p = trailPaths({ server: "s", cycle: 1, soul: { uuid: "u", name: "n", turn: 3 }, interval_ms: 1, segments: [{ dim: "d", started_at: 0, ended_at: 60_000, points: [[0, 1, 70, 2], [1, 3, 70, 4]] }] });
    expect(p[0].points).toEqual([[1, 2], [3, 4]]);
  });
});

const soul = (o: Partial<Soul>): Soul => ({ uuid: "u", name: "n", server: "s", turn: 1, cycle: 1, started_at: 0, ended_at: 1000, duration_ms: 1000, cause: null, death: null, second_chance: null, outcome: "died", grave_id: null, has_journal: false, ...o });

describe("One Soul chart series", () => {
  test("the living soul has no bar; the record is the longest finished life", () => {
    const s = survivalPerSoul([soul({ turn: 1, duration_ms: 5 }), soul({ turn: 2, duration_ms: 9 }), soul({ turn: 3, outcome: "playing", duration_ms: null, ended_at: null })], false);
    expect(s.points.map((p) => p.key)).toEqual(["1/1", "1/2"]);
    expect(s.record).toBe("1/2");
  });
  test("rounds are counted inside themselves", () => {
    expect(perRound([soul({ cycle: 1, duration_ms: 5 }), soul({ cycle: 2, duration_ms: 7 }), soul({ cycle: 2, duration_ms: 3, turn: 2 })])).toEqual([
      { cycle: 1, souls: 1, total: 5, longest: 5 },
      { cycle: 2, souls: 2, total: 10, longest: 7 }
    ]);
  });
  test("causes: damage type first, then text, unknown is Other", () => {
    expect(causeGroup(soul({ death: { dim: "d", x: 0, y: 0, z: 0, damage_type: "minecraft:fall" } }))).toBe("Fell");
    expect(causeGroup(soul({ cause: "n drowned" }))).toBe("Drowned");
    expect(causeGroup(soul({ cause: "n did something odd" }))).toBe("Other");
    expect(causes([soul({ cause: "x" }), soul({ cause: "y", outcome: "skipped" })]).map((r) => [r.label, r.v])).toEqual([["Other", 1]]);
  });
  test("deaths per day fill the gaps; sign-ups count up; claim times fall in buckets", () => {
    const D = 86_400_000;
    expect(deathsPerDay([soul({ ended_at: 0 }), soul({ ended_at: 2 * D + 5 })]).map((p) => p.v)).toEqual([1, 0, 1]);
    expect(signupsOverTime([{ uuid: "a", name: "a", registered_at: 5, played: false }, { uuid: "b", name: "b", registered_at: 1, played: true }])).toEqual([{ t: 1, v: 1 }, { t: 5, v: 2 }]);
    const g = { id: "g", server: "s", cycle: 1, soul: { uuid: "u", name: "n", turn: 1 }, dim: "d", x: 0, y: 0, z: 0, items: 1, created_at: 0 };
    expect(timeToClaim([{ ...g, claimed_by: { uuid: "c", name: "c" }, claimed_at: 60_000 }, { ...g, claimed_by: null, claimed_at: null }]).map((c) => c.v)).toEqual([1, 0, 0, 0, 0]);
  });
});
