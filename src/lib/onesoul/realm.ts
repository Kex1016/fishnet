// The two realms of the site (WEBSITE-BRIEF §4): the regular Fishnet look and the One Soul look. The realm
// is an attribute on <html> (`data-realm="onesoul"`, empty for the regular site) that switches the design
// tokens (src/lib/onesoul/realm.css). The server sets it on the first render (hooks.server.ts); client-side
// navigations switch it through an animated transition (transition.ts).

export type RealmName = "" | "onesoul";

export const ONE_SOUL_BASE = "/one-soul";

export function realmOf(pathname: string): RealmName {
  return pathname === ONE_SOUL_BASE || pathname.startsWith(`${ONE_SOUL_BASE}/`) ? "onesoul" : "";
}
