// The round's map, one per dimension (GET /v2/onesoul/map and its layers). Positions are raw block
// coordinates; the site never shows where the soul who is playing now is or has been. A finished round whose
// worlds have archived tiles (FM-5) is drawn on them; a running round keeps the SVG map and asks for no tile.
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { oneSoul } from "#lib/server/onesoul/index.ts";
import { roundSummaries } from "#lib/server/onesoul/section.ts";
import { roundParam } from "#lib/onesoul/links.ts";
import { viewParam } from "#lib/charts/view.ts";
import { roundShapes, roundTiles } from "#lib/map/layers/round.server.ts";

export const load: PageServerLoad = async ({ parent, url }) => {
  const { os, osFeatures } = await parent();
  if (!os || !osFeatures.map) error(404, "Not found");
  const cycle = Math.min(roundParam(url) ?? os.cycle, os.cycle);
  const c = oneSoul();
  const crumbs = [{ label: "One Soul", href: "/one-soul" }, { label: "Map", href: "/one-soul/map" }];
  const base = { title: `Map, round ${cycle}`, crumbs, cycle, rounds: Array.from({ length: os.cycle }, (_, i) => os.cycle - i), view: viewParam(url) };
  const [st, sums] = await Promise.all([c.status(), roundSummaries(os.server, os.cycle)]);
  const soul = st.ok ? st.data.servers.find((s) => s.server === os.server) : undefined;
  const living = soul?.soul && soul.cycle === cycle ? { uuid: soul.soul.uuid } : null;
  const shapes = await roundShapes(c, os.server, cycle, living);
  if (!shapes.ok) return { ...base, ok: false as const, maps: [], layers: [], asOf: null, tile: null };
  const over = !!sums.rounds.find((r) => r.cycle === cycle)?.ended_at;
  const tile = await roundTiles(os.server, cycle, shapes.maps, over, url.searchParams.get("world"));
  return { ...base, ok: true as const, maps: shapes.maps, layers: shapes.layers, asOf: shapes.asOf, stale: shapes.stale, tile };
};
