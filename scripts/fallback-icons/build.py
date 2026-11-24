#!/usr/bin/env python3
"""Bundle pictures for the things cakeutils has no icon for (run with python3 -I).

    python3 -I scripts/fallback-icons/build.py <minecraft-client.jar> <cakeutils checkout>

cakeutils draws an icon for every item it can (D-39): items drawn by entity models (chests, banners, heads,
shulker boxes, the shield, the trident) get none, and neither do blocks without an item (wall torches, crops,
potted plants), entities without a spawn egg (the player), custom stats, biomes and structures. The site
shows its own picture for those: a fitting item, drawn here from the client jar with cakeutils' own renderer
(IconRenderer, compiled from the checkout), so every picture on the site has the same look.

Writes static/mc/icons/<item>.png and src/lib/icons/fallback-icons.ts (which picture each thing gets).
Items drawn by entity models get a small model of their own (extra/), built from the game's entity
textures; everything else is the item as the game draws it in the inventory. Needs Pillow and a JDK.
Re-run after a game update; add new biomes, structures and custom stats to the tables below.
"""
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
A = "assets/minecraft/"

# ------------------------------------------------------------------ what each thing gets

# Biomes: the block or item the place is known for.
BIOMES = {
    "badlands": "terracotta", "bamboo_jungle": "bamboo", "basalt_deltas": "basalt", "beach": "sand",
    "birch_forest": "birch_log", "cherry_grove": "cherry_leaves", "cold_ocean": "cod", "crimson_forest": "crimson_nylium",
    "dappled_forest": "poplar_log", "dark_forest": "dark_oak_log", "deep_cold_ocean": "gravel", "deep_dark": "sculk",
    "deep_frozen_ocean": "blue_ice", "deep_lukewarm_ocean": "sea_pickle", "deep_ocean": "prismarine", "desert": "sand",
    "dripstone_caves": "pointed_dripstone", "end_barrens": "end_stone", "end_highlands": "chorus_flower",
    "end_midlands": "end_stone", "eroded_badlands": "red_sandstone", "flower_forest": "allium", "forest": "oak_log",
    "frozen_ocean": "ice", "frozen_peaks": "packed_ice", "frozen_river": "ice", "grove": "snow_block",
    "ice_spikes": "packed_ice", "jagged_peaks": "snow_block", "jungle": "jungle_log", "lukewarm_ocean": "seagrass",
    "lush_caves": "moss_block", "mangrove_swamp": "mangrove_roots", "meadow": "cornflower", "mushroom_fields": "mycelium",
    "nether_wastes": "netherrack", "ocean": "kelp", "old_growth_birch_forest": "birch_leaves",
    "old_growth_pine_taiga": "podzol", "old_growth_spruce_taiga": "spruce_log", "pale_garden": "pale_moss_block",
    "plains": "grass_block", "river": "water_bucket", "savanna": "acacia_log", "savanna_plateau": "coarse_dirt",
    "small_end_islands": "end_stone", "snowy_beach": "snow", "snowy_plains": "snow_block", "snowy_slopes": "powder_snow_bucket",
    "snowy_taiga": "spruce_leaves", "soul_sand_valley": "soul_sand", "sparse_jungle": "jungle_leaves", "stony_peaks": "calcite",
    "stony_shore": "stone", "sulfur_caves": "sulfur", "sunflower_plains": "sunflower", "swamp": "lily_pad", "taiga": "spruce_log",
    "the_end": "end_stone", "the_void": "structure_void", "warm_ocean": "brain_coral_block", "warped_forest": "warped_nylium",
    "windswept_forest": "spruce_sapling", "windswept_gravelly_hills": "gravel", "windswept_hills": "emerald_ore",
    "windswept_savanna": "acacia_sapling", "wooded_badlands": "coarse_dirt",
    # dimensions (the firsts feed and `other` stats)
    "overworld": "grass_block", "the_nether": "netherrack",
}

