// The map preview (FM-0): every map server and world the client sees, and one world's 3×3 rendered tiles
// at full zoom with the players on it, drawn without Leaflet. Dev and mock only, like /design. Hidden servers
// and players never arrive (mapApi); the preview proves it on the busy fixtures.
import { error } from "@sveltejs/kit";
import { dev } from "$app/env";
import type { PageServerLoad } from "./$types";
import { mapApi } from "#lib/server/cakeutils/client.ts";
import { liveWorldView } from "#lib/map/view.ts";
import type { MapWorldView, PlayerDot } from "#lib/map/types.ts";

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!dev && !locals.mock) error(404, "Not found");
  const m = mapApi();
  const servers = await m.mapServers();
  const list = servers.ok ? servers.data.servers : [];
  const pick = list.find((s) => s.server === url.searchParams.get("server")) ?? list.find((s) => s.live_players) ?? list[0];
  const ref = pick ? (pick.worlds.find((w) => w.id === url.searchParams.get("world")) ?? pick.worlds[0]) : undefined;
  let view: MapWorldView | null = null;
  let players: PlayerDot[] = [];
  let positions: "on" | "off" | "down" = "off";
  if (pick && ref) {
    const [w, changes, live] = await Promise.all([m.mapWorld(pick.server, ref.id), m.mapChanges(pick.server, ref.id), m.mapPlayers(pick.server)]);
    if (w.ok) view = liveWorldView(pick.server, ref, w.data, changes.ok ? changes.data : null);
    if (live.ok) {
      positions = "on";
      players = live.data.players;
    } else positions = live.kind === "off" ? "off" : "down";
  }
  return { title: "Map preview", crumbs: [{ label: "Design", href: "/design" }, { label: "Map" }], servers, pick: pick?.server ?? null, view, players, positions };
};
