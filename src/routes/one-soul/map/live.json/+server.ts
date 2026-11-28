// /one-soul/map/live.json (TH-31): the living soul of the round in play, or nobody, for the round map's live dot
// (round-live.server.ts has the rules). 404 where the section has no map.
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { sharedLiveSoul } from "#lib/map/layers/round-live.server.ts";
import { mapApi } from "#lib/server/cakeutils/client.ts";
import { oneSoul, visibleOneSoul } from "#lib/server/onesoul/index.ts";

export const GET: RequestHandler = async () => {
  const body = await sharedLiveSoul(() => ({ os: oneSoul(), map: mapApi(), visible: visibleOneSoul }));
  if (!body) error(404, "Not found");
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json", "cache-control": "public, max-age=2" } });
};
