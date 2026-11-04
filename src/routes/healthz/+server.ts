// For Docker's HEALTHCHECK and the watcher (PLAN §3.4): 200 whenever the site answers. It never
// depends on cakeutils (the site serves last good data when cakeutils is down), but it says what the
// client knows about it, so `curl /healthz` on the host shows an outage or a rate limit at a glance.
// Nothing here is secret: no URL, no token, and the last error is already scrubbed by the client.
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { apiStatus } from "#lib/server/cakeutils/client.ts";
import { history } from "#lib/server/history.ts";

const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString());

export const GET: RequestHandler = async ({ locals }) => {
  const s = apiStatus();
  const recordingSince = await history().recordingSince();
  return json(
    {
      status: "ok",
      mock: locals.mock ?? null,
      cakeutils: {
        reachable: s.reachable,
        downSince: iso(s.downSince),
        lastOkAt: iso(s.lastOkAt),
        rateLimitedUntil: iso(s.rateLimitedUntil),
        lastError: s.lastError
      },
      cache: s.cache,
      recordingSince: iso(recordingSince)
    },
    { headers: { "cache-control": "no-store" } }
  );
};
