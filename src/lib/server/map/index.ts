// The configured tile service the /map/t routes use (FM-1): the disk cache lives under FISHNET_DATA_DIR/map
// (map-mock-<scenario> in mock mode, so fixture tiles never mix with real ones), the picture comes from the map
// client (its own bucket, hidden servers refused), the cap is MAP_CACHE_MAX_MB.
import { join } from "node:path";
import { mapApi } from "../cakeutils/client.ts";
import { config } from "../env.ts";
import { createTileService, type TileService } from "./tiles.ts";

let service: TileService | null = null;

export function tileService(): TileService {
  if (service) return service;
  const c = config();
  const m = mapApi();
  return (service = createTileService({
    dir: join(c.dataDir, c.mock ? `map-mock-${c.mock}` : "map"),
    maxBytes: c.mapCacheMaxBytes,
    visible: (server, scope) => m.serverVisible(server, scope),
    source: (ref, o) => (ref.round !== undefined ? m.roundMapTile(ref.round, ref.world, ref.tile, ref.server, o) : m.mapTile(ref.server, ref.world, ref.tile, o))
  }));
}
