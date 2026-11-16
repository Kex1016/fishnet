// The configured tile service the /map/t routes use (FM-1): the disk cache lives under FISHNET_DATA_DIR/map
// (map-mock-<scenario> in mock mode, so fixture tiles never mix with real ones), the picture comes from the map
// client (its own bucket, hidden servers refused), the cap is MAP_CACHE_MAX_MB.
import { join } from "node:path";
import { mapApi } from "../cakeutils/client.ts";
import { config } from "../env.ts";
import { createTileService, type TileService } from "./tiles.ts";
import { createLiveHub, type LiveHub } from "./live.ts";
import { hiddenPlayers } from "../hidden.ts";
import type { HiddenList } from "../hidden-list.ts";
import { worldOf } from "../cakeutils/mock/index.ts";
import { mockMapHidden } from "../cakeutils/mock/map.ts";

let service: TileService | null = null;

export function tileService(): TileService {
  if (service) return service;
  const c = config();
  const m = mapApi();
  return (service = createTileService({
    dir: join(c.dataDir, c.mock ? `map-mock-${c.mock}` : "map"),
    maxBytes: c.mapCacheMaxBytes,
    listed: async () => {
      const r = await m.mapServers();
      if (!r.ok || r.stale) return null;
      return new Map(r.data.servers.map((s) => [s.server, new Set(s.worlds.map((w) => w.id))]));
    },
    visible: (server, scope) => m.serverVisible(server, scope),
    source: (ref, o) => (ref.round !== undefined ? m.roundMapTile(ref.round, ref.world, ref.tile, ref.server, o) : m.mapTile(ref.server, ref.world, ref.tile, o))
  }));
}

// ---- the live hub (FM-2): one poller per server behind /map/<server>/live and players.json

let hub: LiveHub | null = null;

/** squaremap's player update interval of a server: the largest over its worlds (all through the LRU). */
async function playerUpdateMs(server: string): Promise<number | null> {
  const m = mapApi();
  const index = await m.mapServers();
  const entry = index.ok ? index.data.servers.find((s) => s.server === server) : undefined;
  if (!entry) return null;
  const ms = await Promise.all(entry.worlds.map(async (w) => {
    const r = await m.mapWorld(server, w.id);
    return r.ok ? r.data.player_update_ms : null;
  }));
  const known = ms.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  return known.length ? Math.max(...known) : null;
}

export function liveHub(): LiveHub {
  if (hub) return hub;
  const c = config();
  const m = mapApi();
  const extra = c.mock ? mockMapHidden(worldOf(c.mock)).players : [];
  let memo: { from: HiddenList; to: HiddenList } | null = null;
  const players = (): HiddenList => {
    const from = hiddenPlayers();
    if (!extra.length) return from;
    if (memo?.from !== from) memo = { from, to: from.with(extra) };
    return memo.to;
  };
  return (hub = createLiveHub({
    players: (server) => m.mapPlayers(server, { priority: "background" }),
    changes: (server, world) => m.mapChanges(server, world, { priority: "background" }),
    markers: (server, world) => m.markers(server, world, { priority: "background" }),
    playerUpdateMs,
    worlds: async (server) => {
      const r = await m.mapServers();
      if (!r.ok) return null;
      const entry = r.data.servers.find((s) => s.server === server);
      return new Set(entry ? entry.worlds.map((w) => w.id) : []);
    },
    visible: (server) => m.serverVisible(server, "live"),
    hiddenPlayer: (p) => players().hasPlayer(p),
    limits: { total: c.mapSseMax },
    log: (line) => console.info(line)
  }));
}
