// The mock's world model (PLAN §3.2): everything the fixture handler derives its answers from.
// Two scenarios: `fresh` (a network nobody has played on) and `busy` (realistic data across servers
// and a mini-server). The busy world is generated deterministically by `generateBusy()` and
// committed as fixtures/busy.json so reviewers see stable data (bun run fixtures).
//
// Times are stored as offsets before "now" (`*_ago_ms`) so fixtures never go stale.
// Stat values are stored per LEAF scope only (a server's own play, each mini's play); the handler
// rolls them up mini → server → network exactly like cakeutils does (I3), so no scope is ever a
// sum of another one in the fixture itself.
import type { Kind, Segment, StatType, Unit } from "#lib/api/types.ts";
import { generateOneSoulBusy, generateOneSoulFresh, type OneSoulWorld } from "../../onesoul/mock/world.ts";

export type Scenario = "fresh" | "busy";

export type WorldServer = {
  id: string;
  display_name: string;
  /** null while the backend is not linked (mc_version/platform null, nobody online) */
  mc_version: string | null;
  platform: string | null;
  /** players waiting in cakelimbo for this server */
  waiting: number;
};

export type WorldMini = {
  id: string;
  display_name: string;
  server: string;
  /** a private mini answers like a never-seen scope and is left out of by_mini (D-68) */
  public: boolean;
};

export type WorldSubject = {
  key: string;
  kind: Kind | null;
  name: string | null;
  unit: Unit;
  /** sha256 of the icon PNG, served at /v2/icons/<sha>.png, or null */
  icon: string | null;
};

export type WorldPlayer = {
  uuid: string;
  /** a player row created from a stat before login has the UUID as its name */
  name: string;
  first_seen_ago_ms: number;
  last_seen_ago_ms: number;
  online: boolean;
  /** server id while online */
  server: string | null;
  /** "<server>/<mini>" while inside a mini-server */
  mini: string | null;
  skin: string | null;
  prefix: Segment[];
  suffix: Segment[];
  playtime: {
    /** per server, mini time included (I3) */
    by_server: Record<string, number>;
    /** per "<server>/<mini>" */
    by_mini: Record<string, number>;
    /** time between servers: counts for the network only */
    between_ms: number;
    /** per One Soul round "<server>/<cycle>" (inside that server's time, a breakdown) */
    by_round?: Record<string, number>;
  };
  /** leaf scope ("server:<id>" own play, "mini:<server>/<mini>", or "round:<server>/<cycle>" for One Soul) → "<type>|<subject>" → value */
  stats: Record<string, Record<string, number>>;
  /**
   * advancements completed, per server id → advancement id → how long ago (D-111). Server scopes only:
   * cakeutils keeps nothing per mini-server. Absent on players from before the field existed.
   */
  advancements?: Record<string, Record<string, number>>;
};

export type WorldAdvancement = {
  /** namespaced id, e.g. minecraft:story/mine_diamond */
  id: string;
  /** the English title the backend reports */
  title: string;
};

export type World = {
  scenario: Scenario;
  /** One Soul at a Time (cakeutils /v2/onesoul*); absent = a proxy without it */
  onesoul?: OneSoulWorld;
  /**
   * servers cakeutils keeps out of the network scope and marks `standalone` on /v2/network (API-EXPANSION
   * M1); absent = an older proxy that rolls every server up and has no flag
   */
  standalone?: string[];
  /** whether /v2/milestones exists on this proxy (false = older proxy, 404) */
  milestones: boolean;
  /** milestone tracking began this long ago; rows reached earlier are backfilled */
  milestones_since_ago_ms: number;
  /** whether /v2/milestones/advancements exists on this proxy (D-111; false = a proxy without it, 404) */
  advancements: boolean;
  /** live advancement tracking began this long ago; completions before it are known only from the import */
  advancements_since_ago_ms: number;
  /** servers whose operator ran `cakectl advancements import`: their older completions exist, flagged imported */
  advancements_imported: string[];
  /** the advancements anyone has completed: id → title (the registry the backends reported) */
  advancement_titles: WorldAdvancement[];
  servers: WorldServer[];
  minis: WorldMini[];
  types: StatType[];
  subjects: WorldSubject[];
  players: WorldPlayer[];
};

