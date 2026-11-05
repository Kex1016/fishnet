// /admin (owner editing): a 404 unless FISHNET_ADMIN_TOKEN is set. The page data carries the
// session's CSRF token only to a signed-in admin; visitors get nothing.
import type { LayoutServerLoad } from "./$types";
import { currentSession, requireEnabled } from "#lib/server/admin/index.ts";

export const load: LayoutServerLoad = async (event) => {
  requireEnabled();
  const s = currentSession(event);
  return { admin: s ? { csrf: s.csrf } : null };
};
