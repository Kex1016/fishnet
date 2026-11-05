// Shared file (PLAN §7): minimal additive edits only, named in the unit's report.
// W0: theme cookie → <html data-theme>, mock-mode guard, security headers beyond the CSP in
// svelte.config.js. W2 adds the recorder's start in `init`.
import type { Handle, ServerInit } from "@sveltejs/kit/hooks";
import { config, displayUrl, tokenId } from "#lib/server/env.ts";
import { apiToken } from "#lib/server/env.ts";
import { startRecorder } from "#lib/server/recorder/index.ts";
import { labelOverrides } from "#lib/server/admin/index.ts";
import { setLabelOverrides } from "#lib/format/labels.ts";

export const init: ServerInit = async () => {
  const c = config(); // throws (fishnet is NOT running: ...) when FISHNET_MOCK is set on a production build
  if (c.mock) console.info(`fishnet: mock mode "${c.mock}", no cakeutils calls`);
  else console.info(`fishnet: cakeutils at ${displayUrl(c.apiUrl)} as ${tokenId(apiToken())}`);
  startRecorder(); // W2: the recorder's scheduler (PLAN §3.3)
};

export const handle: Handle = async ({ event, resolve }) => {
  const t = event.cookies.get("theme");
  event.locals.theme = t === "dark" || t === "light" ? t : "system";
  event.locals.mock = config().mock;
  // the owner's stat names (src/routes/admin/names), before any load builds a label; the root layout
  // hands the same set to the browser
  setLabelOverrides(labelOverrides());
  const response = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace("%fishnet.theme%", event.locals.theme === "system" ? "" : event.locals.theme)
  });
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  if (event.url.pathname === "/admin" || event.url.pathname.startsWith("/admin/")) {
    // admin pages (src/routes/admin/): never cached by a browser or Caddy, never indexed
    response.headers.set("cache-control", "no-store");
    response.headers.set("x-robots-tag", "noindex, nofollow");
  }
  return response;
};
