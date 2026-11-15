// /map/t/<server>/<world>/<z>/<x>_<y>.png (FM-0 skeleton): a plain pass-through so the mock and the design
// preview show tiles. FM-1 replaces it with the disk cache, revalidation and the browser headers of brief §4.2.
// Every part is validated before anything is asked; hidden and One Soul servers are 404 (mapApi).
import type { RequestHandler } from "./$types";
import { mapApi } from "#lib/server/cakeutils/client.ts";
import { parseTile } from "#lib/map/links.ts";
import { tileResponse } from "../../../../tile-response.ts";

export const GET: RequestHandler = async ({ params }) => {
  const t = parseTile(params.z, params.tile);
  if (!t) return tileResponse(null);
  return tileResponse(await mapApi().mapTile(params.server, params.world, t));
};
