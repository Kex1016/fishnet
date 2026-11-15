// /map/<server>/live (FM-0 skeleton): the live hub's SSE stream of positions and tile changes is FM-2's
// (brief §4.3; events in #lib/map/types.ts). Until then: 503, so a page falls back like on an outage.
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () =>
  new Response("The live map stream is not built yet (FM-2).", { status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "retry-after": "30" } });
