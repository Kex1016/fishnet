// The markers.json answer (FMK-0; brief §4), apart from the route so it runs in tests without SvelteKit: one world's
// markers as cakeutils sends them (MapMarkers; it serves no private field). Read-only: the route has no other method.
//
// Before anything leaves the site: `world` must match the world-id grammar (links.ts) and the server must be visible on
// the live map (not hidden, not One Soul), else 404 with no request to cakeutils. A world cakeutils does not know (no
// map, a private mini-server, a standalone server) is the same 404: the page draws nothing. `Cache-Control: private,
// max-age=15`; the ETag is cakeutils' (`"m<rev>"`, derived from `rev`) and `If-None-Match` gets a 304 with no body.
// While cakeutils is down the last good list is sent as it is with `x-as-of` (epoch ms) and `x-stale: 1`: never a
// 304 (the page must learn that it is old), for 5 s only; with nothing kept: 503 and `retry-after`.
import { validServerId, validWorldId } from "#lib/map/links.ts";
import type { MapClient } from "../cakeutils/map.ts";

/** `If-None-Match`: `*`, or a list of tags (weak ones compare equal) that holds ours. */
export function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === "*") return true;
  return header.split(",").some((t) => t.trim().replace(/^W\//, "") === etag);
}

/** The ETag cakeutils sends for a world at `rev` (MARKERS §3.4). */
export const markersEtag = (rev: number) => `"m${rev}"`;

/** The route's answer; a 404 is a plain `Response` here, the route turns it into SvelteKit's not-found. */
export async function markersResponse(m: MapClient, server: string, world: string, ifNoneMatch: string | null): Promise<Response> {
  const notFound = () => new Response(null, { status: 404 });
  if (!validServerId(server) || !validWorldId(world) || !m.serverVisible(server, "live")) return notFound();
  const r = await m.markers(server, world);
  if (!r.ok) {
    if (r.kind === "not_found" || r.kind === "off" || r.kind === "bad_request") return notFound();
    return new Response(JSON.stringify({ server, world, state: "down" }), {
      status: 503,
      headers: { "content-type": "application/json", "cache-control": "no-store", "retry-after": String(Math.max(1, Math.min(60, r.retryAfter ?? 5))) }
    });
  }
  const etag = markersEtag(r.data.rev);
  if (!r.stale && etagMatches(ifNoneMatch, etag)) return new Response(null, { status: 304, headers: { etag, "cache-control": "private, max-age=15" } });
  const headers: Record<string, string> = { "content-type": "application/json", etag, "cache-control": r.stale ? "private, max-age=5" : "private, max-age=15" };
  if (r.stale) {
    headers["x-stale"] = "1";
    headers["x-as-of"] = String(r.asOf);
  }
  return new Response(JSON.stringify(r.data), { headers });
}