# Structures: what you find there. Every abandoned camp gets the campfire, every village the bell.
STRUCTURES = {
    "ancient_city": "sculk_shrieker", "bastion_remnant": "gilded_blackstone", "buried_treasure": "heart_of_the_sea",
    "desert_pyramid": "chiseled_sandstone", "end_city": "purpur_block", "fortress": "nether_bricks", "igloo": "snow_block",
    "jungle_pyramid": "mossy_cobblestone", "mansion": "dark_oak_planks", "mineshaft": "rail", "mineshaft_mesa": "rail",
    "monument": "prismarine_bricks", "nether_fossil": "bone_block", "ocean_ruin_cold": "suspicious_gravel",
    "ocean_ruin_warm": "suspicious_sand", "pillager_outpost": "crossbow", "shipwreck": "spruce_planks",
    "shipwreck_beached": "spruce_planks", "stronghold": "end_portal_frame", "swamp_hut": "cauldron",
    "trail_ruins": "archer_pottery_sherd", "trial_chambers": "trial_spawner",
}
STRUCTURE_PREFIXES = {"abandoned_camp_": "campfire", "village_": "bell", "ruined_portal": "crying_obsidian"}

# Words in modded biome and structure names (terralith, nova_structures, ...), first match wins.
WORDS = [
    ("village", "bell"), ("town", "bell"), ("camp", "campfire"), ("tavern", "barrel"), ("well", "cobblestone"),
    ("crypt", "bone"), ("dungeon", "spawner"), ("trial", "trial_spawner"), ("shrine", "chiseled_stone_bricks"),
    ("tower", "stone_bricks"), ("lighthouse", "lantern"), ("castle", "purpur_block"), ("ship", "spruce_planks"),
    ("conduit", "prismarine"), ("bunker", "deepslate_bricks"), ("barracks", "crossbow"), ("illager", "crossbow"),
    ("witch", "cauldron"), ("ranch", "hay_block"), ("miner", "iron_pickaxe"), ("smith", "anvil"), ("bridge", "stone_bricks"),
    ("ruin", "mossy_stone_bricks"), ("stronghold", "end_portal_frame"), ("fortress", "nether_bricks"), ("fortified", "bell"),
    ("cave", "stone"), ("gravel", "gravel"), ("taiga", "spruce_log"), ("birch", "birch_log"), ("beach", "sand"), ("highlands", "grass_block"),
    ("shrubland", "dead_bush"), ("marsh", "lily_pad"), ("forest", "oak_log"), ("desert", "sand"), ("snow", "snow_block"),
    ("ice", "ice"), ("jungle", "jungle_log"), ("swamp", "lily_pad"), ("end", "end_stone"), ("nether", "netherrack"),
    ("crimson", "crimson_nylium"), ("warped", "warped_nylium"),
]
OTHER_FALLBACK = "structure_block"

