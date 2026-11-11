// How long an answer stays fresh, per tier of data (PLAN §3.2). Each tier says how real-time its
// data has to be; the TTL is the response's own `max-age` (cakeutils sends 5 s) raised to the
// tier's floor, so a busy page, a crawler or a cold start after a redeploy cannot spend the
// token's rate on data that changes slower than that.
//
// | tier      | routes                                   | fresh  | then served while refreshing |
// |-----------|------------------------------------------|--------|------------------------------|
// | health    | /v2/health                               | 5 s    | never (it must say "down")   |
// | live      | /v2/network, /v2/mini-servers, unknown   | 15 s   | 45 s                         |
// | player    | /v2/players..., /v2/players:batch        | 30 s   | 90 s                         |
// | board     | /v2/leaderboards/...                     | 60 s   | 4 min                        |
// | feed      | /v2/milestones...                        | 60 s   | 4 min                        |
// | catalogue | /v2/stats/types, /v2/stats/subjects...   | 30 min | 6 h                          |
// | icon      | /v2/icons/<sha>.png (content-addressed)  | always | -                            |
//
// "Served while refreshing" (stale-while-revalidate) is the window past the TTL in which a visitor
// gets the cached answer at once and one refresh runs behind it; past that window the page waits
// for a fresh answer. When cakeutils is down or throttling, the last good answer is served up to
// 24 h with "as of" (core.ts), whatever the tier.

export type RouteClass = "health" | "live" | "player" | "board" | "feed" | "catalogue" | "icon";

export type Policy = {
  cls: RouteClass;
  /** minimum freshness in ms, whatever max-age says */
  floorMs: number;
  /** stale-while-revalidate window past the TTL, in ms */
  swrMs: number;
  /** how long a 404/400 answer is remembered */
  negativeMs: number;
  /** may the last good answer be served when cakeutils is down (health: no, it must say "down") */
  staleOk: boolean;
};

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;

const POLICIES: Record<RouteClass, Policy> = {
  health: { cls: "health", floorMs: 5 * SEC, swrMs: 0, negativeMs: 5 * SEC, staleOk: false },
  live: { cls: "live", floorMs: 15 * SEC, swrMs: 45 * SEC, negativeMs: 15 * SEC, staleOk: true },
  player: { cls: "player", floorMs: 30 * SEC, swrMs: 90 * SEC, negativeMs: 30 * SEC, staleOk: true },
  board: { cls: "board", floorMs: 1 * MIN, swrMs: 4 * MIN, negativeMs: 1 * MIN, staleOk: true },
  feed: { cls: "feed", floorMs: 1 * MIN, swrMs: 4 * MIN, negativeMs: 1 * MIN, staleOk: true },
  catalogue: { cls: "catalogue", floorMs: 30 * MIN, swrMs: 6 * HOUR, negativeMs: 5 * MIN, staleOk: true },
  icon: { cls: "icon", floorMs: Number.POSITIVE_INFINITY, swrMs: 0, negativeMs: 10 * MIN, staleOk: true }
};

/** The tier of a `/v2/...` path (query ignored). Anything unknown is "live": the shortest floor. */
export function policyFor(path: string): Policy {
  const p = path.split("?")[0];
  if (p === "/v2/health") return POLICIES.health;
  if (p.startsWith("/v2/icons/")) return POLICIES.icon;
  if (p.startsWith("/v2/leaderboards/")) return POLICIES.board;
  if (p === "/v2/stats/types" || p.startsWith("/v2/stats/subjects")) return POLICIES.catalogue;
  if (p === "/v2/milestones" || p.startsWith("/v2/milestones/")) return POLICIES.feed;
  // One Soul: the status and the live card are live data; the lists and journals change at a feed's pace
  if (p.startsWith("/v2/onesoul/") && p !== "/v2/onesoul/live") return POLICIES.feed;
  if (/^\/v2\/players\/[^/]+\/onesoul$/.test(p)) return POLICIES.player;
  if (p === "/v2/players" || p.startsWith("/v2/players/") || p.startsWith("/v2/players:")) return POLICIES.player;
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

/** Freshness of a good answer: its max-age, never below the tier's floor. */
export function ttlMs(policy: Policy, cacheControl: string | null): number {
  return Math.max(policy.floorMs, maxAgeMs(cacheControl));
}

/** How long past its TTL a good answer is still served at once while a refresh runs behind it. */
export function swrMs(policy: Policy, ttl: number): number {
  return Number.isFinite(ttl) ? policy.swrMs : 0;
}
