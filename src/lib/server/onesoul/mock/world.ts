// The One Soul part of the mock world (constructed from cakeutils v2/oneSoul/API-EXPANSION.md and
// FISHNET-HANDOFF.md; no captures exist yet). Stored inside the scenario fixture (`World.onesoul`) and
// answered by ./handler.ts. Times are offsets before "now" (`*_ago`), negative = in the future.
//
// busy: round 1 is over (archived), round 2 runs; Alice-like current soul on Borrowed Time in the Nether;
//       graves claimed and open, journals with tricky text, pranks, waystones, trails.
// fresh: round 1 in prep, nobody signed up: every empty state.

export const DAY = 86_400_000;
export const HOUR = 3_600_000;
export const MIN = 60_000;

export type OsFeatures = {
  /** GET /v2/onesoul/live */
  live: boolean;
  /** WE-12: rounds, soul detail, run stats, filters, pranks, player route */
  tracking: boolean;
  /** WE-13: trail, waystones, map */
  map: boolean;
  /** WE-10: scope=round:<server>/<cycle> and `standalone` on /v2/network */
  rounds_scope: boolean;
};

export type OsMockStat = { type: string; subject: string; value: number };

export type OsMockSoul = {
  cycle: number;
  turn: number;
  uuid: string;
  name: string;
  started_ago: number;
  ended_ago: number | null;
  cause: string | null;
  death: { dim: string; x: number; y: number; z: number } | null;
  damage_type: string | null;
  killer: string | null;
  reason: string | null;
  second_chance: string | null;
  sc_result: { outcome: string; offerings: number; added_ms: number; used_ms: number } | null;
  outcome: string;
  grave_id: string | null;
  journal: { title: string | null; pages: string[]; published_ago: number } | null;
  waited_ms: number | null;
  stats: OsMockStat[];
  /** trail: per dimension stay, points [ago, x, y, z] */
  trail: { dim: string; points: [number, number, number, number][] }[];
};

export type OsMockRound = { cycle: number; prep_started_ago: number; started_ago: number | null; ended_ago: number | null; seed: string | null; archive: string | null };

export type OsMockGrave = {
  id: string;
  cycle: number;
  turn: number;
  dim: string;
  x: number;
  y: number;
  z: number;
  items: number;
  created_ago: number;
  claimed_by: { uuid: string; name: string } | null;
  claimed_ago: number | null;
  contents: { item: string; count: number }[];
  marked: number;
};

export type OsMockReg = { round: number; uuid: string; name: string; registered_ago: number; played: boolean };
export type OsMockPrank = { cycle: number; uuid: string; name: string; day_ago: number; kind: string; count: number };
export type OsMockWaystone = {
  id: string;
  cycle: number;
  label: string | null;
  origin: string;
  dim: string;
  x: number;
  y: number;
  z: number;
  first_turn: number;
  first_ago: number;
  visits: number;
  removed_ago: number | null;
};

export type OneSoulWorld = {
  server: string;
  display_name: string;
  features: OsFeatures;
  cycle: number;
  state: string;
  /** prep or grace end, relative: negative = in the future */
  phase_ends_ago: number | null;
  current: { online: boolean; realm: string; phase: string; sc: { remaining_ms: number; paused: boolean; offerings: number; added_ms: number } | null } | null;
  spawn: { dim: string; x: number; y: number; z: number; set_turn: number; set_ago: number } | null;
  rounds: OsMockRound[];
  souls: OsMockSoul[];
  graves: OsMockGrave[];
  registrations: OsMockReg[];
  pranks: OsMockPrank[];
  waystones: OsMockWaystone[];
};

type Who = { uuid: string; name: string };

const OW = "minecraft:overworld";
const NE = "minecraft:the_nether";
const END = "minecraft:the_end";

