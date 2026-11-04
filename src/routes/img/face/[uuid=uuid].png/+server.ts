// W0 stub of the face route (W8 fetches the skin by UUID from Mojang, crops the head with sharp and
// caches it on disk 24 h, with this default as the fallback): always the default head for now.
import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () => {
  redirect(302, "/img/face-default.png");
};
