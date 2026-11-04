// W0 stub of the icon proxy (W8 adds the disk cache and the fallback): the API's PNG, immutable.
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";

export const GET: RequestHandler = async ({ params, setHeaders }) => {
  const r = await api().icon(params.sha);
  if (!r.ok) error(r.kind === "not_found" ? 404 : 503, r.kind === "not_found" ? "No such icon" : "Icons are unavailable");
  setHeaders({ "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable", etag: `"${params.sha}"` });
  return new Response(r.data.png as BodyInit);
};