/** deterministic noise in [0, 1) */
function noise(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runStats(r: () => number, hours: number): OsMockStat[] {
  const k = Math.max(0.2, hours);
  const v = (base: number) => Math.round(base * k * (0.6 + r() * 0.8));
  const rows: OsMockStat[] = [
    { type: "minecraft:mined", subject: "minecraft:stone", value: v(180) },
    { type: "minecraft:mined", subject: "minecraft:deepslate", value: v(90) },
    { type: "minecraft:mined", subject: "minecraft:oak_log", value: v(25) },
    { type: "minecraft:mined", subject: "minecraft:iron_ore", value: v(4) },
    { type: "minecraft:killed", subject: "minecraft:zombie", value: v(3) },
    { type: "minecraft:killed", subject: "minecraft:skeleton", value: v(2) },
    { type: "minecraft:custom", subject: "minecraft:walk_one_cm", value: v(250_000) },
    { type: "minecraft:custom", subject: "minecraft:jump", value: v(140) },
    { type: "cakeutils:entered_biome", subject: "minecraft:plains", value: 1 },
    { type: "cakeutils:entered_biome", subject: "minecraft:forest", value: 1 }
  ];
  if (hours > 6) rows.push({ type: "cakeutils:entered_biome", subject: "minecraft:cherry_grove", value: 1 });
  if (hours > 10) rows.push({ type: "cakeutils:entered_dimension", subject: NE, value: 1 }, { type: "minecraft:mined", subject: "minecraft:netherrack", value: v(60) });
  return rows.filter((x) => x.value > 0);
}

function trailOf(r: () => number, startAgo: number, endAgo: number, dims: string[], to: { x: number; z: number } | null): OsMockSoul["trail"] {
  const out: OsMockSoul["trail"] = [];
  const span = startAgo - endAgo;
  let x = 120;
  let z = -48;
  const per = Math.max(1, dims.length);
  dims.forEach((dim, di) => {
    const pts: [number, number, number, number][] = [];
    const n = 14 + Math.floor(r() * 10);
    const from = startAgo - (span * di) / per;
    const until = startAgo - (span * (di + 1)) / per;
    if (dim === NE) {
      x = Math.round(x / 8);
      z = Math.round(z / 8);
    }
    for (let i = 0; i < n; i++) {
      const ago = Math.round(from - ((from - until) * i) / (n - 1));
      x += Math.round((r() - 0.4) * 60);
      z += Math.round((r() - 0.55) * 60);
      if (i === n - 1 && di === dims.length - 1 && to) {
        x = to.x;
        z = to.z;
      }
      pts.push([ago, x, dim === NE ? 70 + Math.round(r() * 20) : 60 + Math.round(r() * 30), z]);
    }
    out.push({ dim, points: pts });
  });
  return out;
}

const JOURNAL_TRICKY = [
  "Day one.\nThe spawn is a birch forest. I built a dirt hut and nobody laughed, because nobody can.\n\nThe ghosts watch.",
  "",
  "Found iron. Lost iron. A creeper said hello.\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\n<script>alert('not a script')</script> & § is just a sign.",
  "Café, naïve, Ærøskøbing: accented letters too.\n1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15 (a page with more lines than a book holds)"
];

/** The busy One Soul world for the given players (the first nine sign up; order is the sign-up order, not the queue). */
export function generateOneSoulBusy(people: Who[]): OneSoulWorld {
  const r = noise(0x0501);
  const p = (i: number) => people[i % people.length];
  const souls: OsMockSoul[] = [];
  const graves: OsMockGrave[] = [];

  // round 1: 23 days ago .. 12 days ago, five souls, all over
  const r1Start = 23 * DAY;
  const r1End = 12 * DAY;
  const r1Order = [2, 5, 0, 7, 3];
  let t = r1Start - 2 * HOUR;
  const causes = [
    { cause: "%s was blown up by Creeper", dt: "minecraft:explosion", killer: "minecraft:creeper" },
    { cause: "%s fell from a high place", dt: "minecraft:fall", killer: null },
    { cause: "%s was slain by Zombie", dt: "minecraft:mob_attack", killer: "minecraft:zombie" },
    { cause: "%s burned to death", dt: "minecraft:on_fire", killer: null },
    { cause: "%s drowned", dt: "minecraft:drown", killer: null },
    { cause: "%s was shot by Skeleton", dt: "minecraft:arrow", killer: "minecraft:skeleton" }
  ];
  r1Order.forEach((pi, i) => {
    const who = p(pi);
    const last = i === r1Order.length - 1;
    const dur = last ? t - r1End : Math.round((0.6 + r() * 3.5) * DAY * (i === 1 ? 0.15 : 1));
    const end = Math.max(r1End, t - dur);
    const c = causes[(i * 2) % causes.length];
    const dim = i === 3 ? NE : OW;
    const pos = { dim, x: Math.round((r() - 0.5) * 2400), y: 30 + Math.round(r() * 40), z: Math.round((r() - 0.5) * 2400) };
    const hours = (t - end) / HOUR;
    const outcome = last ? "round_ended" : i === 1 ? "skipped" : "died";
    const gid = outcome === "died" ? `g-1-${i + 1}` : null;
    souls.push({
      cycle: 1,
      turn: i + 1,
      uuid: who.uuid,
      name: who.name,
      started_ago: t,
      ended_ago: end,
      cause: outcome === "died" ? c.cause.replace("%s", who.name) : null,
      death: outcome === "died" ? pos : null,
      damage_type: outcome === "died" ? c.dt : null,
      killer: outcome === "died" ? c.killer : null,
      reason: outcome === "skipped" ? "absence" : null,
      second_chance: i === 2 ? "borrowed_time" : null,
      sc_result: i === 2 ? { outcome: "expired", offerings: 3, added_ms: 54 * MIN, used_ms: 114 * MIN } : null,
      outcome,
      grave_id: gid,
      journal:
        outcome === "died" || last
          ? { title: i === 0 ? "The first soul" : null, pages: i === 0 ? JOURNAL_TRICKY : [`Turn ${i + 1}.\nI did my best.`, "The end came quickly."], published_ago: end - MIN }
          : null,
      waited_ms: Math.round((i + 1) * 3 * HOUR + r() * HOUR),
      stats: runStats(r, hours),
      trail: trailOf(r, t, end, dim === NE ? [OW, NE] : [OW], { x: pos.x, z: pos.z })
    });
    if (gid) {
      const claimed = i !== 3;
      graves.push({
        id: gid,
        cycle: 1,
        turn: i + 1,
        ...pos,
        items: 12 + Math.floor(r() * 24),
        created_ago: end,
        claimed_by: claimed ? p(pi + 3) : null,
        claimed_ago: claimed ? end - Math.round((0.5 + r() * 20) * HOUR) : null,
        contents: [
          { item: "minecraft:cobblestone", count: 64 },
          { item: "minecraft:iron_ingot", count: 9 },
          { item: "minecraft:bread", count: 7 },
          { item: "minecraft:diamond_pickaxe", count: 1 }
        ],
        marked: i === 0 ? 1 : 0
      });
    }
    t = end - 10 * MIN;
  });

  // round 2: prep 10.5 days ago (3 days), world since 7.5 days ago; three souls ended, the fourth plays
  const r2Prep = 10.5 * DAY;
  const r2Start = 7.5 * DAY;
  const r2Order = [1, 6, 8, 0];
  t = r2Start - HOUR;
  r2Order.forEach((pi, i) => {
    const who = p(pi);
    const playing = i === r2Order.length - 1;
    const dur = playing ? 0 : Math.round((0.4 + r() * 1.6) * DAY);
    const end = playing ? null : t - dur;
    const c = causes[(i * 3 + 1) % causes.length];
    const dim = i === 2 ? END : OW;
    const pos = { dim, x: Math.round((r() - 0.5) * 1800), y: 40 + Math.round(r() * 30), z: Math.round((r() - 0.5) * 1800) };
    const hours = ((end === null ? 0 : t - end) || t) / HOUR;
    const outcome = playing ? "playing" : "died";
    const gid = outcome === "died" ? `g-2-${i + 1}` : null;
    souls.push({
      cycle: 2,
      turn: i + 1,
      uuid: who.uuid,
      name: who.name,
      started_ago: t,
      ended_ago: end,
      cause: playing ? null : c.cause.replace("%s", who.name),
      death: playing ? null : pos,
      damage_type: playing ? null : c.dt,
      killer: playing ? null : c.killer,
      reason: null,
      second_chance: playing ? "borrowed_time" : null,
      sc_result: null,
      outcome,
      grave_id: gid,
      journal: playing ? { title: "Do not read", pages: ["A living soul's journal: never served."], published_ago: 0 } : i === 1 ? null : { title: `${who.name}'s notes`, pages: ["Round two.\n\nThe nether is loud.", "If you find my grave, take the bread.", "Ελληνικά, русский, 日本語のページ.\n\u0007Bell and\ttab dropped.", ""], published_ago: (end ?? 0) - MIN },
      waited_ms: playing ? null : Math.round((i + 2) * 5 * HOUR),
      stats: runStats(r, playing ? t / HOUR : hours),
      trail: trailOf(r, t, end ?? 0, playing ? [OW, NE] : dim === END ? [OW, END] : [OW], playing ? null : { x: pos.x, z: pos.z })
    });
    if (gid) {
      const claimed = i === 0;
      graves.push({
        id: gid,
        cycle: 2,
        turn: i + 1,
        ...pos,
        items: 8 + Math.floor(r() * 30),
        created_ago: end!,
        claimed_by: claimed ? p(pi + 2) : null,
        claimed_ago: claimed ? end! - 3 * HOUR : null,
        contents: [
          { item: "minecraft:netherrack", count: 48 },
          { item: "minecraft:golden_apple", count: 2 },
          { item: "minecraft:iron_sword", count: 1 }
        ],
        marked: 0
      });
    }
    if (!playing) t = end! - 15 * MIN;
  });

  const registrations: OsMockReg[] = [];
  const reg1 = [0, 2, 3, 5, 7, 4];
  reg1.forEach((pi, i) => registrations.push({ round: 1, ...p(pi), registered_ago: 26 * DAY - i * 7 * HOUR, played: r1Order.includes(pi) }));
  const reg2 = [0, 1, 2, 3, 5, 6, 8, 9, 10];
  reg2.forEach((pi, i) => registrations.push({ round: 2, ...p(pi), registered_ago: r2Prep - i * 5 * HOUR - HOUR, played: r2Order.includes(pi) }));

  const pranks: OsMockPrank[] = [];
  const kinds = ["creeper_hiss", "door_knock", "torch_flicker", "footsteps"];
  for (const cycle of [1, 2]) {
    for (let g = 0; g < 4; g++) {
      const who = p(g + 3);
      for (let d = 0; d < 4; d++) {
        const dayAgo = (cycle === 1 ? 20 : 6) * DAY - d * DAY;
        pranks.push({ cycle, ...who, day_ago: Math.floor(dayAgo / DAY) * DAY, kind: kinds[(g + d) % 4], count: 1 + Math.floor(r() * 9) });
      }
    }
  }

  const waystones: OsMockWaystone[] = [
    { id: "w-1", cycle: 2, label: "Home <3", origin: "player", dim: OW, x: 130, y: 66, z: -40, first_turn: 1, first_ago: 7 * DAY, visits: 14, removed_ago: null },
    { id: "w-2", cycle: 2, label: "Plains Village", origin: "village", dim: OW, x: 640, y: 70, z: 210, first_turn: 2, first_ago: 5 * DAY, visits: 5, removed_ago: null },
    { id: "w-3", cycle: 2, label: null, origin: "wilderness", dim: NE, x: -40, y: 80, z: 18, first_turn: 4, first_ago: 20 * HOUR, visits: 2, removed_ago: null },
    { id: "w-4", cycle: 1, label: "Old base", origin: "player", dim: OW, x: -300, y: 64, z: 500, first_turn: 1, first_ago: 22 * DAY, visits: 9, removed_ago: 12 * DAY }
  ];

  return {
    server: "onesoul",
    display_name: "One Soul at a Time",
    features: { live: true, tracking: true, map: true, rounds_scope: true },
    cycle: 2,
    state: "running",
    phase_ends_ago: null,
    current: { online: true, realm: "nether", phase: "second_chance", sc: { remaining_ms: 45 * MIN, paused: false, offerings: 2, added_ms: 21 * MIN } },
    spawn: { dim: OW, x: 120, y: 64, z: -48, set_turn: 2, set_ago: 5 * DAY },
    rounds: [
      { cycle: 1, prep_started_ago: 26 * DAY, started_ago: r1Start, ended_ago: r1End, seed: "-4172144997902289642", archive: "world-round-1" },
      { cycle: 2, prep_started_ago: r2Prep, started_ago: r2Start, ended_ago: null, seed: null, archive: null }
    ],
    souls,
    graves,
    registrations,
    pranks,
    waystones
  };
}

/** The fresh One Soul world: round 1 in prep for two more days, nobody signed up yet. */
export function generateOneSoulFresh(): OneSoulWorld {
  return {
    server: "onesoul",
    display_name: "One Soul at a Time",
    features: { live: true, tracking: true, map: true, rounds_scope: true },
    cycle: 1,
    state: "prep",
    phase_ends_ago: -2 * DAY,
    current: null,
    spawn: null,
    rounds: [{ cycle: 1, prep_started_ago: DAY, started_ago: null, ended_ago: null, seed: null, archive: null }],
    souls: [],
    graves: [],
    registrations: [],
    pranks: [],
    waystones: []
  };
}
