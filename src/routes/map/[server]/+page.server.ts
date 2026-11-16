// /map/<server> (FM-4): one server's map, full bleed. The load returns everything the first paint needs: the server
// list for the popouts, the chosen world's settings and change log, and the first players snapshot, so the page is a
// picture with a working world list and player list before (and without) JavaScript. ?follow= (FM-8) opens the followed player's world, centred on them.
// The opening world's markers (FMK-0) ride along with the rest so the Places popout renders without JS and the canvas draws at
// once; `markers` is a MarkersLoad (markers/types.ts): `none` for a world that cannot have any, `down` when cakeutils is
// unreachable and nothing good is kept. A hidden server never gets this far (404 above), so none of its markers load.
// `?marker=<id>` (FMK-2, brief §5.5) opens the map on that marker: the load asks the markers of each listed world, the
// link's own world first, until one holds the id (at most the server's worlds), and opens that world; an id nobody holds
// is `markerMissing` (a Notice, the map opens normally). `uni` = Unifont metrics for the titles that need them.
// A server that is not on /v2/map (no map, hidden, One Soul, unknown) is a 404 like any page that does not exist.
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api, mapApi } from "#lib/server/cakeutils/client.ts";
import { isHidden } from "#lib/server/hidden.ts";
import { showHref, type FollowNote } from "#lib/map/showOnMap.ts";
import { parseMapLink } from "#lib/map/links.ts";
import { pickWorld } from "#lib/map/pages.ts";
import { sortWorlds, worldLabel } from "#lib/map/worlds.ts";
import { liveWorldView } from "#lib/map/view.ts";
import type { MapWorldView, PlayerDot } from "#lib/map/types.ts";
import type { MarkersLoad } from "#lib/map/markers/types.ts";
import type { Result } from "#lib/api/result.ts";
import type { MapMarkers } from "#lib/api/types.ts";
import { unifontFor } from "#lib/server/onesoul/unifont.ts";
import type { Uni } from "#lib/onesoul/book/layout.ts";

/** Why a server's map cannot be drawn: its backend is down, its squaremap is too old, or it lists no world. */
export type MapProblem = "offline" | "format" | "no_worlds" | "missing";

