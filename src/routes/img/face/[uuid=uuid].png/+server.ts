// Face route (W8): the player's head from Mojang's skin, cropped and cached on the server. Opted-out
// players, unknown UUIDs and any failure get the default head, so a face never breaks a page.
import type { RequestHandler } from "./$types";
import { isHidden } from "#lib/server/hidden.ts";
import { faceService } from "#lib/server/images/index.ts";

// Faces are not real-time: browsers keep a head a day and may show it up to a week while they
// fetch a new one. An old head (Mojang down or throttling, a refresh running) and the redirect to
// the default head are kept an hour, so a new skin or a first fetch shows up soon after.
const FRESH = "public, max-age=86400, stale-while-revalidate=604800";
const SHORT = "public, max-age=3600";

const toDefault = () => new Response(null, { status: 302, headers: { location: "/img/face-default.png", "cache-control": SHORT } });

export const GET: RequestHandler = async ({ params }) => {
  if (isHidden(params.uuid)) return toDefault();
  const r = await faceService().face(params.uuid);
  if (r.kind === "default") return toDefault();
  return new Response(r.png as BodyInit, {
    headers: {
      "content-type": "image/png",
      "cache-control": r.stale ? SHORT : FRESH
    }
  });
};
