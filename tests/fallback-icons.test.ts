import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { fallbackIcon, iconOr, kindOfType } from "#lib/icons/fallback.ts";
import { FALLBACK_BY_KIND, FALLBACK_FILES } from "#lib/icons/fallback-icons.ts";
import { iconHref } from "#lib/images.ts";
import { withFallbackIcons } from "#lib/server/cakeutils/icons.ts";
import type { Client } from "#lib/server/cakeutils/client.ts";

describe("fallback pictures", () => {
  test("items cakeutils cannot draw get their own picture", () => {
    for (const k of ["chest", "shield", "trident", "white_banner", "player_head", "shulker_box", "decorated_pot", "waxed_copper_chest"])
      expect(fallbackIcon(`minecraft:${k}`, "item")).toBe(`/mc/icons/${k}.png`);
    expect(fallbackIcon("minecraft:oxidized_copper_golem_statue", "item")).toBe("/mc/icons/copper_golem_spawn_egg.png");
  });

  test("blocks without an item get the item that places them", () => {
    expect(fallbackIcon("minecraft:wall_torch", "block")).toBe("/mc/icons/torch.png");
    expect(fallbackIcon("minecraft:potatoes", "block")).toBe("/mc/icons/potato.png");
    expect(fallbackIcon("minecraft:potted_poppy", "block")).toBe("/mc/icons/poppy.png");
    expect(fallbackIcon("minecraft:white_wall_banner", "block")).toBe("/mc/icons/white_banner.png");
    expect(fallbackIcon("minecraft:zombie_wall_head", "block")).toBe("/mc/icons/zombie_head.png");
    expect(fallbackIcon("minecraft:water_cauldron", "block")).toBe("/mc/icons/cauldron.png");
  });

  test("a mod's copy of a vanilla block is pictured as the vanilla one", () => {
    expect(fallbackIcon("easyanvils:minecraft/anvil", "block")).toBe("/mc/icons/anvil.png");
    expect(fallbackIcon("somemod:gear", "item")).toBeNull();
  });

  test("the player, custom stats, biomes and structures", () => {
    expect(fallbackIcon("minecraft:player", "entity")).toBe("/mc/icons/player_head.png");
    expect(fallbackIcon("minecraft:zombie", "entity")).toBeNull(); // the catalogue has its spawn egg
    expect(fallbackIcon("minecraft:interact_with_anvil", "custom")).toBe("/mc/icons/anvil.png");
    expect(fallbackIcon("minecraft:walk_one_cm", "custom")).toBe("/mc/icons/leather_boots.png");
    expect(fallbackIcon("minecraft:desert", "other")).toBe("/mc/icons/sand.png");
    expect(fallbackIcon("minecraft:desert", "biome")).toBe("/mc/icons/sand.png");
    expect(fallbackIcon("minecraft:abandoned_camp_taiga", "other")).toBe("/mc/icons/campfire.png");
    expect(fallbackIcon("minecraft:village_snowy", "structure")).toBe("/mc/icons/bell.png");
    expect(fallbackIcon("nova_structures:tavern_oak", "other")).toBe("/mc/icons/barrel.png");
    expect(fallbackIcon("terralith:cave/deep_caves", "other")).toBe("/mc/icons/stone.png");
    expect(fallbackIcon("terralith:shield", "other")).toBe("/mc/icons/structure_block.png");
    expect(fallbackIcon("reki:player_doll", "item")).toBe("/mc/icons/player_head.png");
  });

  test("no kind: an item, a block, then a mob; bad keys get nothing", () => {
    expect(fallbackIcon("minecraft:chest")).toBe("/mc/icons/chest.png");
    expect(fallbackIcon("minecraft:carrots")).toBe("/mc/icons/carrot.png");
    expect(fallbackIcon("minecraft:player")).toBe("/mc/icons/player_head.png");
    expect(fallbackIcon("minecraft:desert")).toBeNull();
    expect(fallbackIcon("not a key")).toBeNull();
    expect(fallbackIcon(null)).toBeNull();
  });

  test("a catalogue icon always wins", () => {
    expect(iconOr("/v2/icons/abc.png", "minecraft:chest", "item")).toBe("/v2/icons/abc.png");
    expect(iconOr(null, "minecraft:chest", "item")).toBe("/mc/icons/chest.png");
  });

  test("stat types name the kind they count", () => {
    expect(kindOfType("minecraft:mined")).toBe("block");
    expect(kindOfType("minecraft:killed_by")).toBe("entity");
    expect(kindOfType("cakeutils:entered_structure")).toBe("other");
    expect(kindOfType("somemod:thing")).toBeNull();
  });

  test("every picture the table names is bundled, and links pass through iconHref", () => {
    for (const t of Object.values(FALLBACK_BY_KIND)) for (const f of Object.values(t)) expect(FALLBACK_FILES.has(f)).toBe(true);
    for (const f of FALLBACK_FILES) expect(existsSync(`static/mc/icons/${f}.png`)).toBe(true);
    expect(iconHref("/mc/icons/chest.png")).toBe("/mc/icons/chest.png");
    expect(iconHref("/mc/icons/../x.png")).toBeNull();
  });
});

describe("the client fills gaps in the catalogue and player stats", () => {
  const ok = <T>(data: T) => ({ ok: true as const, data, asOf: 0, stale: false, empty: false });
  const inner = {
    subjects: async () => ok({ total: 2, subjects: [{ key: "minecraft:chest", kind: "item", name: "Chest", unit: "count", icon: null }, { key: "minecraft:stone", kind: "block", name: "Stone", unit: "count", icon: "/v2/icons/s.png" }] }),
    subject: async () => ok({ key: "minecraft:player", names: [{ key: "minecraft:player", kind: "entity", name: "Player", unit: "count", icon: null }], types: [] }),
    playerStats: async () => ok({ uuid: "u", scope: "network", stats: [{ type: "minecraft:mined", subject: "minecraft:carrots", name: "Carrots", unit: "count", value: 1, display: "1", icon: null }] }),
    playerStat: async () => ok({ uuid: "u", scope: "network", type: "minecraft:custom", subject: "minecraft:jump", name: "Jumps", unit: "count", value: 1, display: "1", icon: null })
  } as unknown as Client;
  const c = withFallbackIcons(inner);

  test("rows without an icon get the site's picture, others keep theirs", async () => {
    const s = await c.subjects();
    expect(s.ok && s.data.subjects.map((x) => x.icon)).toEqual(["/mc/icons/chest.png", "/v2/icons/s.png"]);
    const d = await c.subject("minecraft:player");
    expect(d.ok && d.data.names[0].icon).toBe("/mc/icons/player_head.png");
    const p = await c.playerStats("u");
    expect(p.ok && p.data.stats[0].icon).toBe("/mc/icons/carrot.png");
    const one = await c.playerStat("u", "minecraft:custom", "minecraft:jump");
    expect(one.ok && one.data.icon).toBe("/mc/icons/rabbit_foot.png");
  });
});
