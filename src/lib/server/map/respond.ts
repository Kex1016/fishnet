// The /map/t routes' common answer: the tile service's result as an HTTP response (FM-1). No token, no
// cakeutils URL and no upstream header ever goes into it.
import { tileHeaders, etagMatches, type TileAnswer } from "./tiles.ts";

export function tileResponse(a: TileAnswer, ifNoneMatch: string | null): Response {
  if (a.kind === "tile") {
    const headers = tileHeaders(a);
    if (etagMatches(ifNoneMatch, a.etag)) {
      const { "content-type": _type, ...rest } = headers;
      return new Response(null, { status: 304, headers: rest });
    }
    return new Response(a.png as unknown as BodyInit, { headers });
  }
  if (a.kind === "missing") return new Response(null, { status: 404, headers: { "cache-control": "public, max-age=300", "x-map-cache": "missing" } });
  // cakeutils down or throttling and nothing on disk: the tile layer retries; a pause keeps the browser from hammering
  return new Response(null, { status: 503, headers: { "cache-control": "no-store", "retry-after": String(Math.min(60, Math.max(1, a.retryAfter ?? 10))) } });
}

/** `?v=<epoch>.<seq>`; anything else is ignored (the tile is then served without `immutable`) */
export function versionParam(url: URL): string | null {
  const v = url.searchParams.get("v");
  return v && /^[A-Za-z0-9._:-]{1,64}$/.test(v) ? v : null;
}