// ---- deterministic helpers

export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hex(seed: string, len: number): string {
  let out = "";
  let i = 0;
  while (out.length < len) {
    out += fnv1a(`${seed}#${i++}`).toString(16).padStart(8, "0");
  }
  return out.slice(0, len);
}

/** A dashed, v4-looking UUID from a seed. */
export function uuidOf(seed: string): string {
  const h = hex(`uuid:${seed}`, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const DAY = 86_400_000;
export const HOUR = 3_600_000;
export const MIN = 60_000;

// ---- the catalogue every busy stat is drawn from

// the game's own English names, as cakeutils sends them (stats-screen templates included)
export const VANILLA_TYPES: StatType[] = [
  { key: "minecraft:mined", name: "Times Mined", kind: "block" },
  { key: "minecraft:used", name: "Times Used", kind: "item" },
  { key: "minecraft:crafted", name: "Times Crafted", kind: "item" },
  { key: "minecraft:broken", name: "Times Broken", kind: "item" },
  { key: "minecraft:picked_up", name: "Picked Up", kind: "item" },
  { key: "minecraft:dropped", name: "Dropped", kind: "item" },
  { key: "minecraft:killed", name: "You killed %s %s", kind: "entity" },
  { key: "minecraft:killed_by", name: "%s killed you %s time(s)", kind: "entity" },
  { key: "minecraft:custom", name: "Custom", kind: "custom" }
];

type Def = { key: string; kind: Kind | null; name: string | null; unit?: Unit; icon?: boolean; base: number };

const BLOCKS: Def[] = [
  { key: "minecraft:stone", kind: "block", name: "Stone", base: 60_000 },
  { key: "minecraft:cobblestone", kind: "block", name: "Cobblestone", base: 9_000 },
  { key: "minecraft:dirt", kind: "block", name: "Dirt", base: 12_000 },
  { key: "minecraft:grass_block", kind: "block", name: "Grass Block", base: 4_000 },
  { key: "minecraft:oak_log", kind: "block", name: "Oak Log", base: 3_000 },
  { key: "minecraft:spruce_log", kind: "block", name: "Spruce Log", base: 2_200 },
  { key: "minecraft:deepslate", kind: "block", name: "Deepslate", base: 40_000 },
  { key: "minecraft:diamond_ore", kind: "block", name: "Diamond Ore", base: 120 },
  { key: "minecraft:iron_ore", kind: "block", name: "Iron Ore", base: 1_500 },
  { key: "minecraft:coal_ore", kind: "block", name: "Coal Ore", base: 2_500 },
  { key: "minecraft:sand", kind: "block", name: "Sand", base: 5_000 },
  { key: "minecraft:gravel", kind: "block", name: "Gravel", base: 2_800 },
  { key: "minecraft:netherrack", kind: "block", name: "Netherrack", base: 15_000 },
  { key: "minecraft:obsidian", kind: "block", name: "Obsidian", base: 90 },
  { key: "minecraft:andesite", kind: "block", name: "Andesite", base: 7_000 },
  // seen before its definition arrived: no kind, no name, no icon (PLAN §2.2)
  { key: "farmersdelight:rich_soil", kind: null, name: null, icon: false, base: 400 }
];

const ITEMS: Def[] = [
  { key: "minecraft:diamond_pickaxe", kind: "item", name: "Diamond Pickaxe", base: 40 },
  { key: "minecraft:iron_pickaxe", kind: "item", name: "Iron Pickaxe", base: 60 },
  { key: "minecraft:bread", kind: "item", name: "Bread", base: 900 },
  { key: "minecraft:cooked_beef", kind: "item", name: "Steak", base: 700 },
  { key: "minecraft:torch", kind: "item", name: "Torch", base: 6_000 },
  { key: "minecraft:oak_planks", kind: "item", name: "Oak Planks", base: 8_000 },
  { key: "minecraft:stick", kind: "item", name: "Stick", base: 3_000 },
  { key: "minecraft:crafting_table", kind: "item", name: "Crafting Table", base: 30 },
  { key: "minecraft:cod", kind: "item", name: "Raw Cod", base: 500 },
  { key: "minecraft:fishing_rod", kind: "item", name: "Fishing Rod", base: 25 },
  { key: "minecraft:bow", kind: "item", name: "Bow", base: 20 },
  { key: "minecraft:arrow", kind: "item", name: "Arrow", base: 2_000 },
  { key: "minecraft:diamond_sword", kind: "item", name: "Diamond Sword", base: 15 },
  { key: "minecraft:shield", kind: "item", name: "Shield", base: 12 },
  { key: "minecraft:iron_ingot", kind: "item", name: "Iron Ingot", base: 2_500 },
  { key: "minecraft:ender_pearl", kind: "item", name: "Ender Pearl", base: 150 }
];

const ENTITIES: Def[] = [
  { key: "minecraft:zombie", kind: "entity", name: "Zombie", base: 800 },
  { key: "minecraft:skeleton", kind: "entity", name: "Skeleton", base: 600 },
  { key: "minecraft:creeper", kind: "entity", name: "Creeper", base: 400 },
  { key: "minecraft:cod", kind: "entity", name: "Cod", base: 300 },
  { key: "minecraft:cow", kind: "entity", name: "Cow", base: 500 },
  { key: "minecraft:pig", kind: "entity", name: "Pig", base: 350 },
  { key: "minecraft:sheep", kind: "entity", name: "Sheep", base: 400 },
  { key: "minecraft:enderman", kind: "entity", name: "Enderman", base: 120 },
  { key: "minecraft:spider", kind: "entity", name: "Spider", base: 450 },
  { key: "minecraft:drowned", kind: "entity", name: "Drowned", base: 200 },
  // no spawn egg: no icon
  { key: "minecraft:iron_golem", kind: "entity", name: "Iron Golem", icon: false, base: 6 }
];

const CUSTOM: Def[] = [
  { key: "minecraft:walk_one_cm", kind: "custom", name: "Distance Walked", unit: "distance_cm", icon: false, base: 30_000_000 },
  { key: "minecraft:sprint_one_cm", kind: "custom", name: "Distance Sprinted", unit: "distance_cm", icon: false, base: 20_000_000 },
  { key: "minecraft:swim_one_cm", kind: "custom", name: "Distance Swum", unit: "distance_cm", icon: false, base: 1_500_000 },
  { key: "minecraft:boat_one_cm", kind: "custom", name: "Distance by Boat", unit: "distance_cm", icon: false, base: 4_000_000 },
  { key: "minecraft:play_time", kind: "custom", name: "Play Time", unit: "ticks", icon: false, base: 20 * 3600 * 60 },
  { key: "minecraft:time_since_death", kind: "custom", name: "Time Since Last Death", unit: "ticks", icon: false, base: 20 * 3600 * 5 },
  { key: "minecraft:deaths", kind: "custom", name: "Number of Deaths", unit: "count", icon: false, base: 40 },
  { key: "minecraft:mob_kills", kind: "custom", name: "Mob Kills", unit: "count", icon: false, base: 4_000 },
  { key: "minecraft:player_kills", kind: "custom", name: "Player Kills", unit: "count", icon: false, base: 3 },
  { key: "minecraft:jump", kind: "custom", name: "Jumps", unit: "count", icon: false, base: 25_000 },
  { key: "minecraft:damage_dealt", kind: "custom", name: "Damage Dealt", unit: "damage_tenths", icon: false, base: 120_000 },
  { key: "minecraft:damage_taken", kind: "custom", name: "Damage Taken", unit: "damage_tenths", icon: false, base: 60_000 },
  { key: "minecraft:fish_caught", kind: "custom", name: "Fish Caught", unit: "count", icon: false, base: 300 },
  { key: "minecraft:animals_bred", kind: "custom", name: "Animals Bred", unit: "count", icon: false, base: 200 },
  { key: "minecraft:sleep_in_bed", kind: "custom", name: "Times Slept in a Bed", unit: "count", icon: false, base: 150 }
];

// ---- the advancements the busy players complete (vanilla tabs and one mod). `reach`: the share of players who
// get this far; `hours`: play on a server before it is typically completed. Only advancements with a display
// count (cakeutils skips recipe unlocks), so the list is what a player sees in the advancement screen.
type AdvDef = WorldAdvancement & { reach: number; hours: number };

export const ADVANCEMENTS: AdvDef[] = [
  { id: "minecraft:story/root", title: "Minecraft", reach: 1, hours: 0.02 },
  { id: "minecraft:story/mine_stone", title: "Stone Age", reach: 0.98, hours: 0.1 },
  { id: "minecraft:story/upgrade_tools", title: "Getting an Upgrade", reach: 0.95, hours: 0.2 },
  { id: "minecraft:story/smelt_iron", title: "Acquire Hardware", reach: 0.9, hours: 0.6 },
  { id: "minecraft:story/obtain_armor", title: "Suit Up", reach: 0.85, hours: 1 },
  { id: "minecraft:story/lava_bucket", title: "Hot Stuff", reach: 0.7, hours: 1.5 },
  { id: "minecraft:story/iron_tools", title: "Isn't It Iron Pick", reach: 0.85, hours: 1.2 },
  { id: "minecraft:story/deflect_arrow", title: "Not Today, Thank You", reach: 0.5, hours: 3 },
  { id: "minecraft:story/form_obsidian", title: "Ice Bucket Challenge", reach: 0.6, hours: 2.5 },
  { id: "minecraft:story/mine_diamond", title: "Diamonds!", reach: 0.75, hours: 3 },
  { id: "minecraft:story/enter_the_nether", title: "We Need to Go Deeper", reach: 0.6, hours: 4 },
  { id: "minecraft:story/shiny_gear", title: "Cover Me with Diamonds", reach: 0.4, hours: 8 },
  { id: "minecraft:story/enchant_item", title: "Enchanter", reach: 0.55, hours: 5 },
  { id: "minecraft:story/cure_zombie_villager", title: "Zombie Doctor", reach: 0.12, hours: 20 },
  { id: "minecraft:story/follow_ender_eye", title: "Eye Spy", reach: 0.3, hours: 14 },
  { id: "minecraft:story/enter_the_end", title: "The End?", reach: 0.25, hours: 16 },
  { id: "minecraft:nether/root", title: "Nether", reach: 0.6, hours: 4 },
  { id: "minecraft:nether/return_to_sender", title: "Return to Sender", reach: 0.3, hours: 6 },
  { id: "minecraft:nether/find_fortress", title: "A Terrible Fortress", reach: 0.45, hours: 6 },
  { id: "minecraft:nether/obtain_blaze_rod", title: "Into Fire", reach: 0.4, hours: 7 },
  { id: "minecraft:nether/brew_potion", title: "Local Brewery", reach: 0.35, hours: 8 },
  { id: "minecraft:nether/create_beacon", title: "Bring Home the Beacon", reach: 0.08, hours: 30 },
  { id: "minecraft:nether/uneasy_alliance", title: "Uneasy Alliance", reach: 0.05, hours: 35 },
  { id: "minecraft:end/root", title: "The End", reach: 0.25, hours: 16 },
  { id: "minecraft:end/kill_dragon", title: "Free the End", reach: 0.2, hours: 18 },
  { id: "minecraft:end/dragon_egg", title: "The Next Generation", reach: 0.06, hours: 19 },
  { id: "minecraft:end/enter_end_gateway", title: "Remote Getaway", reach: 0.15, hours: 20 },
  { id: "minecraft:end/elytra", title: "Sky's the Limit", reach: 0.12, hours: 24 },
  { id: "minecraft:adventure/root", title: "Adventure", reach: 0.95, hours: 0.3 },
  { id: "minecraft:adventure/kill_a_mob", title: "Monster Hunter", reach: 0.9, hours: 0.4 },
  { id: "minecraft:adventure/sleep_in_bed", title: "Sweet Dreams", reach: 0.9, hours: 0.5 },
  { id: "minecraft:adventure/trade", title: "What a Deal!", reach: 0.5, hours: 3 },
  { id: "minecraft:adventure/shoot_arrow", title: "Take Aim", reach: 0.6, hours: 2 },
  { id: "minecraft:adventure/totem_of_undying", title: "Postmortal", reach: 0.07, hours: 25 },
  { id: "minecraft:adventure/kill_all_mobs", title: "Monsters Hunted", reach: 0.03, hours: 50 },
  { id: "minecraft:adventure/adventuring_time", title: "Adventuring Time", reach: 0.04, hours: 45 },
  { id: "minecraft:adventure/hero_of_the_village", title: "Hero of the Village", reach: 0.1, hours: 15 },
  { id: "minecraft:husbandry/root", title: "Husbandry", reach: 0.9, hours: 0.5 },
  { id: "minecraft:husbandry/plant_seed", title: "A Seedy Place", reach: 0.8, hours: 0.8 },
  { id: "minecraft:husbandry/breed_an_animal", title: "The Parrots and the Bats", reach: 0.7, hours: 1.5 },
  { id: "minecraft:husbandry/fishy_business", title: "Fishy Business", reach: 0.6, hours: 2 },
  { id: "minecraft:husbandry/tactical_fishing", title: "Tactical Fishing", reach: 0.3, hours: 5 },
  { id: "minecraft:husbandry/balanced_diet", title: "A Balanced Diet", reach: 0.06, hours: 40 },
  { id: "minecraft:husbandry/bred_all_animals", title: "Two by Two", reach: 0.04, hours: 48 },
  { id: "minecraft:husbandry/complete_catalogue", title: "A Complete Catalogue", reach: 0.03, hours: 50 },
  // a modded one, by its namespaced id like any other
  { id: "farmersdelight:main/root", title: "Farmer's Delight", reach: 0.5, hours: 2 },
  { id: "farmersdelight:main/get_knife", title: "Cutting Edge", reach: 0.4, hours: 3 },
  { id: "farmersdelight:main/use_cutting_board", title: "Ready to Cook", reach: 0.35, hours: 4 }
];

const NAMES = [
  "Pebblewick", "Saltmarsh", "Finnegan_B", "koi_pond", "Brinewalker", "tidepool", "MossyAnchor", "Lanternfish",
  "Reedcutter", "Quillon", "Driftwood_Dan", "Nettlebay", "Oarsman", "Kelpie", "Sandbar", "Mudskipper",
  "Harbourlight", "Cormorant", "Puffin", "Shoalmate", "Wavecrest", "Eelgrass", "Barnacle_Bo", "Sealily",
  "Fathom", "Trawler", "Pike_Street", "Minnow", "Gudgeon", "Bream", "Roach", "Tench", "Dace", "Loach",
  "Sturgeon", "Grayling"
];

/** The fresh scenario: linked servers, nobody has ever joined, no catalogue, milestones not on this proxy. */
export function generateFresh(): World {
  return {
    scenario: "fresh",
    milestones: false,
    milestones_since_ago_ms: 0,
    advancements: false,
    advancements_since_ago_ms: 0,
    advancements_imported: [],
    advancement_titles: [],
    servers: [
      { id: "lobby", display_name: "Lobby", mc_version: "26.3", platform: "paper", waiting: 0 },
      { id: "survival", display_name: "Survival", mc_version: "26.3", platform: "paper", waiting: 0 },
      { id: "creative", display_name: "Creative", mc_version: null, platform: null, waiting: 0 },
      { id: "onesoul", display_name: "One Soul at a Time", mc_version: "26.3", platform: "fabric", waiting: 0 }
    ],
    onesoul: generateOneSoulFresh(),
    standalone: ["onesoul"],
    minis: [],
    types: [],
    subjects: [],
    players: []
  };
}

/** The busy scenario: three linked servers, one not yet, a public and a private mini-server, 36 players. */
export function generateBusy(): World {
  const servers: WorldServer[] = [
    { id: "lobby", display_name: "Lobby", mc_version: "26.3", platform: "paper", waiting: 0 },
    { id: "survival", display_name: "Survival", mc_version: "26.3", platform: "paper", waiting: 2 },
    { id: "creative", display_name: "Creative", mc_version: "26.3", platform: "fabric", waiting: 0 },
    { id: "events", display_name: "Events", mc_version: null, platform: null, waiting: 0 },
    { id: "onesoul", display_name: "One Soul at a Time", mc_version: "26.3", platform: "fabric", waiting: 0 }
  ];
  const minis: WorldMini[] = [
    { id: "skyblock-1", display_name: "Skyblock 1", server: "survival", public: true },
    { id: "skyblock-2", display_name: "Skyblock 2", server: "survival", public: true },
    { id: "vault", display_name: "Vault", server: "survival", public: false }
  ];
  const types: StatType[] = [...VANILLA_TYPES, { key: "create:pressed", name: "Pressed", kind: "item" }];

  const subjects: WorldSubject[] = [];
  const addSubject = (d: Def) =>
    subjects.push({ key: d.key, kind: d.kind, name: d.name, unit: d.unit ?? "count", icon: d.icon === false ? null : hex(`icon:${d.kind}:${d.key}`, 64) });
  for (const d of [...BLOCKS, ...ITEMS, ...ENTITIES, ...CUSTOM]) addSubject(d);

  // which (type, subject) pairs exist, with a magnitude per pair
  const pairs: { type: string; subject: string; base: number; unit: Unit }[] = [];
  for (const d of BLOCKS) pairs.push({ type: "minecraft:mined", subject: d.key, base: d.base, unit: "count" });
  for (const d of ITEMS) {
    pairs.push({ type: "minecraft:used", subject: d.key, base: d.base, unit: "count" });
    pairs.push({ type: "minecraft:crafted", subject: d.key, base: d.base * 0.6, unit: "count" });
    pairs.push({ type: "minecraft:picked_up", subject: d.key, base: d.base * 1.3, unit: "count" });
    pairs.push({ type: "minecraft:dropped", subject: d.key, base: d.base * 0.1, unit: "count" });
  }
  for (const d of ITEMS.filter((i) => /pickaxe|sword|bow|shield|fishing/.test(i.key))) {
    pairs.push({ type: "minecraft:broken", subject: d.key, base: d.base * 0.4, unit: "count" });
  }
  for (const d of ENTITIES) {
    pairs.push({ type: "minecraft:killed", subject: d.key, base: d.base, unit: "count" });
    if (!/cod|cow|pig|sheep/.test(d.key)) pairs.push({ type: "minecraft:killed_by", subject: d.key, base: d.base * 0.05 + 1, unit: "count" });
  }
  for (const d of CUSTOM) pairs.push({ type: "minecraft:custom", subject: d.key, base: d.base, unit: d.unit ?? "count" });
  pairs.push({ type: "create:pressed", subject: "minecraft:iron_ingot", base: 800, unit: "count" });

  const random = rng(fnv1a("fishplex-busy"));
  const players: WorldPlayer[] = [];
  const weeks = 10;
  // live advancement tracking began three weeks ago; survival's operator imported the world's older completions,
  // creative's did not (so creative only has the last week)
  const advSince = 21 * DAY;
  const advImported = ["survival"];
  NAMES.forEach((name, i) => {
    const activity = 0.08 + random() ** 2 * 1.6; // most players small, a few huge
    const firstSeen = Math.floor(random() * weeks * 7 * DAY) + DAY;
    const lastSeen = Math.floor(random() ** 2 * Math.min(firstSeen - HOUR, 21 * DAY));
    const online = i < 9 && i !== 4; // eight online now
    const surv = 0.4 + random() * 0.6;
    const crea = random() < 0.6 ? random() * 0.5 : 0;
    const lob = 0.02 + random() * 0.05;
    const w: Record<string, number> = { survival: surv, creative: crea, lobby: lob };
    const inMini1 = random() < 0.45;
    const inMini2 = random() < 0.25;
    const inVault = random() < 0.2;
    const server = online ? (i % 3 === 2 ? "creative" : i === 7 ? "lobby" : "survival") : null;
    const mini = online && server === "survival" && i < 3 ? "survival/skyblock-1" : null;

    const totalMs = Math.round(activity * 60 * HOUR);
    const sumW = surv + crea + lob;
    const by_server: Record<string, number> = {};
    for (const [s, ws] of Object.entries(w)) if (ws > 0) by_server[s] = Math.round((totalMs * ws) / sumW);
    const by_mini: Record<string, number> = {};
    if (inMini1) by_mini["survival/skyblock-1"] = Math.round(by_server.survival * (0.1 + random() * 0.3));
    if (inMini2) by_mini["survival/skyblock-2"] = Math.round(by_server.survival * (0.05 + random() * 0.15));
    if (inVault) by_mini["survival/vault"] = Math.round(by_server.survival * 0.05);
    const minisSum = Object.values(by_mini).reduce((a, b) => a + b, 0);
    if (minisSum > by_server.survival) by_server.survival = minisSum + MIN; // mini time is inside its server's time

    const stats: Record<string, Record<string, number>> = {};
    const leafValue = (scopeKey: string, share: number) => {
      const bag: Record<string, number> = {};
      for (const p of pairs) {
        const r = rng(fnv1a(`${name}|${scopeKey}|${p.type}|${p.subject}`));
        if (r() < 0.3) continue; // never did this here
        let v = Math.round(p.base * activity * share * (0.2 + r() * 1.6));
        if (p.subject === "minecraft:player_kills" && r() < 0.8) v = 0;
        if (p.subject === "minecraft:time_since_death") v = Math.round(p.base * r());
        if (v > 0) bag[`${p.type}|${p.subject}`] = v;
      }
      return bag;
    };
    // creative has no mining of ores or killing to speak of: a smaller share
    for (const [s, ws] of Object.entries(w)) {
      if (ws > 0) stats[`server:${s}`] = leafValue(`server:${s}`, (ws / sumW) * (s === "lobby" ? 0.02 : 1));
    }
    for (const m of Object.keys(by_mini)) stats[`mini:${m}`] = leafValue(`mini:${m}`, 0.15 * (by_mini[m] / by_server.survival));

    // advancements per server (no mini-servers, no lobby): the deeper the advancement, the fewer players reach
    // it and the later in their time on that server it happens. Completions before live tracking survive only
    // on an imported server.
    const advancements: Record<string, Record<string, number>> = {};
    for (const s of ["survival", "creative"]) {
      const ms = by_server[s] ?? 0;
      if (ms <= 0) continue;
      const hours = ms / HOUR;
      const span = firstSeen - (online ? 0 : lastSeen);
      const bag: Record<string, number> = {};
      for (const a of ADVANCEMENTS) {
        const r = rng(fnv1a(`adv|${name}|${s}|${a.id}`));
        if (s === "creative" && !/root|mine_stone|upgrade_tools|sleep_in_bed|plant_seed|farmersdelight/.test(a.id)) continue;
        if (r() > a.reach) continue;
        const need = a.hours * (0.6 + r() * 0.8);
        if (hours < need) continue;
        // when: that far into the player's time here, a little jittered
        const progress = Math.min(0.97, Math.max(0.02, need / hours + (r() - 0.5) * 0.1));
        const ago = Math.round(firstSeen - span * progress);
        if (ago > advSince && !advImported.includes(s)) continue;
        bag[a.id] = ago;
      }
      if (Object.keys(bag).length) advancements[s] = bag;
    }

    const prefix: Segment[] =
      i === 0 ? [{ text: "[Admin] ", color: "red", bold: true }] : i === 1 ? [{ text: "[Mod] ", color: "aqua" }] : i < 6 ? [{ text: "✦ ", color: "gold" }] : [];
    const suffix: Segment[] = i === 2 ? [{ text: " ♪", color: "light_purple", italic: true }] : [];

    players.push({
      uuid: uuidOf(name),
      name,
      first_seen_ago_ms: firstSeen,
      last_seen_ago_ms: online ? 0 : lastSeen,
      online,
      server,
      mini,
      skin: online ? `http://textures.minecraft.net/texture/${hex(`skin:${name}`, 64)}` : null,
      prefix: online ? prefix : [],
      suffix: online ? suffix : [],
      playtime: { by_server, by_mini, between_ms: Math.round(totalMs * 0.015) },
      stats,
      advancements
    });
  });

  // a row created from a stat before this player ever logged in through the proxy: UUID as name
  const ghost = uuidOf("ghost");
  players.push({
    uuid: ghost,
    name: ghost,
    first_seen_ago_ms: 3 * DAY,
    last_seen_ago_ms: 3 * DAY,
    online: false,
    server: null,
    mini: null,
    skin: null,
    prefix: [],
    suffix: [],
    playtime: { by_server: {}, by_mini: {}, between_ms: 0 },
    stats: { "server:survival": { "minecraft:mined|minecraft:stone": 17, "minecraft:custom|minecraft:walk_one_cm": 84_000 } }
  });

  // One Soul: the first eleven players sign up; each soul's run stats are its round scope's leaf, every
  // sign-up spectates (playtime on the server, per round), the soul who plays now is online there
  const onesoul = generateOneSoulBusy(players.slice(0, 11).map((p) => ({ uuid: p.uuid, name: p.name })));
  for (const p of players) {
    const regs = onesoul.registrations.filter((r) => r.uuid === p.uuid);
    if (!regs.length) continue;
    const by_round: Record<string, number> = {};
    for (const r of regs) by_round[`onesoul/${r.round}`] = Math.round((2 + (fnv1a(`os:${p.name}:${r.round}`) % 20)) * HOUR);
    for (const s of onesoul.souls.filter((x) => x.uuid === p.uuid)) {
      const key = `round:onesoul/${s.cycle}`;
      const bag = (p.stats[key] ??= {});
      for (const st of s.stats) bag[`${st.type}|${st.subject}`] = (bag[`${st.type}|${st.subject}`] ?? 0) + st.value;
      by_round[`onesoul/${s.cycle}`] += s.ended_ago === null ? s.started_ago : s.started_ago - s.ended_ago;
    }
    p.playtime.by_round = by_round;
    p.playtime.by_server.onesoul = Object.values(by_round).reduce((a, b) => a + b, 0) + HOUR; // + prep time in the void
    const playing = onesoul.souls.find((x) => x.outcome === "playing");
    if (playing?.uuid === p.uuid) {
      p.online = true;
      p.server = "onesoul";
      p.mini = null;
      p.last_seen_ago_ms = 0;
    }
  }

  const earned = new Set(players.flatMap((p) => Object.values(p.advancements ?? {}).flatMap((bag) => Object.keys(bag))));
  return {
    scenario: "busy",
    onesoul,
    standalone: ["onesoul"],
    milestones: true,
    milestones_since_ago_ms: 21 * DAY,
    advancements: true,
    advancements_since_ago_ms: advSince,
    advancements_imported: advImported,
    advancement_titles: ADVANCEMENTS.filter((a) => earned.has(a.id)).map(({ id, title }) => ({ id, title })),
    servers,
    minis,
    types,
    subjects,
    players
  };
}
