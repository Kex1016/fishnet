// Skin route (FDC-1): the player's full-body render from Mojang's skin, drawn and cached on the server, for the
// Discord cards. Hidden players, Floodgate and offline UUIDs, unknown UUIDs and any failure get the default Steve
// or Alex, so an image never breaks a card.
import type { RequestHandler } from "./$types";
import { isHidden } from "#lib/server/hidden.ts";
import { skinResponse } from "#lib/server/images/skins.ts";
import { skinService } from "#lib/server/images/index.ts";

export const GET: RequestHandler = ({ params }) => skinResponse(params.uuid, { hidden: isHidden, skin: (u) => skinService().skin(u) });
