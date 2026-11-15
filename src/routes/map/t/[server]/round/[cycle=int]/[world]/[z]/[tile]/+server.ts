// /map/t/<server>/round/<cycle>/<world>/<z>/<x>_<y>.png (FM-0 skeleton): a finished One Soul round's tile, a
// plain pass-through until FM-1 (disk cache, immutable). Hidden servers are 404 (mapApi).
import type { RequestHandler } from "./$types";
import { mapApi } from "#lib/server/cakeutils/client.ts";
import { parseTile } from "#lib/map/links.ts";
import { tileResponse } from "../../../../../../tile-response.ts";

export const GET: RequestHandler = async ({ params }) => {
  const t = parseTile(params.z, params.tile);
  if (!t) return tileResponse(null);
  return tileResponse(await mapApi().roundMapTile(params.cycle, params.world, t, params.server));
};
