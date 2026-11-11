// Series for the One Soul charts (WEBSITE-BRIEF §7), built from the souls, graves, sign-ups and events
// lists. Counts are made inside one list and one round (or across rounds of the one One Soul server);
// nothing adds figures from different scopes. The living soul has no duration yet and is left out.
import { life, titleId } from "./format.ts";
import { osHref } from "./links.ts";
import type { Grave, OsEvent, Registration, Soul } from "./types.ts";

export type Cat = { key: string; label: string; v: number; display?: string; href?: string };
export type Row = { rank: number; key: string; label: string; v: number; display: string; href?: string; uuid?: string };
const DAY = 86_400_000;

export const finished = (s: Soul) => s.outcome !== "playing" && s.duration_ms !== null;

export function survivalPerSoul(souls: Soul[], allRounds: boolean): { points: Cat[]; record: string | null } {
  const done = souls.filter(finished).sort((a, b) => a.cycle - b.cycle || a.turn - b.turn);
  const best = done.reduce<Soul | null>((a, s) => (!a || s.duration_ms! > a.duration_ms! ? s : a), null);
  return {
    points: done.map((s) => ({ key: `${s.cycle}/${s.turn}`, label: allRounds ? `${s.name} (R${s.cycle})` : s.name, v: s.duration_ms!, display: life(s.duration_ms), href: osHref.soul(s.cycle, s.turn) })),
    record: best ? `${best.cycle}/${best.turn}` : null
  };
}

export type RoundAgg = { cycle: number; souls: number; total: number; longest: number };
export function perRound(souls: Soul[]): RoundAgg[] {
  const by = new Map<number, RoundAgg>();
  for (const s of souls) {
    const a = by.get(s.cycle) ?? { cycle: s.cycle, souls: 0, total: 0, longest: 0 };
    a.souls += 1;
    if (finished(s)) {
      a.total += s.duration_ms!;
      a.longest = Math.max(a.longest, s.duration_ms!);
    }
    by.set(s.cycle, a);
  }
  return [...by.values()].sort((a, b) => a.cycle - b.cycle);
}

/** Cumulative sign-ups as a step line: one point per sign-up, counts only (never who). */
export function signupsOverTime(regs: Registration[]): { t: number; v: number }[] {
  const ts = regs.map((r) => r.registered_at).filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
  return ts.map((t, i) => ({ t, v: i + 1 }));
}

/** Final deaths per UTC day, every day from the first to the last. */
export function deathsPerDay(souls: Soul[]): { t: number; v: number }[] {
  const days = souls.filter((s) => s.outcome === "died" && s.ended_at !== null).map((s) => Math.floor(s.ended_at! / DAY) * DAY);
  if (!days.length) return [];
  const lo = Math.min(...days), hi = Math.max(...days);
  const out: { t: number; v: number }[] = [];
  for (let t = lo; t <= hi; t += DAY) out.push({ t, v: days.filter((d) => d === t).length });
  return out;
}

const CAUSE_TYPES: Record<string, string> = {
  fall: "Fell", drown: "Drowned", lava: "Lava", in_fire: "Fire", on_fire: "Fire", campfire: "Fire", hot_floor: "Fire",
  explosion: "Explosion", player_explosion: "Explosion", fireworks: "Explosion", mob_attack: "Killed by a mob",
  mob_attack_no_aggro: "Killed by a mob", mob_projectile: "Killed by a mob", arrow: "Shot", trident: "Shot",
  player_attack: "Killed by a player", starve: "Starved", in_wall: "Suffocated", freeze: "Froze", magic: "Magic",
  indirect_magic: "Magic", wither: "Withered", out_of_world: "Fell out of the world", sonic_boom: "Warden",
  lightning_bolt: "Lightning", cactus: "Pricked", sweet_berry_bush: "Pricked", fly_into_wall: "Flew into a wall", cramming: "Squashed"
};
const CAUSE_TEXT: [RegExp, string][] = [
  [/fell|hit the ground|doomed to fall/i, "Fell"], [/drown/i, "Drowned"], [/lava/i, "Lava"], [/burn|flames|fire/i, "Fire"],
  [/blew up|blown up|explo/i, "Explosion"], [/shot/i, "Shot"], [/slain by|killed by|was killed/i, "Killed by a mob"],
  [/starv/i, "Starved"], [/suffocat|squash|squish/i, "Suffocated"], [/froze/i, "Froze"], [/wither/i, "Withered"],
  [/out of the world|left the confines/i, "Fell out of the world"], [/pricked|poked|stung/i, "Pricked"], [/magic/i, "Magic"]
];

