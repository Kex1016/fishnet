// Words for the network routes planned in cakeutils: first kinds, death groups. Unknown kinds read as a
// title-cased id, never a crash.
import { titleId } from "#lib/onesoul/format.ts";

export const FIRST_KINDS: { id: string; label: string }[] = [
  { id: "advancement", label: "Advancements" },
  { id: "criterion", label: "Criteria" },
  { id: "dimension", label: "Dimensions" },
  { id: "biome", label: "Biomes" },
  { id: "structure", label: "Structures" },
  { id: "item", label: "Rare items" },
  { id: "playtime", label: "Playtime" },
  { id: "stat", label: "Stats" }
];

const ONE: Record<string, string> = { advancement: "Advancement", criterion: "Criterion", dimension: "Dimension", biome: "Biome", structure: "Structure", item: "Rare item", playtime: "Playtime", stat: "Stat" };
export function firstKind(k: string): string {
  return ONE[k] ?? titleId(k);
}

/** "x 120, y 64, z -40" */
export function posText(p: { x: number; y: number; z: number }): string {
  return `x ${Math.round(p.x)}, y ${Math.round(p.y)}, z ${Math.round(p.z)}`;
}