# Custom stats (minecraft:custom): the thing the stat is about.
CUSTOM = {
    "animals_bred": "wheat", "aviate_one_cm": "elytra", "bell_ring": "bell", "boat_one_cm": "oak_boat",
    "clean_armor": "leather_chestplate", "clean_banner": "white_banner", "clean_shulker_box": "shulker_box",
    "climb_one_cm": "ladder", "crouch_one_cm": "leather_boots", "damage_absorbed": "golden_apple",
    "damage_blocked_by_shield": "shield", "damage_dealt": "iron_sword", "damage_dealt_absorbed": "iron_sword",
    "damage_dealt_resisted": "iron_sword", "damage_resisted": "iron_chestplate", "damage_taken": "iron_chestplate",
    "deaths": "skeleton_skull", "drop": "dropper", "eat_cake_slice": "cake", "enchant_item": "enchanting_table",
    "fall_one_cm": "feather", "fill_cauldron": "cauldron", "fish_caught": "fishing_rod", "fly_one_cm": "elytra",
    "happy_ghast_one_cm": "white_harness", "horse_one_cm": "saddle", "inspect_dispenser": "dispenser",
    "inspect_dropper": "dropper", "inspect_hopper": "hopper", "interact_with_anvil": "anvil",
    "interact_with_beacon": "beacon", "interact_with_blast_furnace": "blast_furnace",
    "interact_with_brewingstand": "brewing_stand", "interact_with_campfire": "campfire",
    "interact_with_cartography_table": "cartography_table", "interact_with_crafting_table": "crafting_table",
    "interact_with_furnace": "furnace", "interact_with_grindstone": "grindstone", "interact_with_lectern": "lectern",
    "interact_with_loom": "loom", "interact_with_smithing_table": "smithing_table", "interact_with_smoker": "smoker",
    "interact_with_stonecutter": "stonecutter", "jump": "rabbit_foot", "leave_game": "oak_door",
    "minecart_one_cm": "minecart", "mob_kills": "iron_sword", "nautilus_one_cm": "nautilus_shell", "open_barrel": "barrel",
    "open_chest": "chest", "open_enderchest": "ender_chest", "open_shulker_box": "shulker_box", "pig_one_cm": "carrot_on_a_stick",
    "play_noteblock": "note_block", "play_record": "jukebox", "play_time": "clock", "player_kills": "player_head",
    "pot_flower": "flower_pot", "raid_trigger": "ominous_bottle", "raid_win": "totem_of_undying", "sleep_in_bed": "red_bed",
    "sleep_in_straw_bed": "straw_bed", "sneak_time": "leather_boots", "sprint_one_cm": "sugar", "strider_one_cm": "warped_fungus_on_a_stick",
    "swim_one_cm": "turtle_helmet", "talked_to_villager": "emerald", "target_hit": "target", "time_since_death": "clock",
    "time_since_rest": "red_bed", "total_world_time": "clock", "traded_with_villager": "emerald",
    "trigger_trapped_chest": "trapped_chest", "tune_noteblock": "note_block", "use_cauldron": "cauldron",
    "walk_on_water_one_cm": "lily_pad", "walk_one_cm": "leather_boots", "walk_under_water_one_cm": "heart_of_the_sea",
}

# Entities without a spawn egg (an entity with an item of its own id, a boat or a minecart, gets that item).
ENTITIES = {
    "player": "player_head", "mannequin": "armor_stand", "giant": "zombie_head", "illusioner": "bow",
    "killer_bunny": "rabbit_foot", "lightning_bolt": "lightning_rod", "falling_block": "sand", "evoker_fangs": "evoker_spawn_egg",
    "area_effect_cloud": "lingering_potion", "llama_spit": "llama_spawn_egg", "shulker_bullet": "shulker_shell",
    "fishing_bobber": "fishing_rod", "leash_knot": "lead", "eye_of_ender": "ender_eye", "wither_skull": "wither_skeleton_skull",
    "fireball": "fire_charge", "small_fireball": "fire_charge", "dragon_fireball": "dragon_breath",
    "experience_orb": "experience_bottle", "boat": "oak_boat", "chest_boat": "oak_chest_boat",
    "breeze_wind_charge": "wind_charge", "creaking_transient": "creaking_heart", "ominous_item_spawner": "ominous_trial_key",
    "spawner_minecart": "minecart",
}

# Blocks without an item: the item you place or grow them with.
BLOCKS = {
    "attached_melon_stem": "melon_seeds", "melon_stem": "melon_seeds", "attached_pumpkin_stem": "pumpkin_seeds",
    "pumpkin_stem": "pumpkin_seeds", "beetroots": "beetroot", "carrots": "carrot", "potatoes": "potato", "cocoa": "cocoa_beans",
    "sweet_berry_bush": "sweet_berries", "torchflower_crop": "torchflower_seeds", "pitcher_crop": "pitcher_pod",
    "bamboo_sapling": "bamboo", "big_dripleaf_stem": "big_dripleaf", "bubble_column": "soul_sand", "cave_vines": "glow_berries",
    "cave_vines_plant": "glow_berries", "kelp_plant": "kelp", "twisting_vines_plant": "twisting_vines",
    "weeping_vines_plant": "weeping_vines", "tall_seagrass": "seagrass", "end_gateway": "ender_pearl",
    "end_portal": "end_portal_frame", "nether_portal": "obsidian", "fire": "flint_and_steel", "soul_fire": "flint_and_steel",
    "frosted_ice": "ice", "grass": "short_grass", "chain": "iron_chain", "lava": "lava_bucket", "water": "water_bucket",
    "powder_snow": "powder_snow_bucket", "water_cauldron": "cauldron", "lava_cauldron": "cauldron",
    "powder_snow_cauldron": "cauldron", "moving_piston": "piston", "piston_head": "piston", "redstone_wire": "redstone",
    "tripwire": "string", "potted_bamboo": "bamboo", "potted_azalea_bush": "azalea", "potted_flowering_azalea_bush": "flowering_azalea",
    "ominous_banner": "white_banner", "set_spawn": "respawn_anchor", "poplar_leaves": "poplar_sapling",
}

