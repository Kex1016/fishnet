// The site's admin runtime: whether admin is on, the session table, the login limiter, the overrides
// store and the request helpers the /admin routes use. Server-only (src/lib/server), so none of it
// reaches the browser. The admin token is read here and nowhere else; it is never logged.
import { error, redirect, type Cookies, type RequestEvent } from "@sveltejs/kit";
import { join } from "node:path";
import { FISHNET_ADMIN_TOKEN } from "$app/env/private";
import { config } from "../env.ts";
import { csrfMatches, LoginLimiter, MIN_TOKEN_LENGTH, SESSION_MS, Sessions, tokenMatches, type Session } from "./auth.ts";
import { AdminStore, type LabelOverrides } from "./overrides.ts";

export const sessions = new Sessions();
export const limiter = new LoginLimiter();

let warned = false;
/** Admin is on when the token is set and long enough. */
export function adminEnabled(): boolean {
  const t = FISHNET_ADMIN_TOKEN;
  if (t && t.length < MIN_TOKEN_LENGTH && !warned) {
    warned = true;
    console.warn(`fishnet: the admin token is shorter than ${MIN_TOKEN_LENGTH} characters, so /admin is off`);
  }
  return t.length >= MIN_TOKEN_LENGTH;
}

export function checkToken(given: string): boolean {
  return tokenMatches(FISHNET_ADMIN_TOKEN, given);
}

let store: AdminStore | null = null;
let storeFailed = false;
/** The overrides store (<data dir>/admin.db), opened on first use. Null when it cannot be opened. */
export function adminStore(): AdminStore | null {
  if (store || storeFailed) return store;
  try {
    store = new AdminStore(join(config().dataDir, "admin.db"));
  } catch (e) {
    storeFailed = true;
    console.error(`fishnet: admin.db not opened: ${(e as Error).message}`);
  }
  return store;
}

/** The owner's label overrides, for the root layout (empty when there are none or the file is missing). */
export function labelOverrides(): LabelOverrides {
  return adminStore()?.overrides() ?? { types: {}, stats: {} };
}

// The cookie: httpOnly, SameSite=Strict, Secure on https (adapter-node takes https unless
// PROTOCOL_HEADER says otherwise, and Caddy serves https). With https the `__Host-` prefix pins it to
// this host and path `/`, so no subdomain can set or read it.
type Ev = { cookies: Cookies; url: URL };
const secure = (e: Ev) => e.url.protocol === "https:";
export function cookieName(e: Ev): string {
  return secure(e) ? "__Host-fishnet_admin" : "fishnet_admin";
}

export function startSession(e: Ev): Session {
  const s = sessions.create();
  e.cookies.set(cookieName(e), s.id, { path: "/", httpOnly: true, sameSite: "strict", secure: secure(e), maxAge: SESSION_MS / 1000 });
  return s;
}

export function endSession(e: Ev): void {
  sessions.delete(e.cookies.get(cookieName(e)));
  e.cookies.delete(cookieName(e), { path: "/", httpOnly: true, sameSite: "strict", secure: secure(e) });
}

/** The current admin session, or null. */
export function currentSession(e: Ev): Session | null {
  if (!adminEnabled()) return null;
  return sessions.get(e.cookies.get(cookieName(e)));
}

/** 404 when admin is off, so its existence does not show. */
export function requireEnabled(): void {
  if (!adminEnabled()) error(404, "Not found");
}

/**
 * For every admin form action: a live session and the session's CSRF token in the form. SvelteKit's
 * own origin check on form posts runs first; this is the second lock.
 */
export function requireAdmin(event: RequestEvent, form: FormData): Session {
  requireEnabled();
  const s = currentSession(event);
  if (!s) error(403, "Sign in again");
  if (!csrfMatches(s, form.get("csrf"))) error(403, "The form expired; reload the page");
  return s;
}

export function clientAddress(event: RequestEvent): string {
  try {
    return event.getClientAddress();
  } catch {
    return "unknown";
  }
}

/** For admin page loads: back to the sign-in page without a session. */
export function sessionOrSignIn(e: Ev): Session {
  requireEnabled();
  const s = currentSession(e);
  if (!s) redirect(303, "/admin");
  return s;
}
