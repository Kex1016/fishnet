// Sign in and sign out. A wrong token counts against the limiter (auth.ts); the token is compared
// in constant time and never logged, only the address a failed try came from.
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { adminStore, checkToken, clientAddress, currentSession, endSession, limiter, requireAdmin, requireEnabled, startSession } from "#lib/server/admin/index.ts";

export const load: PageServerLoad = async (event) => {
  requireEnabled();
  if (currentSession(event)) redirect(303, "/admin/names");
  return { title: "Admin", crumbs: [{ label: "Admin", href: "/admin" }] };
};

export const actions: Actions = {
  login: async (event) => {
    requireEnabled();
    const addr = clientAddress(event);
    const wait = limiter.blockedFor(addr);
    if (wait > 0) return fail(429, { error: `Too many tries. Wait ${Math.ceil(wait / 60)} minute${wait > 60 ? "s" : ""} and try again.` });
    const form = await event.request.formData();
    const given = form.get("token");
    if (typeof given !== "string" || given.length === 0 || given.length > 512 || !checkToken(given)) {
      limiter.fail(addr);
      console.warn(`fishnet: admin sign-in failed from ${addr}`);
      return fail(403, { error: "That token is not right." });
    }
    limiter.succeed(addr);
    endSession(event); // a fresh id on every sign-in
    startSession(event);
    console.info(`fishnet: admin signed in from ${addr}`);
    adminStore()?.audit(`signed in from ${addr}`);
    redirect(303, "/admin/names");
  },
  logout: async (event) => {
    requireAdmin(event, await event.request.formData());
    endSession(event);
    redirect(303, "/admin");
  }
};
