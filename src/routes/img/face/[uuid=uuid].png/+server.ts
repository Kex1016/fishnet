// Face route (W8): the player's head from Mojang's skin, cropped and cached on the server. Opted-out
// players, unknown UUIDs and any failure get the default head, so a face never breaks a page.
import type { RequestHandler } from "./$types";
import { isHidden } from "#lib/server/hidden.ts";
import { faceService } from "#lib/server/images/index.ts";

const toDefault = () =>
  new Response(null, { status: 302, headers: { location: "/img/face-default.png", "cache-control": "public, max-age=300" } });

export const GET: RequestHandler = async ({ params }) => {
  if (isHidden(params.uuid)) return toDefault();
  const r = await faceService().face(params.uuid);
  if (r.kind === "default") return toDefault();
  return new Response(r.png as BodyInit, {
    headers: {
      "content-type": "image/png",
      "cache-control": r.stale ? "public, max-age=300" : "public, max-age=3600, stale-while-revalidate=86400"
    }
  });
};