export const load: PageServerLoad = async ({ params, url }) => {
  const m = mapApi();
  const servers = await m.mapServers();
  const entry = servers.ok ? servers.data.servers.find((s) => s.server === params.server) : undefined;
  if (servers.ok && !entry) error(404, "Not found");
  if (!servers.ok && servers.kind !== "down" && servers.kind !== "rate_limited") error(404, "Not found");
  const name = entry?.display_name ?? params.server;
  let link = parseMapLink(url);
  // a hidden player is never followed, and the page does not say that they exist (PLAN §8.5)
  if (link.follow && isHidden(link.follow)) link = { ...link, follow: null };
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
    /** the opening world's markers; `none` until a world is chosen */
    markers: noMarkers(null),
    /** Unifont metrics for the markers' titles outside the bitmap sheets (the Minecraft-font labels) */
    uni: {} as Uni,
    /** the marker the link opens (found in the opening world), and whether the view should fit it (the link has no x/z) */
    markerId: null as number | null,
    markerFit: false,
    /** the link names a marker that no world of this server holds any more */
    markerMissing: false,
    problem: null as MapProblem | null,
    /** the player the link asks to follow, when they are on this map; the page starts following them */
    follow: null as string | null,
    /** the link asked to follow someone who is not here: why, and where they are instead */
    followNote: null as FollowNote | null
  };
  if (!entry) return { ...base, problem: "offline" as MapProblem };

  const worlds = sortWorlds(entry.worlds);
  base.worlds = worlds.map((w) => ({ id: w.id, name: worldLabel(w), dimension: w.dimension, mini: w.mini ?? null, miniName: w.mini ? w.name.trim() || w.mini : null }));
  const wantPositions = entry.live_players;
  // the snapshot first: a followed player decides the world and the centre (FM-8)
  const live = wantPositions ? await m.mapPlayers(entry.server) : null;
  const target = link.follow && live?.ok ? live.data.players.find((p) => p.uuid === link.follow) : undefined;
  if (target) {
    // the link's own world wins when the server lists it (a world switch sets it, and the live feed may be ahead of the
    // snapshot); otherwise the player's world. Centre on them only when that is where they are.
    const asked = link.world && worlds.some((w) => w.id === link.world) ? link.world : undefined;
    const world = asked ?? (worlds.some((w) => w.id === target.world) ? target.world : undefined);
    link = world === target.world ? { ...link, world, x: Math.floor(target.x), z: Math.floor(target.z) } : world ? { ...link, world } : link;
    base.follow = target.uuid;
  } else if (link.follow) {
    base.followNote = await followNote(entry, link.follow, wantPositions && !live?.ok ? "down" : wantPositions ? "absent" : "off");
    // nobody the network knows: the follow leaves the link, exactly as it does for a hidden player above, so the
    // page answers the same for "hidden" and "never existed" (FM-7: the share link must not tell them apart)
    if (!base.followNote) link = { ...link, follow: null };
  }
  base.link = link;
  let ref = pickWorld(worlds, link.world);
  if (!ref) return { ...base, problem: "no_worlds" as MapProblem };

  // ?marker=<id>: the world that holds it (the link's world first), else the link forgets it
  let markerId: number | null = null;
  let markerMissing = false;
  let markerFit = false;
  if (link.marker !== undefined) {
    const want = link.marker;
    const order = [ref, ...worlds.filter((x) => x.id !== ref!.id)];
    let found: (typeof worlds)[number] | null = null;
    for (const cand of order) {
      const r = await m.markers(entry.server, cand.id);
      if (r.ok && r.data.markers.some((x) => x.id === want)) {
        found = cand;
        break;
      }
    }
    if (found) {
      markerId = want;
      if (found.id !== ref.id) {
        // another world: the link's coordinates belonged to the first one
        link = { world: found.id, marker: want, ...(link.follow ? { follow: link.follow } : {}) };
        ref = found;
      }
      markerFit = link.x === undefined;
    } else {
      markerMissing = true;
      const { marker: _gone, ...rest } = link;
      link = rest;
    }
    base.link = link;
  }

  const [w, changes, markers] = await Promise.all([m.mapWorld(entry.server, ref.id), m.mapChanges(entry.server, ref.id), m.markers(entry.server, ref.id)]);
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
    markers: markersLoad(ref.id, markers),
    uni: markers.ok ? unifontFor(markers.data.markers.map((x) => x.title)) : ({} as Uni),
    markerId,
    markerFit,
    markerMissing,
    pollMs: Math.max(2000, w.data.player_update_ms) // the live hub's interval (brief §4.3)
  };
};

/** Why `uuid` is not on this map and where they are instead: their profile says (online, server), the map's list says
 *  which servers can show them. Names are plain text. */
async function followNote(entry: { server: string; display_name: string }, uuid: string, why: "off" | "absent" | "down"): Promise<FollowNote | null> {
  const p = await api().player(uuid);
  if (!p.ok) return null; // nothing to say about someone the network does not know
  const name = p.data.name;
  if (!p.data.online) return { name, elsewhere: null, reason: "offline" };
  const there = p.data.server && p.data.server !== entry.server ? p.data.server : null;
  if (there) {
    const list = await mapApi().mapServers();
    const s = list.ok ? list.data.servers.find((x) => x.server === there && x.live_players) : undefined;
    if (s) return { name, elsewhere: { server: s.server, name: s.display_name, href: showHref(s.server, uuid) }, reason: "elsewhere" };
  }
  return { name, elsewhere: null, reason: why === "off" ? "positions_off" : "not_visible" };
}

function noMarkers(world: string | null, state: "none" | "down" = "none"): MarkersLoad {
  return { world, state, rev: 0, markers: [], asOf: null, stale: false };
}

/** A markers answer as the page keeps it: not_found/off = "no markers can be here" (no error), anything else = down. */
function markersLoad(world: string, r: Result<MapMarkers>): MarkersLoad {
  if (r.ok) return { world, state: "ok", rev: r.data.rev, markers: r.data.markers, asOf: r.asOf, stale: r.stale };
  return noMarkers(world, r.kind === "not_found" || r.kind === "off" || r.kind === "bad_request" ? "none" : "down");
}