# Modded things seen on the network that stand for a vanilla one.
MODDED = {
    "item": {"reki:experience_flask": "experience_bottle", "reki:player_doll": "player_head"},
    "custom": {"waystones:waystone_activated": "lodestone"},
}

DYES = {
    "white": 0xF9FFFE, "orange": 0xF9801D, "magenta": 0xC74EBD, "light_blue": 0x3AB3DA, "yellow": 0xFED83D, "lime": 0x80C71F,
    "pink": 0xF38BAA, "gray": 0x474F52, "light_gray": 0x9D9D97, "cyan": 0x169C9C, "purple": 0x8932B8, "blue": 0x3C44AA,
    "brown": 0x835432, "green": 0x5E7C16, "red": 0xB02E26, "black": 0x1D1D21,
}
CHESTS = {
    "chest": "normal", "trapped_chest": "trapped", "ender_chest": "ender", "copper_chest": "copper",
    "exposed_copper_chest": "copper_exposed", "weathered_copper_chest": "copper_weathered", "oxidized_copper_chest": "copper_oxidized",
}
HEADS = {  # texture, head box (u, v, width, height, depth), hat layer (u, v) or None
    "skeleton_skull": ("entity/skeleton/skeleton", (0, 0, 8, 8, 8), None),
    "wither_skeleton_skull": ("entity/skeleton/wither_skeleton", (0, 0, 8, 8, 8), None),
    "zombie_head": ("entity/zombie/zombie", (0, 0, 8, 8, 8), (32, 0)),
    "creeper_head": ("entity/creeper/creeper", (0, 0, 8, 8, 8), None),
    "piglin_head": ("entity/piglin/piglin", (0, 0, 10, 8, 8), None),
    "player_head": ("entity/player/wide/steve", (0, 0, 8, 8, 8), (32, 0)),
    "dragon_head": ("entity/enderdragon/dragon", (112, 30, 16, 16, 16), None),
}


# ------------------------------------------------------------------ helpers

def tex(z, path):
    return Image.open(io.BytesIO(z.read(A + "textures/" + path + ".png"))).convert("RGBA")


def box_faces(img, u, v, w, h, d):
    """The faces of an entity-model box laid out the vanilla way from (u, v)."""
    c = lambda x, y, cw, ch: img.crop((x, y, x + cw, y + ch))
    return {
        "top": c(u + d, v, w, d), "bottom": c(u + d + w, v, w, d),
        "right": c(u, v + d, d, h), "front": c(u + d, v + d, w, h), "left": c(u + d + w, v + d, d, h), "back": c(u + 2 * d + w, v + d, w, h),
    }


