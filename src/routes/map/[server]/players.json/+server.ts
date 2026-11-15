// /map/<server>/players.json (FM-2; brief §4.3, §5.1): the live hub's last snapshot (PlayersSnapshot), for a
// page without EventSource or whose stream failed three times (polled every 5 s), and for "Show on map". Asking
// keeps the server's hub running 30 s longer, so polling it costs cakeutils nothing extra. `state` says whether
// the positions are live, stale (as of `at`) or offline. 404 for a server not on the live map; 503 while no
// answer has ever come.
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { mapApi } from "#lib/server/cakeutils/client.ts";
import { liveHub } from "#lib/server/map/index.ts";
import { validServerId } from "#lib/map/links.ts";

export const GET: RequestHandler = async ({ params }) => {
  const server = params.server;
  const m = mapApi();
  if (!validServerId(server) || !m.serverVisible(server, "live")) error(404, "Not found");
  const index = await m.mapServers();
  if (index.ok && !index.data.servers.some((s) => s.server === server)) error(404, "Not found");
  if (!index.ok && index.kind !== "down" && index.kind !== "rate_limited") error(404, "Not found");
  const snap = await liveHub().snapshot(server);
  if (!snap) {
    return new Response(JSON.stringify({ server, state: "offline" }), {
      status: 503,
      headers: { "content-type": "application/json", "cache-control": "no-store", "retry-after": "5" }
    });
  }
  return new Response(JSON.stringify(snap), { headers: { "content-type": "application/json", "cache-control": "max-age=2" } });
};
