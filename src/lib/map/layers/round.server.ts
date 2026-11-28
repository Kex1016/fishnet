// Server side of a One Soul round's map (FM-5, brief §6; TH-31, design §8.1): the round's layers (the GeoJSON the One
// Soul client already reads), the landmarks of a finished round, and the worlds to draw them on. Every One Soul map is
// on squaremap tiles [David, 2026-11-28]: a finished round's archive, or the round in play's explored area (cakeutils
// MAPD-77), which changes as the soul explores and is revalidated in the browser like a live world.
import type { OneSoulClient } from "#lib/server/onesoul/index.ts";
import { mapApi } from "#lib/server/cakeutils/client.ts";
import { LAYERS, byDimension, landmarkMarks, toShape, withoutLiving, type DimMap, type LayerId, type Mark, type Path } from "#lib/onesoul/map.ts";
import { dimLabel } from "#lib/onesoul/format.ts";
import { roundWorldView } from "../view.ts";
import { validWorldId } from "../links.ts";
import type { MapWorldView } from "../types.ts";
import { webName } from "./onesoul.ts";
export { inPlay } from "./onesoul.ts";

export type RoundShapes = { ok: true; maps: DimMap[]; layers: LayerId[]; asOf: number | null; stale: boolean } | { ok: false; maps: DimMap[]; layers: LayerId[]; asOf: null; stale: false };

/** The worlds a round may have tiles in even where nothing is marked yet (the living soul walks there). */
export const VANILLA_DIMS = ["minecraft:overworld", "minecraft:the_nether", "minecraft:the_end"] as const;

/**
 * The round's layers as one map per dimension. `living` is the soul who plays now (null for a finished round): their
 * trail is drawn, their deaths are not. `over`: a finished round also gets its stable portals and End portals.
 */
export async function roundShapes(c: OneSoulClient, server: string, cycle: number, living: { uuid: string } | null, over = living === null): Promise<RoundShapes> {
  const w = { server, cycle };
  const [index, events] = await Promise.all([c.mapIndex(w), over ? c.events({ ...w, kind: "rift_stable,end_opened", limit: 100 }) : Promise.resolve(null)]);
  if (!index.ok) return { ok: false, maps: [], layers: [], asOf: null, stale: false };
  const known = index.data.layers.map((l) => l.id).filter((id): id is LayerId => (LAYERS as readonly string[]).includes(id));
  const answers = await Promise.all(known.map((id) => c.mapLayer(id, w)));
  const shapes: (Mark | Path)[] = answers.flatMap((r) => (r.ok ? withoutLiving(r.data, living).features : []).map((f) => toShape(f, cycle))).filter((x) => x !== null);
  if (events?.ok) shapes.push(...landmarkMarks(events.data.events, cycle, over));
  return { ok: true, maps: byDimension(shapes), layers: known.filter((_, i) => answers[i].ok), asOf: index.asOf, stale: index.stale };
}

export type RoundWorldChoice = { id: string; dim: string; label: string };
export type RoundTiles = { worlds: RoundWorldChoice[]; view: MapWorldView; dim: string; running: boolean };

/**
 * The tile worlds of a round: one per dimension the round has marks or trails in, plus `also` (the vanilla worlds for
 * the round in play, where the soul may be before anything is marked), each only when cakeutils answers for it.
 * `world` is the one asked for (`?world=`), else the first. null = no tiles at all (cakeutils down, the map off, or
 * the round not started): the page says so and keeps the table.
 */
export async function roundTiles(server: string, cycle: number, maps: DimMap[], running: boolean, world: string | null, also: readonly string[] = running ? VANILLA_DIMS : []): Promise<RoundTiles | null> {
  const dims = [...maps.map((d) => d.dim), ...also.filter((d) => !maps.some((m) => m.dim === d))];
  if (dims.length === 0) return null;
  const m = mapApi();
  const answers = await Promise.all(dims.map((d) => (validWorldId(webName(d)) ? m.roundMapWorld(cycle, webName(d), server) : Promise.resolve(null))));
  const worlds: RoundWorldChoice[] = [];
  const views = new Map<string, MapWorldView>();
  dims.forEach((dim, i) => {
    const a = answers[i];
    if (!a?.ok) return;
    const id = webName(dim);
    const label = maps.find((d) => d.dim === dim)?.label ?? dimLabel(dim);
    worlds.push({ id, dim, label });
    const v = roundWorldView(a.data, { name: label, dimension: dim, order: i });
    // the round in play's tiles change: the browser revalidates the ones in view once a minute (map/tiles.ts)
    views.set(id, running ? { ...v, tiles: { ...v.tiles, frozen: false } } : v);
  });
  if (worlds.length === 0) return null;
  const pick = (world && validWorldId(world) ? worlds.find((w) => w.id === world) : undefined) ?? worlds[0];
  return { worlds, view: views.get(pick.id)!, dim: pick.dim, running };
}
