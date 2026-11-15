// /map/t/<server>/round/<cycle>/<world>/<z>/<x>_<y>.png (FM-1): a finished One Soul round's tile. It never
// changes, so it is kept on disk without a revalidation and the browser keeps it for a year.
import type { RequestHandler } from "./$types";
import { parseTile } from "#lib/map/links.ts";
import { tileService } from "#lib/server/map/index.ts";
import { tileResponse } from "#lib/server/map/respond.ts";

export const GET: RequestHandler = async ({ params, request }) => {
  const tile = parseTile(params.z, params.tile);
  const inm = request.headers.get("if-none-match");
  if (!tile) return tileResponse({ kind: "missing" }, inm);
  return tileResponse(await tileService().get({ server: params.server, world: params.world, tile, round: Number(params.cycle) }), inm);
};
