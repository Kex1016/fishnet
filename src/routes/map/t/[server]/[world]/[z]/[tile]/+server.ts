// /map/t/<server>/<world>/<z>/<x>_<y>.png?v=<epoch>.<seq> (FM-1): a live tile from the disk cache, revalidated
// behind the answer (brief §4.2). Every part is validated and hidden servers are 404 before any file is read.
import type { RequestHandler } from "./$types";
import { parseTile } from "#lib/map/links.ts";
import { tileService } from "#lib/server/map/index.ts";
import { tileResponse, versionParam } from "#lib/server/map/respond.ts";

export const GET: RequestHandler = async ({ params, request, url }) => {
  const tile = parseTile(params.z, params.tile);
  const inm = request.headers.get("if-none-match");
  if (!tile) return tileResponse({ kind: "missing" }, inm);
  return tileResponse(await tileService().get({ server: params.server, world: params.world, tile }, versionParam(url)), inm);
};