/** A death's group: from the structured damage type where there is one, else a simple pattern; unknown → Other. */
export function causeGroup(s: Soul): string {
  const dt = s.death?.damage_type;
  if (dt) {
    const k = dt.includes(":") ? dt.slice(dt.indexOf(":") + 1) : dt;
    return CAUSE_TYPES[k] ?? titleId(k);
  }
  for (const [re, g] of CAUSE_TEXT) if (s.cause && re.test(s.cause)) return g;
  return "Other";
}

export function causes(souls: Soul[]): Row[] {
  const by = new Map<string, number>();
  for (const s of souls) if (s.outcome === "died") by.set(causeGroup(s), (by.get(causeGroup(s)) ?? 0) + 1);
  return [...by.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, v], i) => ({ rank: i + 1, key: k, label: k, v, display: String(v) }));
}

export function graveStatus(graves: Grave[]): Row[] {
  const claimed = graves.filter((g) => g.claimed_by).length;
  return [
    { rank: 1, key: "claimed", label: "Claimed", v: claimed, display: String(claimed) },
    { rank: 2, key: "open", label: "Still open", v: graves.length - claimed, display: String(graves.length - claimed) }
  ];
}

const BUCKETS: [number, string][] = [[10 * 60_000, "under 10 min"], [3_600_000, "10 min to 1 h"], [6 * 3_600_000, "1 to 6 h"], [DAY, "6 h to 1 d"], [Infinity, "over 1 d"]];
export function timeToClaim(graves: Grave[]): Cat[] {
  const n = BUCKETS.map(() => 0);
  for (const g of graves) {
    if (g.claimed_at === null || !g.claimed_by) continue;
    const d = g.claimed_at - g.created_at;
    n[BUCKETS.findIndex(([lim]) => d < lim)] += 1;
  }
  return BUCKETS.map(([, label], i) => ({ key: String(i), label, v: n[i] }));
}

export function secondChances(souls: Soul[]): Row[] {
  const ended = souls.filter((s) => s.outcome !== "playing");
  const by = new Map<string, number>();
  for (const s of ended) {
    const k = !s.second_chance ? "No second chance" : s.second_chance_result ? `Second chance, ${s.second_chance_result.outcome === "redeemed" ? "survived it" : s.second_chance_result.outcome === "expired" ? "ran out of time" : s.second_chance_result.outcome === "died" ? "died on it" : titleId(s.second_chance_result.outcome).toLowerCase()}` : "Had a second chance";
    by.set(k, (by.get(k) ?? 0) + 1);
  }
  return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([k, v], i) => ({ rank: i + 1, key: k, label: k, v, display: String(v) }));
}

/** Ghosts by day from `prank` timeline rows (count per day); finished rounds only. */
export function prankHeatmap(events: OsEvent[]): { rows: { label: string; cells: (number | null)[] }[]; columns: string[] } {
  const pr = events.filter((e) => e.kind === "prank" && e.name);
  if (!pr.length) return { rows: [], columns: [] };
  const days = pr.map((e) => Math.floor(e.at / DAY) * DAY);
  const lo = Math.min(...days), hi = Math.max(...days);
  const cols: number[] = [];
  for (let t = lo; t <= hi; t += DAY) cols.push(t);
  const by = new Map<string, number[]>();
  for (const e of pr) {
    const row = by.get(e.name!) ?? cols.map(() => 0);
    const c = typeof e.data?.count === "number" ? (e.data.count as number) : 1;
    row[cols.indexOf(Math.floor(e.at / DAY) * DAY)] += c;
    by.set(e.name!, row);
  }
  const fmt = (t: number) => { const d = new Date(t); return `${d.getUTCDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()]}`; };
  return {
    rows: [...by.entries()].sort((a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0)).map(([label, cells]) => ({ label, cells })),
    columns: cols.map(fmt)
  };
}
