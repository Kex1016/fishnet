// /map/<server>/markers.json?world=<id> (FMK-0; brief §4): one world's markers for the page after a `markers` event, a
// world switch and share links. The answer, its headers and the checks before any call are in
// src/lib/server/map/markers.ts. GET only: the site never writes a marker.
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { mapApi } from "#lib/server/cakeutils/client.ts";
import { markersResponse } from "#lib/server/map/markers.ts";

export const GET: RequestHandler = async ({ params, url, request }) => {
  const res = await markersResponse(mapApi(), params.server, url.searchParams.get("world") ?? "", request.headers.get("if-none-match"));
  if (res.status === 404) error(404, "Not found");
  return res;
};
