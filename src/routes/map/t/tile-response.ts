// The skeleton tile routes' answer (FM-0); FM-1 replaces both routes and this file.
import type { Result } from "#lib/api/result.ts";
import type { MapTile } from "#lib/server/cakeutils/map.ts";

export function tileResponse(r: Result<MapTile> | null): Response {
  if (r?.ok && r.data.png) {
    return new Response(r.data.png as unknown as BodyInit, { headers: { "content-type": "image/png", "cache-control": "public, max-age=60", "x-content-type-options": "nosniff" } });
  }
  const missing = !r || (!r.ok && (r.kind === "not_found" || r.kind === "off"));
  return new Response(null, { status: missing ? 404 : 503, headers: { "cache-control": missing ? "public, max-age=300" : "no-store" } });
}
