// For Docker's HEALTHCHECK and the watcher (PLAN §3.4): 200 when the server answers. It does not
// depend on cakeutils (the site serves last good data when cakeutils is down).
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () => json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
