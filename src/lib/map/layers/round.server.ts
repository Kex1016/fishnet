// Server side of a finished One Soul round's map (FM-5, brief §6): the round's layers (the GeoJSON the One Soul
// client already reads) and, only when the round is over and has archived tiles, the worlds to draw them on.
// A running round never gets here with a tile request: `over` is false and nothing below calls the map client.
import type { OneSoulClient } from "#lib/server/onesoul/index.ts";
import { mapApi } from "#lib/server/cakeutils/client.ts";
import { LAYERS, byDimension, toShape, withoutLiving, type DimMap, type LayerId } from "#lib/onesoul/map.ts";
import { roundWorldView } from "../view.ts";
import { validWorldId } from "../links.ts";
import type { MapWorldView } from "../types.ts";
import { webName } from "./onesoul.ts";

export type RoundShapes = { ok: true; maps: DimMap[]; layers: LayerId[]; asOf: number | null; stale: boolean } | { ok: false; maps: DimMap[]; layers: LayerId[]; asOf: null; stale: false };

/** The round's layers as one map per dimension. `living` hides the soul who is playing (a finished round has none). */
export async function roundShapes(c: OneSoulClient, server: string, cycle: number, living: { uuid: string } | null): Promise<RoundShapes> {
  const w = { server, cycle };
  const index = await c.mapIndex(w);
  if (!index.ok) return { ok: false, maps: [], layers: [], asOf: null, stale: false };
  const known = index.data.layers.map((l) => l.id).filter((id): id is LayerId => (LAYERS as readonly string[]).includes(id));
  const answers = await Promise.all(known.map((id) => c.mapLayer(id, w)));
  const shapes = answers.flatMap((r) => (r.ok ? withoutLiving(r.data, living).features : []).map((f) => toShape(f, cycle))).filter((x) => x !== null);
  return { ok: true, maps: byDimension(shapes), layers: known.filter((_, i) => answers[i].ok), asOf: index.asOf, stale: index.stale };
}

export type RoundWorldChoice = { id: string; dim: string; label: string };

/**
 * The tile worlds of a finished round: one per dimension the round has marks or trails in, each only when cakeutils
 * has archived tiles for it. `world` is the one asked for (`?world=`), else the first. null = no tile map (the page
 * keeps today's SVG map).
 */
export async function roundTiles(server: string, cycle: number, maps: DimMap[], over: boolean, world: string | null): Promise<{ worlds: RoundWorldChoice[]; view: MapWorldView; dim: string } | null> {
  if (!over || maps.length === 0) return null;
  const m = mapApi();
  const answers = await Promise.all(maps.map((d) => m.roundMapWorld(cycle, webName(d.dim), server)));
  const worlds: RoundWorldChoice[] = [];
  const views = new Map<string, MapWorldView>();
  maps.forEach((d, i) => {
    const a = answers[i];
    if (!a.ok) return;
    const id = webName(d.dim);
    worlds.push({ id, dim: d.dim, label: d.label });
    views.set(id, roundWorldView(a.data, { name: d.label, dimension: d.dim, order: i }));
  });
  if (worlds.length === 0) return null;
  const pick = (world && validWorldId(world) ? worlds.find((w) => w.id === world) : undefined) ?? worlds[0];
  return { worlds, view: views.get(pick.id)!, dim: pick.dim };
}
