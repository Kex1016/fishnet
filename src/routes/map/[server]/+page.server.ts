// /map/<server> (FM-4): one server's map, full bleed. The load returns everything the first paint needs: the server
// list for the popouts, the chosen world's settings and change log, and the first players snapshot, so the page is a
// picture with a working world list and player list before (and without) JavaScript. ?follow= is FM-8's.
// A server that is not on /v2/map (no map, hidden, One Soul, unknown) is a 404 like any page that does not exist.
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { mapApi } from "#lib/server/cakeutils/client.ts";
import { parseMapLink } from "#lib/map/links.ts";
import { pickWorld } from "#lib/map/pages.ts";
import { sortWorlds, worldLabel } from "#lib/map/worlds.ts";
import { liveWorldView } from "#lib/map/view.ts";
import type { MapWorldView, PlayerDot } from "#lib/map/types.ts";

/** Why a server's map cannot be drawn: its backend is down, its squaremap is too old, or it lists no world. */
export type MapProblem = "offline" | "format" | "no_worlds" | "missing";

export const load: PageServerLoad = async ({ params, url }) => {
  const m = mapApi();
  const servers = await m.mapServers();
  const entry = servers.ok ? servers.data.servers.find((s) => s.server === params.server) : undefined;
  if (servers.ok && !entry) error(404, "Not found");
  if (!servers.ok && servers.kind !== "down" && servers.kind !== "rate_limited") error(404, "Not found");
  const name = entry?.display_name ?? params.server;
  const link = parseMapLink(url);
  const base = {
    title: `Map of ${name}`,
    crumbs: [{ label: "Map", href: "/map" }, { label: name }],
    server: params.server,
    name,
    link,
    /** cakeutils could not be reached: what follows is the last good answer, or nothing */
    down: !servers.ok,
    asOf: servers.ok ? servers.asOf : (servers.asOf ?? null),
    stale: servers.ok && servers.stale,
    /** every server with a map, for the server switch (names are plain text) */
    others: servers.ok ? servers.data.servers.map((s) => ({ server: s.server, name: s.display_name })) : [],
    worlds: [] as { id: string; name: string; dimension: string | null; mini: string | null; miniName: string | null }[],
    view: null as MapWorldView | null,
    players: [] as PlayerDot[],
    positions: "off" as "on" | "off" | "down",
    pollMs: 2000,
    problem: null as MapProblem | null
  };
  if (!entry) return { ...base, problem: "offline" as MapProblem };

  const worlds = sortWorlds(entry.worlds);
  base.worlds = worlds.map((w) => ({ id: w.id, name: worldLabel(w), dimension: w.dimension, mini: w.mini ?? null, miniName: w.mini ? w.name.trim() || w.mini : null }));
  const ref = pickWorld(worlds, link.world);
  if (!ref) return { ...base, problem: "no_worlds" as MapProblem };

  const wantPositions = entry.live_players;
  const [w, changes, live] = await Promise.all([m.mapWorld(entry.server, ref.id), m.mapChanges(entry.server, ref.id), wantPositions ? m.mapPlayers(entry.server) : Promise.resolve(null)]);
  if (!w.ok) return { ...base, problem: (w.kind === "off" ? "format" : w.kind === "not_found" ? "missing" : "offline") as MapProblem };

  let positions: "on" | "off" | "down" = wantPositions ? "down" : "off";
  let players: PlayerDot[] = [];
  if (live?.ok) {
    positions = "on";
    players = live.data.players.map((p) => ({ uuid: p.uuid, name: p.name, world: p.world, x: Math.floor(p.x), z: Math.floor(p.z), yaw: p.yaw }));
  } else if (live && live.kind === "off") positions = "off";
  return {
    ...base,
    view: liveWorldView(entry.server, { ...ref, name: worldLabel(ref) }, w.data, changes.ok ? changes.data : null),
    players,
    positions,
    pollMs: Math.max(2000, w.data.player_update_ms) // the live hub's interval (brief §4.3)
  };
};
