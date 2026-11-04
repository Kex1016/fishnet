// How long an answer stays fresh, per route class (PLAN §3.2). The TTL is the response's own
// `max-age` (cakeutils sends 5 s) raised to a floor per class, so a busy page cannot spend the
// token's rate on data that changes slower than that: leaderboards are cached 15 s by cakeutils
// itself, the catalogue changes when someone first uses a stat, icons never change.

export type RouteClass = "health" | "live" | "board" | "catalogue" | "icon";

export type Policy = {
  cls: RouteClass;
  /** minimum freshness in ms, whatever max-age says */
  floorMs: number;
  /** how long a 404/400 answer is remembered */
  negativeMs: number;
  /** may the last good answer be served when cakeutils is down (health: no, it must say "down") */
  staleOk: boolean;
};

const SEC = 1000;
const MIN = 60 * SEC;

const POLICIES: Record<RouteClass, Policy> = {
  health: { cls: "health", floorMs: 5 * SEC, negativeMs: 5 * SEC, staleOk: false },
  live: { cls: "live", floorMs: 5 * SEC, negativeMs: 5 * SEC, staleOk: true },
  board: { cls: "board", floorMs: 15 * SEC, negativeMs: 15 * SEC, staleOk: true },
  catalogue: { cls: "catalogue", floorMs: 10 * MIN, negativeMs: 1 * MIN, staleOk: true },
  icon: { cls: "icon", floorMs: Number.POSITIVE_INFINITY, negativeMs: 10 * MIN, staleOk: true }
};

/** The class of a `/v2/...` path (query ignored). Anything unknown is "live": the shortest floor. */
export function policyFor(path: string): Policy {
  const p = path.split("?")[0];
  if (p === "/v2/health") return POLICIES.health;
  if (p.startsWith("/v2/icons/")) return POLICIES.icon;
  if (p.startsWith("/v2/leaderboards/")) return POLICIES.board;
  if (p === "/v2/stats/types" || p.startsWith("/v2/stats/subjects")) return POLICIES.catalogue;
  return POLICIES.live;
}

/** `max-age` of a Cache-Control header in ms; 0 for no-store / no-cache / missing. */
export function maxAgeMs(cacheControl: string | null): number {
  if (!cacheControl) return 0;
  const cc = cacheControl.toLowerCase();
  if (/(^|[\s,])(no-store|no-cache)([\s,=]|$)/.test(cc)) return 0;
  if (/(^|[\s,])immutable([\s,]|$)/.test(cc)) return Number.POSITIVE_INFINITY;
  const m = /(^|[\s,])max-age\s*=\s*"?(\d+)"?/.exec(cc);
  return m ? Number(m[2]) * SEC : 0;
}

/** Freshness of a good answer: its max-age, never below the class floor. */
export function ttlMs(policy: Policy, cacheControl: string | null): number {
  return Math.max(policy.floorMs, maxAgeMs(cacheControl));
}

/** How long past its TTL a good answer is still served at once while a refresh runs behind it. */
export function swrMs(ttl: number): number {
  return Number.isFinite(ttl) ? Math.max(ttl, 10 * SEC) : 0;
}
