// The guide snapshot of the mock (GET /v2/onesoul/guide), built the way the mod builds it (cakeutils
// CONTRACTS.md §11.3): the shipped guide text (`guide-source.json`, a copy of the mod's
// data/onesoul/guide/guide.json, TH-27), the running config's numbers as display text (the same wording as
// the mod's ValueText: percentages, units, durations in words with in-game days), the item names and the
// recipes. The numbers here are the mod's defaults, in one table; the site never holds a number of its own.
import type { Guide, GuideRecipe, GuideValue } from "#lib/onesoul/guide/types.ts";
import source from "./guide-source.json" with { type: "json" };

type Raw = string | number | boolean | string[];

/** The mod's defaults for every config key the guide texts name (config/onesoul/onesoul.json). */
export const DEFAULTS: Record<string, Raw> = {
  "prep.duration": "3d",
  "prep.extend-when-empty": "1d",
  "prep.min-souls": 1,
  "grace.duration": "48h",
  "absence-timeout": "72h",
  "on-absence": "skip",
  "spawn.cooldown": "10m",
  "spawn.allowed-dimensions": ["minecraft:overworld", "minecraft:the_nether", "minecraft:the_end"],
  "elytra.boost-dimensions": ["minecraft:the_end"],
  "waystones.beams.max-distance": 256,
  "pranks.budget.capacity": 10,
  "pranks.mute.minutes": 30,
  "pranks.mute.once-per-hours": 24,
  "pranks.safety.low-health-hearts": 4,
  "pranks.safety.hurt-window-seconds": 10,
  "pranks.safety.fall-blocks": 3.0,
  "pranks.haunt.duration-seconds": 180,
  "pranks.haunt.max-distance": 48,
  "second-chance.borrowed-time.duration": "60m",
  "second-chance.borrowed-time.max-hearts": 1.0,
  "second-chance.borrowed-time.heartbeat-below": "5m",
  "second-chance.borrowed-time.max-added": "2d",
  "second-chance.borrowed-time.offerings.echo-shard": 120,
  "second-chance.borrowed-time.offerings.totem": 360,
  "second-chance.borrowed-time.offerings.void-shard": 60,
  "second-chance.borrowed-time.offerings.per-enchantment-level": 12,
  "second-chance.borrowed-time.offerings.mark-of-love-multiplier": 2,
  "second-chance.borrowed-time.offerings.repeat-factor": 0.8,
  "thresholds.nether.coordinate-scale": 1.0,
  "thresholds.nether.rift.stable-after": "1h",
  "thresholds.nether.rift.fragile-until": 0.25,
  "thresholds.nether.rift.steadying-from": 0.75,
  "thresholds.nether.rift.slow": "10m",
  "thresholds.nether.rift.setback": 0.25,
  "thresholds.nether.rift.throw-radius": 300,
  "thresholds.nether.leak.interval": "10m",
  "thresholds.nether.leak.chance": 0.5,
  "thresholds.nether.leak.magma-cube-chance": 0.1,
  "thresholds.nether.heat.full-after": "4m",
  "thresholds.nether.heat.cool-after": "10s",
  "thresholds.nether.heat.damage": 0.5,
  "thresholds.nether.heat.damage-interval": "4s",
  "thresholds.nether.heat.hunger-per-second": 0.1,
  "thresholds.nether.heat.immune-fire-protection": 16,
  "thresholds.nether.heat.min-health": 1.0,
  "thresholds.nether.heat.stable-crossing-bonus": "20m",
  "thresholds.end.stronghold.distance": 128,
  "thresholds.end.eye.sense-range": 1500,
  "thresholds.end.disorient.radius": 48,
  "thresholds.end.disorient.interval-min": "8s",
  "thresholds.end.disorient.interval-max": "15s",
  "thresholds.end.disorient.distance-min": 2,
  "thresholds.end.disorient.distance-max": 6,
  "thresholds.end.anchor.durability": 120,
  "thresholds.end.anchor.repair-per-shard": 30,
  "thresholds.end.tear.shards-min": 1,
  "thresholds.end.tear.shards-max": 3,
  "thresholds.end.tear.endermites": 2,
  "thresholds.end.tear.endermen-from-eye": 6,
  "thresholds.end.tear.endermen": 1,
  "thresholds.end.tear.room-push": 4.0,
  "thresholds.end.void-weighted.shards": 2,
  "thresholds.end.void-weighted.share": 0.25,
  "thresholds.end.arrival.min-distance": 70,
  "thresholds.end.arrival.max-distance": 100,
  "thresholds.end.shockwave.interval-min": "40s",
  "thresholds.end.shockwave.interval-max": "1m30s",
  "thresholds.end.shockwave.warning": "3s",
  "thresholds.end.shockwave.max-push": 24.0,
  "thresholds.end.shockwave.full-score": 28.0
};

const SHARES = new Set(["share", "chance", "magma-cube-chance", "fragile-until", "steadying-from", "setback"]);
const BLOCKS = new Set(["throw-radius", "sense-range", "radius", "distance-min", "distance-max", "min-distance", "max-distance", "max-push", "room-push"]);
const HEARTS = new Set(["damage", "min-health"]);

const plain = (n: number): string => String(Math.round(n * 1e6) / 1e6);

function seconds(s: string): number | null {
  const m = /^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(s);
  if (!m || !s) return null;
  return (Number(m[1] ?? 0) * 86400) + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
}

