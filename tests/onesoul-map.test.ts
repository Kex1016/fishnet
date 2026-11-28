import { describe, expect, test } from "bun:test";
import { boxOf, byDimension, gridStep, landmarkMarks, toShape, trailPaths, withoutLiving } from "#lib/onesoul/map.ts";
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
  test("the living soul: their open trail is drawn (TH-31), no death of theirs, a waystone does not name them", () => {
    const line = (props: Record<string, unknown>) => ({ type: "Feature" as const, geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] }, properties: { kind: "trail", dim: "d", ...props } });
    const fc = {
      type: "FeatureCollection" as const,
      features: [
        line({ uuid: "u1", outcome: "playing" }),
        line({ uuid: "u2", outcome: "died" }),
        line({ uuid: "u1", outcome: "died" }),
        // another open turn (a skipped soul who may play again, a stale row): never drawn
        line({ uuid: "u3", outcome: null }),
        line({ uuid: "u3" }),
        line({ outcome: "playing" }),
        pt("death", 1, 1, "d", { uuid: "u1", final: false }),
        pt("death", 1, 1, "d", { uuid: "U1", final: false }),
        pt("waystone", 2, 2, "d", { first_by: { uuid: "u1", name: "Living" } })
      ]
    };
    const out = withoutLiving(fc, { uuid: "u1" }).features;
    expect(out.map((f) => `${f.properties.kind}:${f.properties.uuid ?? ""}`)).toEqual(["trail:u1", "trail:u2", "trail:u1", "waystone:"]);
    expect(out[3].properties.first_by).toBeNull();
    // the case of a uuid does not let the living soul's trail through as someone else's, nor their death
    expect(withoutLiving(fc, { uuid: "U1" }).features.filter((f) => f.properties.kind === "death")).toHaveLength(0);
    // no living soul (a finished round, or the status unreadable): no open trail at all
    const none = withoutLiving(fc, null).features;
    expect(none.filter((f) => f.properties.kind === "trail").map((f) => f.properties.outcome)).toEqual(["died", "died"]);
  });

  test("landmarks: stable portals and End portals of a finished round only, never without a position", () => {
    const ev = (kind: string, data: Record<string, unknown>, cycle = 1, name: string | null = "Alex") => ({ at: 1, cycle, kind, uuid: name ? "u" : null, name, data });
    const events = [
      ev("rift_stable", { dim: "minecraft:overworld", x: 10, y: 64, z: -3, turn: 2, first: true }),
      ev("rift_stable", { dim: "minecraft:overworld", x: 10, y: 64, z: -3, turn: 2, first: true }),
      ev("rift_stable", { dim: "minecraft:the_nether", x: 1, y: 70, z: 0 }, 1, null),
      ev("end_opened", { dim: "minecraft:overworld", x: 400, y: 30, z: 90, turn: 3, first: true }),
      ev("end_opened", { turn: 3 }),
      ev("rift_stable", { dim: "minecraft:overworld", x: "1", z: 2 }),
      ev("rift_stable", { dim: "minecraft:overworld", x: 5, z: 5 }, 2),
      ev("death", { dim: "minecraft:overworld", x: 5, z: 5 })
    ];
    const marks = landmarkMarks(events, 1, true);
    expect(marks.map((m) => `${m.kind} ${m.dim} ${m.x},${m.z}`)).toEqual(["portal minecraft:overworld 10,-3", "portal minecraft:the_nether 1,0", "end_portal minecraft:overworld 400,90"]);
    expect(marks.map((m) => m.title)).toEqual(["First stable portal", "Stable portal", "First End portal"]);
    expect(marks[0].href).toBe("/one-soul/rounds/1/2");
    expect(marks[1].detail).toBeNull();
    expect(landmarkMarks(events, 1, false)).toEqual([]);
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
