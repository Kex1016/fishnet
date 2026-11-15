// The map preview's live feed (FM-3): one server's players and one world's tile changes, in the shapes the live
// hub will send (PlayersSnapshot, TilesEvent in #lib/map/types.ts). Dev and mock only, like /design; the real
// stream is FM-2's /map/<server>/live. Hidden servers and players never arrive (mapApi).
import { error, json } from "@sveltejs/kit";
import { dev } from "$app/env";
import type { RequestHandler } from "./$types";
import { mapApi } from "#lib/server/cakeutils/client.ts";
import { tileVersion, validServerId, validWorldId } from "#lib/map/links.ts";
import type { PlayersSnapshot, TilesEvent } from "#lib/map/types.ts";

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!dev && !locals.mock) error(404, "Not found");
  const server = url.searchParams.get("server") ?? "";
  const world = url.searchParams.get("world") ?? "";
  if (!validServerId(server) || !validWorldId(world)) error(400, "Bad request");
  const m = mapApi();
  const [live, changes] = await Promise.all([m.mapPlayers(server), m.mapChanges(server, world)]);
  const snapshot: PlayersSnapshot = {
    server,
    at: live.ok ? live.data.updated_at : Date.now(),
    state: live.ok ? "live" : live.kind === "off" || live.kind === "not_found" ? "live" : "offline",
    players: live.ok ? live.data.players.map((p) => ({ uuid: p.uuid, name: p.name, world: p.world, x: Math.floor(p.x), z: Math.floor(p.z), yaw: p.yaw })) : []
  };
  const tiles: TilesEvent | null = changes.ok
    ? { world, epoch: changes.data.epoch, reset: false, tiles: changes.data.tiles.filter((r) => r.length >= 4).map((r) => [tileVersion(changes.data.epoch, r[0]), r[1], r[2], r[3]]) }
    : null;
  return json({ snapshot, tiles }, { headers: { "cache-control": "no-store" } });
};
