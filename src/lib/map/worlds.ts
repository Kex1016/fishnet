// Ordering and labels for the worlds /v2/map lists (brief §2). cakeutils sends vanilla worlds with `order: 0` and a
// raw `name` such as `minecraft:overworld`, so the site orders and labels them itself: overworld, nether, end, then
// the rest by name. `name` is plain text from the server; it is shown as text only, never parsed.
import type { MapWorldRef } from "#lib/api/types.ts";

type WorldLike = Pick<MapWorldRef, "id" | "dimension" | "name"> & Partial<Pick<MapWorldRef, "order" | "mini" | "area">>;

const VANILLA = [
  { rank: 0, label: "Overworld", ids: ["minecraft_overworld", "minecraft:overworld", "overworld"] },
  { rank: 1, label: "The Nether", ids: ["minecraft_the_nether", "minecraft:the_nether", "the_nether", "nether"] },
  { rank: 2, label: "The End", ids: ["minecraft_the_end", "minecraft:the_end", "the_end", "end"] }
];

const AREAS = { overworld: 0, nether: 1, end: 2 } as const;

function vanilla(w: WorldLike) {
  if (w.mini) return w.area ? VANILLA[AREAS[w.area]] : null; // a mini's world is labelled by its area
  const keys = [w.dimension, w.id, w.name].filter((k): k is string => !!k);
  return VANILLA.find((v) => keys.some((k) => v.ids.includes(k))) ?? null;
}

/** A readable name (a mini's world reads "<mini> · Overworld"): the three vanilla worlds by their game names, a name that is already prose as is, a raw id title-cased. */
export function worldLabel(w: WorldLike): string {
  const v = vanilla(w);
  if (w.mini) return `${w.mini} · ${v ? v.label : w.name.trim() || w.id}`;
  if (v) return v.label;
  const name = w.name.trim() || w.id;
  if (!/^[a-z0-9_.-]+(:[a-z0-9_./-]+)?$/.test(name)) return name; // written by a person: keep it
  const bare = name.includes(":") ? name.slice(name.indexOf(":") + 1) : name;
  return bare.replace(/[_./-]+/g, " ").trim().replace(/^./, (c) => c.toUpperCase()) || name;
}

/** Overworld, nether, end, then the rest by `order` and label. A copy; the input is left alone. */
export function sortWorlds<T extends WorldLike>(worlds: readonly T[]): T[] {
  const key = (w: T) => {
    const v = vanilla(w);
    if (w.mini) return { r: 4, o: v?.rank ?? 3, l: w.mini.toLowerCase() }; // mini worlds last, grouped by mini, then area
    return v ? { r: v.rank, o: 0, l: "" } : { r: 3, o: w.order ?? 0, l: worldLabel(w).toLowerCase() };
  };
  return [...worlds].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    return x.r - y.r || (x.r === 4 ? (x.l < y.l ? -1 : x.l > y.l ? 1 : 0) || x.o - y.o : x.o - y.o || (x.l < y.l ? -1 : x.l > y.l ? 1 : 0)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}
