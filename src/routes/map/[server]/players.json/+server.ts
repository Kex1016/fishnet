// /map/<server>/players.json (FM-0 skeleton): the hub's last snapshot (PlayersSnapshot in #lib/map/types.ts),
// FM-2's. Until then: 503.
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () =>
  new Response(JSON.stringify({ error: "not built yet (FM-2)" }), { status: 503, headers: { "content-type": "application/json", "cache-control": "no-store", "retry-after": "30" } });
