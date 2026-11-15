// Builds the frozen MapWorldView (types.ts) from cakeutils' answers (FM-0). Pure: the pages' server loads
// call it, MapCanvas only reads the result.
import type { MapChanges, MapWorld, MapWorldRef, RoundMapWorld } from "#lib/api/types.ts";
import { roundTileTemplate, tileTemplate } from "./links.ts";
import type { MapWorldView } from "./types.ts";

/** A live world: its /v2/map entry, its settings and (when it has one) its change log. */
export function liveWorldView(server: string, ref: MapWorldRef, w: MapWorld, changes: MapChanges | null): MapWorldView {
  const versions: Record<string, number> = {};
  if (changes) for (const row of changes.tiles) if (row.length >= 4) versions[`${row[1]}/${row[2]}/${row[3]}`] = row[0];
  return {
    server,
    id: ref.id,
    name: ref.name,
    dimension: ref.dimension,
    order: ref.order,
    cycle: null,
    tileSize: 512,
    zoom: { min: 0, max: w.zoom.max, default: w.zoom.default, extra: w.zoom.extra },
    spawn: { x: w.spawn.x, z: w.spawn.z },
    tiles: { template: tileTemplate(server, ref.id), epoch: changes?.epoch ?? null, versions, frozen: false },
    updatedAt: w.updated_at
  };
}

/**
 * A finished One Soul round's world: frozen tiles, no live events. The caller names it (the site's label of the
 * dimension) and gives the dimension id from the round's `dims` (a web name cannot be turned back reliably:
 * namespaces may hold "_").
 */
export function roundWorldView(w: RoundMapWorld, ref: { name: string; dimension: string | null; order: number }): MapWorldView {
  return {
    server: w.server,
    id: w.world,
    name: ref.name,
    dimension: ref.dimension,
    order: ref.order,
    cycle: w.cycle,
    tileSize: 512,
    zoom: { min: 0, max: w.zoom.max, default: w.zoom.default, extra: w.zoom.extra },
    spawn: { x: w.spawn.x, z: w.spawn.z },
    tiles: { template: roundTileTemplate(w.server, w.cycle, w.world), epoch: null, versions: {}, frozen: true },
    updatedAt: w.updated_at
  };
}

/** Blocks one tile covers at zoom `z` (MAP §5.2): 512 · 2^(max − z). */
export function tileSpan(max: number, z: number): number {
  return 512 * 2 ** (max - z);
}

/** The tile (at zoom `z`) that holds block (x, z). */
export function tileOf(max: number, z: number, block: { x: number; z: number }): { z: number; x: number; y: number } {
  const S = tileSpan(max, z);
  return { z, x: Math.floor(block.x / S), y: Math.floor(block.z / S) };
}
