// Icon proxy (W8): cakeutils' PNG by sha256, kept on disk, immutable for visitors.
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { iconService } from "#lib/server/images/index.ts";

export const GET: RequestHandler = async ({ params, request, setHeaders }) => {
  const etag = `"${params.sha}"`;
  const immutable = { "cache-control": "public, max-age=31536000, immutable", etag };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: immutable });
  const r = await iconService().icon(params.sha);
  if (r.kind === "missing") {
    setHeaders({ "cache-control": "public, max-age=3600" });
    error(404, "No such icon");
  }
  if (r.kind === "unavailable") {
    // cakeutils down or throttling: a short browser cache, so a page full of icons does not ask again on every view
    setHeaders({ "cache-control": "public, max-age=60", "retry-after": "60" });
    error(503, "Icons are unavailable");
  }
  return new Response(r.png as BodyInit, { headers: { ...immutable, "content-type": "image/png" } });
};