class Extra:
    """Synthetic items, models and textures layered over the jar for the items cakeutils cannot draw."""

    def __init__(self, root):
        self.root = root

    def write(self, rel, data):
        p = os.path.join(self.root, "minecraft", rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        if isinstance(data, Image.Image):
            data.save(p)
        else:
            with open(p, "w") as f:
                json.dump(data, f)

    def texture(self, name, img):
        self.write(f"textures/fallback/{name}.png", img)
        return f"minecraft:fallback/{name}"

    def item(self, name, model):
        self.write(f"models/item/fallback_{name}.json", model)
        self.write(f"items/fallback_{name}.json", {"model": {"type": "minecraft:model", "model": f"minecraft:item/fallback_{name}"}})
        return f"minecraft:fallback_{name}"

    def flat(self, name, img):
        return self.item(name, {"parent": "minecraft:item/generated", "textures": {"layer0": self.texture(name, img)}})

    def box(self, name, frm, to, faces):
        """One box; faces maps east (screen left), north (screen right), up, ... to images."""
        textures, fs = {}, {}
        for side, img in faces.items():
            textures[side] = self.texture(f"{name}_{side}", img)
            fs[side] = {"texture": "#" + side, "uv": [0, 0, 16, 16]}
        return self.item(name, {"parent": "minecraft:block/block", "textures": textures, "elements": [{"from": frm, "to": to, "faces": fs}]})


def tint(img, rgb):
    r, g, b = (rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255
    px = img.load()
    out = img.copy()
    po = out.load()
    for y in range(img.height):
        for x in range(img.width):
            pr, pg, pb, pa = px[x, y]
            po[x, y] = (pr * r // 255, pg * g // 255, pb * b // 255, pa)
    return out


def exact_palette(img):
    """The same pixels as a palette image when there are at most 256 colours (most pictures): a third of the bytes."""
    colours = img.getcolors(256)
    if not colours:
        return img
    index = {c: i for i, (_, c) in enumerate(colours)}
    out = Image.new("P", img.size)
    out.putpalette([v for _, c in colours for v in c], rawmode="RGBA")
    out.putdata([index[c] for c in img.get_flattened_data()] if hasattr(img, "get_flattened_data") else [index[c] for c in img.getdata()])
    return out


def specials(z, ex):
    """Models for the items drawn by entity models. Returns {picture name: item id to render}."""
    out = {}
    flip = lambda i: i.transpose(Image.FLIP_TOP_BOTTOM)
    # chests: the lid's 5 rows over the body's lower 9, textures stored upside down
    for item, t in CHESTS.items():
        img = tex(z, "entity/chest/" + t)
        lid, body = box_faces(img, 0, 0, 14, 5, 14), box_faces(img, 0, 19, 14, 10, 14)
        lock = box_faces(img, 0, 0, 2, 4, 1)["front"]

        def side(k):
            s = Image.new("RGBA", (14, 14))
            s.paste(flip(lid[k]), (0, 0))
            s.paste(flip(body[k]).crop((0, 1, 14, 10)), (0, 5))
            return s

        front = side("front")
        front.paste(flip(lock).crop((0, 0, 2, 3)), (6, 3))
        top = flip(lid["bottom"])
        out[item] = ex.box(item, [1, 0, 1], [15, 14, 15], {"east": front, "north": side("left"), "up": top, "west": side("right"), "south": side("back"), "down": top})
        if item.endswith("copper_chest"):
            out["waxed_" + item] = out[item]
    # heads: the head box, the hat layer over it
    for item, (t, (u, v, w, h, d), hat) in HEADS.items():
        img = tex(z, t)
        f = box_faces(img, u, v, w, h, d)
        if hat:
            for k, layer in box_faces(img, hat[0], hat[1], w, h, d).items():
                f[k] = f[k].copy()
                f[k].alpha_composite(layer)
        # a head is drawn at 1.5 times its size, like the game does in the inventory
        size = [0.5, 0, 2, 15.5, 12, 14] if w == 10 else [2, 0, 2, 14, 12, 14]
        out[item] = ex.box(item, size[:3], size[3:], {"east": f["front"], "north": f["left"], "up": f["top"], "west": f["right"], "south": f["back"], "down": f["bottom"]})
    # shulker boxes: the block's own texture on every side
    for c in [None, *DYES]:
        name = f"{c}_shulker_box" if c else "shulker_box"
        t = tex(z, "block/" + name)
        out[name] = ex.box(name, [0, 0, 0], [16, 16, 16], {k: t for k in ["east", "north", "up", "west", "south", "down"]})
    # banners: the cloth dyed, on its bar
    base = tex(z, "entity/banner/banner_base")
    cloth = tex(z, "entity/banner/base").crop((1, 1, 21, 41))
    for c, rgb in DYES.items():
        img = Image.new("RGBA", (48, 48))
        img.paste(base.crop((0, 42, 22, 44)).resize((24, 2), Image.NEAREST), (12, 1))
        img.paste(base.crop((44, 0, 46, 42)).crop((0, 0, 2, 4)), (23, 0))
        img.alpha_composite(tint(cloth, rgb), (14, 3))
        out[f"{c}_banner"] = ex.flat(f"{c}_banner", img)
    # the shield, face on
    shield = Image.new("RGBA", (24, 24))
    shield.paste(tex(z, "entity/shield/shield_base_nopattern").crop((1, 1, 13, 23)), (6, 1))
    out["shield"] = ex.flat("shield", shield)
    # the trident: the game's own inventory model (the item definition picks it for the gui only)
    out["trident"] = ex.item("trident", {"parent": "minecraft:item/trident"})
    # the conduit and the decorated pot
    cage = box_faces(tex(z, "entity/conduit/cage"), 0, 0, 8, 8, 8)
    shell = box_faces(tex(z, "entity/conduit/base"), 0, 0, 6, 6, 6)
    for k in cage:  # the shell seen through the cage
        f = Image.new("RGBA", (8, 8))
        f.paste(shell[k].resize((6, 6), Image.NEAREST), (1, 1))
        f.alpha_composite(cage[k])
        cage[k] = f
    out["conduit"] = ex.box("conduit", [3, 3, 3], [13, 13, 13], {"east": cage["front"], "north": cage["left"], "up": cage["top"], "west": cage["right"], "south": cage["back"], "down": cage["bottom"]})
    pot_side = tex(z, "entity/decorated_pot/decorated_pot_side")
    pot_top = tex(z, "entity/decorated_pot/decorated_pot_base").crop((0, 13, 14, 27))
    out["decorated_pot"] = ex.box("decorated_pot", [1, 0, 1], [15, 16, 15], {"east": pot_side, "north": pot_side, "west": pot_side, "south": pot_side, "up": pot_top, "down": pot_top})
    return out


def main(jar, cakeutils):
    z = zipfile.ZipFile(jar)
    names = set(z.namelist())
    items = {n[len(A + "items/"):-5] for n in names if n.startswith(A + "items/") and n.endswith(".json")}
    lang = json.loads(z.read(A + "lang/en_us.json"))
    entities = sorted({k.split(".")[2] for k in lang if k.startswith("entity.minecraft.") and k.count(".") == 2})
    # every block has a blockstate file (wall banners and wall heads have no name of their own)
    blocks = sorted({k.split(".")[2] for k in lang if k.startswith("block.minecraft.") and k.count(".") == 2}
                    | {n[len(A + "blockstates/"):-5] for n in names if n.startswith(A + "blockstates/") and n.endswith(".json")})

    work = tempfile.mkdtemp(prefix="fallback-icons-")
    try:
        ex = Extra(os.path.join(work, "extra"))
        special = specials(z, ex)
        render = dict(special)  # picture name → item id to draw

        def need(pic):
            if pic in special:
                return pic
            if pic not in items:
                raise SystemExit(f"no item {pic} in the jar (fix the table)")
            render.setdefault(pic, "minecraft:" + pic)
            return pic

        table = {"block": {}, "item": {}, "entity": {}, "custom": {}, "other": {}}
        for k in special:
            table["item"][k] = table["block"][k] = k
        for k in sorted(items):
            if k.endswith("copper_golem_statue"):  # a golem in a pose: its spawn egg says what it is
                table["item"][k] = table["block"][k] = need("copper_golem_spawn_egg")
        for b in blocks:
            if b in items:
                continue
            pic = BLOCKS.get(b)
            if pic is None:
                m = re.fullmatch(r"(.+_)?wall_(hanging_sign|sign|torch|banner|fan|head|skull)", b)
                m2 = re.fullmatch(r"(.+)_wall_fan", b)
                if m2:
                    pic = m2.group(1) + "_fan"
                elif m:
                    pic = (m.group(1) or "") + m.group(2)
                elif b.startswith("potted_"):
                    pic = b[len("potted_"):]
                elif b.endswith("candle_cake"):
                    pic = "cake"
            if pic is not None and (pic in items or pic in special):
                table["block"][b] = need(pic)
        for e in entities:
            if e + "_spawn_egg" in items:
                continue
            pic = ENTITIES.get(e, e if e in items else None)
            if pic is not None:
                table["entity"][e] = need(pic)
        for k, pic in CUSTOM.items():
            table["custom"][k] = need(pic)
        for k, pic in {**BIOMES, **STRUCTURES}.items():
            table["other"][k] = need(pic)
        for kind, m in MODDED.items():
            for k, pic in m.items():
                table[kind][k] = need(pic)
        words = [(w, need(p)) for w, p in WORDS]
        prefixes = [(w, need(p)) for w, p in STRUCTURE_PREFIXES.items()]
        need(OTHER_FALLBACK)
        # the pictures the advancement and firsts feeds name, for when nobody has a stat for them yet
        for m in re.finditer(r'"minecraft:([a-z0-9_]+)",?$', open(os.path.join(ROOT, "src/lib/milestones/advancement-icons.ts")).read(), re.M):
            if m.group(1) in items or m.group(1) in special:
                need(m.group(1))
        for pic in ["grass_block", "netherrack", "end_stone", "clock"]:
            need(pic)

        # draw them with cakeutils' renderer
        cls = os.path.join(work, "cls")
        gson = os.environ.get("GSON_JAR") or next((p for p in ["/opt/apache-maven-3.9.11/lib/gson-2.13.1.jar", "/opt/gradle-8.14.3/lib/gson-2.10.jar"] if os.path.exists(p)), None)
        if not gson:
            raise SystemExit("set GSON_JAR to a gson jar")
        src = lambda p: os.path.join(cakeutils, p)
        subprocess.run(["javac", "-d", cls, "-cp", gson,
                        src("protocol/src/main/java/com/cakes/cakeutils/protocol/key/NamespacedId.java"),
                        src("core/src/main/java/com/cakes/cakeutils/core/icons/ItemModels.java"),
                        src("proxy/src/main/java/com/cakes/cakeutils/proxy/stats/icons/IconRenderer.java"),
                        src("proxy/src/main/java/com/cakes/cakeutils/proxy/stats/icons/AssetSource.java"),
                        os.path.join(HERE, "RenderIcons.java")], check=True)
        lst = os.path.join(work, "list.txt")
        with open(lst, "w") as f:
            for pic, item in sorted(render.items()):
                f.write(f"{pic} {item}\n")
        raw = os.path.join(work, "out")
        os.makedirs(raw)
        subprocess.run(["java", "-cp", cls + os.pathsep + gson, "RenderIcons", jar, ex.root, lst, raw], check=True)

        out = os.path.join(ROOT, "static", "mc", "icons")
        shutil.rmtree(out, ignore_errors=True)
        os.makedirs(out)
        for pic in sorted(render):
            img = Image.open(os.path.join(raw, pic + ".png")).convert("RGBA")
            img = exact_palette(img)
            img.save(os.path.join(out, pic + ".png"), optimize=True)
    finally:
        shutil.rmtree(work, ignore_errors=True)

    ts = ["// Generated by scripts/fallback-icons/build.py from Minecraft 26.3: do not edit by hand.",
          "// Pictures the site bundles (static/mc/icons/<name>.png) for things cakeutils has no icon for, by catalogue kind",
          "// and path (namespace minecraft unless the key is written out). See src/lib/icons/fallback.ts.",
          f"export const FALLBACK_FILES: ReadonlySet<string> = new Set({json.dumps(sorted(render))});",
          "export const FALLBACK_BY_KIND: Readonly<Record<string, Readonly<Record<string, string>>>> = {"]
    for kind in table:
        ts.append(f"  {kind}: {json.dumps(dict(sorted(table[kind].items())), separators=(', ', ': '))},")
    ts += ["};",
           "/** Words in modded biome and structure names, first match wins. */",
           f"export const FALLBACK_WORDS: readonly (readonly [string, string])[] = {json.dumps(words)};",
           f"export const FALLBACK_PREFIXES: readonly (readonly [string, string])[] = {json.dumps(prefixes)};",
           f'export const FALLBACK_OTHER = "{OTHER_FALLBACK}";', ""]
    os.makedirs(os.path.join(ROOT, "src/lib/icons"), exist_ok=True)
    with open(os.path.join(ROOT, "src/lib/icons/fallback-icons.ts"), "w") as f:
        f.write("\n".join(ts))
    print(f"{len(render)} pictures, {sum(len(t) for t in table.values())} things")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
