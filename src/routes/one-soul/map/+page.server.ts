// The round's map, one per dimension (GET /v2/onesoul/map and its layers). Positions are raw block
// coordinates; the site never shows where the soul who is playing now is or has been.
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { oneSoul } from "#lib/server/onesoul/index.ts";
import { roundParam } from "#lib/onesoul/links.ts";
import { LAYERS, byDimension, toShape, withoutLiving, type LayerId } from "#lib/onesoul/map.ts";
import { viewParam } from "#lib/charts/view.ts";

export const load: PageServerLoad = async ({ parent, url }) => {
  const { os, osFeatures } = await parent();
  if (!os || !osFeatures.map) error(404, "Not found");
  const cycle = Math.min(roundParam(url) ?? os.cycle, os.cycle);
  const c = oneSoul();
  const w = { server: os.server, cycle };
  const index = await c.mapIndex(w);
  const crumbs = [{ label: "One Soul", href: "/one-soul" }, { label: "Map", href: "/one-soul/map" }];
  const base = { title: `Map, round ${cycle}`, crumbs, cycle, rounds: Array.from({ length: os.cycle }, (_, i) => os.cycle - i), view: viewParam(url) };
  if (!index.ok) return { ...base, ok: false as const, maps: [], layers: [] as LayerId[], asOf: null };
  const st = await c.status();
  const soul = st.ok ? st.data.servers.find((s) => s.server === os.server) : undefined;
  const living = soul?.soul && soul.cycle === cycle ? { uuid: soul.soul.uuid } : null;
  const known = index.data.layers.map((l) => l.id).filter((id): id is LayerId => (LAYERS as readonly string[]).includes(id));
  const answers = await Promise.all(known.map((id) => c.mapLayer(id, w)));
  const shapes = answers.flatMap((r) => (r.ok ? withoutLiving(r.data, living).features : []).map((f) => toShape(f, cycle))).filter((x) => x !== null);
  return {
    ...base,
    ok: true as const,
    maps: byDimension(shapes),
    layers: known.filter((_, i) => answers[i].ok),
    asOf: index.asOf,
    stale: index.stale
  };
};
