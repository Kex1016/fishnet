// The One Soul layers of a round's map (FM-5, brief §6; the round in play too since TH-31): the existing GeoJSON, already turned into
// marks and paths by #lib/onesoul/map.ts (raw block coordinates, x east, z south), sorted into one layer per
// kind for the world shown. Nothing is projected here: MapCanvas puts a block where the tiles put it (crs.ts).
// Each layer has its own shape, so the toggles and the marks never rely on colour alone (brief §5).
import type { DimMap, Mark } from "#lib/onesoul/map.ts";
import type { LayerData, LayerShape, MapLayer } from "../types.ts";

export type RoundLayerDef = { id: string; label: string; shape: LayerShape; kind: Mark["kind"] | "trail" };

/** Order of the toggles. Unknown mark kinds ("other") get a layer of their own, last, so nothing is dropped. */
export const ROUND_LAYERS: readonly RoundLayerDef[] = [
  { id: "trails", label: "Trails", shape: "line", kind: "trail" },
  { id: "deaths", label: "Deaths", shape: "cross", kind: "death" },
  { id: "graves", label: "Graves", shape: "square", kind: "grave" },
  { id: "waystones", label: "Waystones", shape: "diamond", kind: "waystone" },
  { id: "spawn", label: "Spawn", shape: "circle", kind: "spawn" },
  // design §8.1, finished rounds only: their own glyphs on top of the shape (RoundMap.svelte, by data-layer)
  { id: "portals", label: "Stable portals", shape: "square", kind: "portal" },
  { id: "end-portals", label: "End portals", shape: "triangle", kind: "end_portal" },
  { id: "other", label: "Other points", shape: "triangle", kind: "other" }
];

/** A web name ("minecraft_the_nether") for a dimension id: the round routes replace ":" with "_" (brief §2). */
export function webName(dim: string): string {
  return dim.replace(":", "_");
}

/** The dimension a round world shows, found among the dimensions the round has data for (never reversed blindly). */
export function dimOfWorld(world: string, dims: readonly string[]): string | null {
  return dims.find((d) => webName(d) === world) ?? null;
}

/** One layer per kind for one dimension; a layer with nothing in this world is left out (no empty toggle). */
export function roundLayers(map: DimMap | undefined, on: Record<string, boolean> = {}): MapLayer[] {
  if (!map) return [];
  const out: MapLayer[] = [];
  for (const def of ROUND_LAYERS) {
    const data: LayerData =
      def.kind === "trail" ? { marks: [], paths: map.paths } : { marks: map.marks.filter((m) => m.kind === def.kind), paths: [] };
    if (data.marks.length === 0 && data.paths.length === 0) continue;
    out.push({ id: def.id, label: def.label, shape: def.shape, on: on[def.id] ?? true, data });
  }
  return out;
}

/** How many things a layer draws, for its toggle ("3"). */
export function layerCount(l: MapLayer): number {
  return l.count ?? l.data.marks.length + l.data.paths.length;
}

/** Is this round the one in play (started, not over)? The status' state is the section's (layout) view of it (TH-31). */
export function inPlay(os: { cycle: number; state: string }, cycle: number): boolean {
  return cycle === os.cycle && os.state !== "prep" && os.state !== "ended";
}
