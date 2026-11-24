// Pictures for the things cakeutils has no icon for (cakeutils D-39: items drawn by entity models such as
// chests, banners, heads and the shield; blocks without an item; the player; custom stats; biomes and
// structures). The site bundles a fitting item for each, drawn from the 26.3 client jar with cakeutils' own
// renderer (scripts/fallback-icons/build.py), and serves it from /mc/icons/<name>.png. A catalogue icon,
// when there is one, always wins: these only fill the gaps.

import { FALLBACK_BY_KIND, FALLBACK_FILES, FALLBACK_OTHER, FALLBACK_PREFIXES, FALLBACK_WORDS } from "./fallback-icons.ts";

const KEY = /^([a-z0-9_.-]{1,64}):([a-z0-9_./-]{1,128})$/;
const href = (file: string) => `/mc/icons/${file}.png`;

/** The catalogue kind of a stat type's subjects (vanilla types and cakeutils' place types); null when unknown. */
export function kindOfType(type: string): string | null {
  switch (type) {
    case "minecraft:mined":
      return "block";
    case "minecraft:crafted":
    case "minecraft:used":
    case "minecraft:broken":
    case "minecraft:picked_up":
    case "minecraft:dropped":
      return "item";
    case "minecraft:killed":
    case "minecraft:killed_by":
      return "entity";
    case "minecraft:custom":
      return "custom";
    case "cakeutils:entered_biome":
    case "cakeutils:entered_dimension":
    case "cakeutils:entered_structure":
      return "other";
    default:
      return null;
  }
}

/** Firsts and criteria name places by what they are; the catalogue files them all under `other`. */
const KIND_ALIAS: Record<string, string> = { biome: "other", structure: "other", dimension: "other", place: "other" };

function byTable(kind: string, key: string, ns: string, path: string): string | null {
  const t = FALLBACK_BY_KIND[kind];
  const v = t?.[key] ?? (ns === "minecraft" ? t?.[path] : undefined);
  if (v) return v;
  if ((kind === "item" || kind === "block") && ns === "minecraft" && FALLBACK_FILES.has(path)) return path;
  return null;
}

/** A biome or structure: the table, then the words in its name (modded ones), else a structure block. */
function place(key: string, ns: string, path: string): string {
  const v = byTable("other", key, ns, path);
  if (v) return v;
  if (ns === "minecraft") for (const [prefix, file] of FALLBACK_PREFIXES) if (path.startsWith(prefix)) return file;
  const words = path.split(/[_/]/);
  for (const [word, file] of FALLBACK_WORDS) if (words.some((w) => w === word || w === `${word}s`)) return file;
  return FALLBACK_OTHER;
}

/**
 * The bundled picture for a thing the catalogue has no icon for, or null. `kind` is the catalogue kind
 * (block, item, entity, custom, other) or a firsts kind (biome, structure, dimension); without one, the
 * thing is looked up as an item, a block, then a mob.
 */
export function fallbackIcon(key: string | null | undefined, kind?: string | null): string | null {
  const m = key ? KEY.exec(key) : null;
  if (!m) return null;
  const [, ns, path] = m;
  // a mod that takes over a vanilla block files it as `<mod>:minecraft/<path>` (easyanvils' anvil)
  if (ns !== "minecraft" && path.startsWith("minecraft/") && !path.slice(10).includes("/")) {
    const own = fallbackIcon(`minecraft:${path.slice(10)}`, kind);
    if (own) return own;
  }
  const k = kind ? (KIND_ALIAS[kind] ?? kind) : null;
  if (k === "other") return href(place(key!, ns, path));
  const kinds = k ? [k] : ["item", "block", "entity"];
  for (const kk of kinds) {
    const v = byTable(kk, key!, ns, path);
    if (v) return href(v);
  }
  return null;
}

/** A catalogue icon, else the bundled picture. */
export function iconOr(icon: string | null | undefined, key: string | null | undefined, kind?: string | null): string | null {
  return icon || fallbackIcon(key, kind);
}