function words(total: number, gameTime: boolean): string {
  const parts: string[] = [];
  const add = (n: number, u: string) => n > 0 && parts.push(`${n} ${u}${n === 1 ? "" : "s"}`);
  add(Math.floor(total / 86400), "day");
  add(Math.floor((total % 86400) / 3600), "hour");
  add(Math.floor((total % 3600) / 60), "minute");
  add(total % 60, "second");
  let text = parts.slice(0, 2).join(" ");
  const ticks = total * 20;
  if (gameTime && ticks >= 24000) {
    const n = plain(Math.round((ticks * 10) / 24000) / 10);
    text += ` (${n} in-game ${n === "1" ? "day" : "days"})`;
  }
  return text;
}

/** The reader's text of one config value (the mod's ValueText, CONTRACTS §11.3). */
export function valueText(key: string, v: Raw): string {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "on" : "off";
  const last = key.slice(key.lastIndexOf(".") + 1);
  if (typeof v === "number") {
    if (SHARES.has(last)) return `${plain(v * 100)} %`;
    if (last === "distance" && key.includes("stronghold")) return `${plain(v)} ${v === 1 ? "chunk" : "chunks"}`;
    if (BLOCKS.has(last)) return `${plain(v)} ${v === 1 ? "block" : "blocks"}`;
    if (HEARTS.has(last) && key.startsWith("thresholds.")) return `${plain(v)} ${v === 1 ? "heart" : "hearts"}`;
    return plain(v);
  }
  const s = seconds(v);
  return s !== null ? words(s, key.startsWith("thresholds.")) : v;
}

const rawText = (v: Raw): string | null => (Array.isArray(v) ? null : String(v));

const NAMES: Record<string, string> = {
  "onesoul:void_shard": "Void Shard",
  "onesoul:void_anchor": "Void Anchor",
  "onesoul:gravestone": "Gravestone",
  "minecraft:obsidian": "Obsidian",
  "minecraft:ender_eye": "Eye of Ender",
  "minecraft:diamond_chestplate": "Diamond Chestplate"
};

const R = (slot: number, item: string, count = 1, name: string | null = null) => ({ slot, item, count, name });

/**
 * The recipes the mod describes (cakeutils GuideRecipes): the Void Anchor's is read from its datapack file
 * (`data/onesoul/recipe/void_anchor.json`, pattern OSO / SES / OSO), the repair and the Void-weighted mark's are
 * described in code with the wording below.
 */
export function recipes(shards = Number(DEFAULTS["thresholds.end.void-weighted.shards"])): GuideRecipe[] {
  const S = "onesoul:void_shard";
  const O = "minecraft:obsidian";
  return [
    {
      id: "void-anchor",
      type: "crafting",
      shapeless: false,
      slots: [R(0, O), R(1, S), R(2, O), R(3, S), R(4, "minecraft:ender_eye"), R(5, S), R(6, O), R(7, S), R(8, O)],
      result: { item: "onesoul:void_anchor", count: 1, name: null },
      note: null
    },
    {
      id: "void-anchor-repair",
      type: "anvil",
      shapeless: false,
      slots: [R(0, "onesoul:void_anchor", 1, "A damaged Void Anchor"), R(1, S, 1)],
      result: { item: "onesoul:void_anchor", count: 1, name: "The repaired Void Anchor" },
      note: "Each void shard restores {thresholds.end.anchor.repair-per-shard} durability."
    },
    {
      id: "void-weighted",
      type: "anvil",
      shapeless: false,
      slots: [R(0, "minecraft:diamond_chestplate", 1, "Any armour piece"), R(1, S, shards)],
      result: { item: "minecraft:diamond_chestplate", count: 1, name: "The same piece, void-weighted" },
      note: null
    }
  ];
}

/** The snapshot the proxy serves, `received_at` = `now`. */
export function buildGuide(server: string, now: number): Guide {
  const keys = new Set<string>();
  const scan = (t: string) => [...t.matchAll(/\{([a-z0-9_.:/-]+)\}/g)].forEach((m) => keys.add(m[1]));
  const rs = recipes();
  for (const e of source.entries) {
    e.body.forEach(scan);
    (e.facts ?? []).forEach((f) => scan(f.text));
  }
  rs.forEach((r) => r.note && scan(r.note));
  const values: GuideValue[] = [...keys].sort().map((key) => {
    // derived by the mod: minutes of Borrowed Time one shard buys at a first burn
    if (key === "onesoul.offerings.void-shard") return { key, text: `${DEFAULTS["second-chance.borrowed-time.offerings.void-shard"]} minutes`, raw: null };
    const v = DEFAULTS[key];
    return v === undefined ? { key, text: key, raw: null } : { key, text: valueText(key, v), raw: rawText(v) };
  });
  const ids = new Set<string>();
  for (const e of source.entries) if ((e as { item?: string }).item) ids.add((e as { item?: string }).item!);
  for (const r of rs) {
    ids.add(r.result.item);
    r.slots.forEach((s) => ids.add(s.item));
  }
  return {
    server,
    received_at: now - 4 * 60_000,
    schema: 1,
    mod_version: "1.4.0",
    sections: source.sections,
    entries: source.entries.map((e) => ({ id: e.id, section: e.section, title: e.title, body: e.body, facts: e.facts ?? [], item: (e as { item?: string }).item ?? null, recipes: (e as { recipes?: string[] }).recipes ?? [] })),
    items: [...ids].sort().map((id) => ({ id, name: NAMES[id] ?? id })),
    recipes: rs,
    values
  };
}
