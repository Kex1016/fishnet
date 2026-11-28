// The round's map, one world at a time, always on squaremap tiles (design §8.1 [David, 2026-11-28]): a finished round
// on its archive, the round in play on the explored area with the living soul's trail and live dot (TH-31). Positions
// are raw block coordinates. When no world has tiles (cakeutils down, the live map off, prep) the page says so and the
// same points are in the table.
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { oneSoul } from "#lib/server/onesoul/index.ts";
import { roundSummaries } from "#lib/server/onesoul/section.ts";
import { roundParam } from "#lib/onesoul/links.ts";
import { viewParam } from "#lib/charts/view.ts";
import { inPlay, roundShapes, roundTiles } from "#lib/map/layers/round.server.ts";

export const load: PageServerLoad = async ({ parent, url }) => {
  const { os, osFeatures } = await parent();
  if (!os || !osFeatures.map) error(404, "Not found");
  const cycle = Math.min(roundParam(url) ?? os.cycle, os.cycle);
  const c = oneSoul();
  const crumbs = [{ label: "One Soul", href: "/one-soul" }, { label: "Map", href: "/one-soul/map" }];
  const base = { title: `Map, round ${cycle}`, crumbs, cycle, rounds: Array.from({ length: os.cycle }, (_, i) => os.cycle - i), view: viewParam(url) };
  const [st, sums] = await Promise.all([c.status(), roundSummaries(os.server, os.cycle)]);
  const soul = st.ok ? st.data.servers.find((s) => s.server === os.server) : undefined;
  const over = !!sums.rounds.find((r) => r.cycle === cycle)?.ended_at;
  const running = !over && inPlay(os, cycle);
  const living = running && soul?.soul && soul.cycle === cycle ? { uuid: soul.soul.uuid } : null;
  const shapes = await roundShapes(c, os.server, cycle, living, over);
  if (!shapes.ok) return { ...base, ok: false as const, maps: [], layers: [], asOf: null, tile: null, running, prep: os.state === "prep" && cycle === os.cycle };
  const tile = await roundTiles(os.server, cycle, shapes.maps, running, url.searchParams.get("world"));
  return { ...base, ok: true as const, maps: shapes.maps, layers: shapes.layers, asOf: shapes.asOf, stale: shapes.stale, tile, running, prep: os.state === "prep" && cycle === os.cycle };
};
