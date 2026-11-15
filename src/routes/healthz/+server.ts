// For Docker's HEALTHCHECK and the watcher (PLAN §3.4): 200 whenever the site answers. It never
// depends on cakeutils (the site serves last good data when cakeutils is down), but it says what the
// client knows about it, so `curl /healthz` on the host shows an outage or a rate limit at a glance.
// Nothing here is secret: no URL, no token, and the last error is already scrubbed by the client.
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { apiStatus } from "#lib/server/cakeutils/client.ts";
import { history } from "#lib/server/history.ts";
import { faceService } from "#lib/server/images/index.ts";
import { config } from "#lib/server/env.ts";
import { liveHub } from "#lib/server/map/index.ts";

const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString());

export const GET: RequestHandler = async ({ locals }) => {
  const s = apiStatus();
  const recordingSince = await history().recordingSince();
  const f = faceService().stats();
  const live = liveHub().stats();
  return json(
    {
      status: "ok",
      mock: locals.mock ?? null,
      cakeutils: {
        reachable: s.reachable,
        downSince: iso(s.downSince),
        lastOkAt: iso(s.lastOkAt),
        rateLimitedUntil: iso(s.rateLimitedUntil),
        lastError: s.lastError,
        // rejections by source: cakeutils' own 429s vs. the site's bucket turning a page away first
        throttle: { ...s.throttle, last429At: iso(s.throttle.last429At) }
      },
      // Mojang's skin lookups (the other place a 429 can come from)
      faces: { ...f, last429At: iso(f.last429At), backoffUntil: iso(f.backoffUntil) },
      cache: s.cache,
      // the live map's streams against MAP_SSE_MAX (numbers only: no server, no player, no address)
      map: { streams: live.streams, maxStreams: config().mapSseMax, polling: live.hubs.filter((h) => h.polling).length },
      recordingSince: iso(recordingSince)
    },
    { headers: { "cache-control": "no-store" } }
  );
};
