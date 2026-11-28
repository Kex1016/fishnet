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
// | feed      | /v2/milestones..., /v2/firsts, /v2/deaths| 60 s   | 4 min                        |
// | catalogue | /v2/stats/types, /v2/stats/subjects...   | 30 min | 6 h                          |
// | icon      | /v2/icons/<sha>.png (content-addressed)  | always | -                            |
// | map-world | /v2/map/<server>/worlds/<world>          | 5 min  | 1 h                          |
// | map-markers| /v2/map/<server>/worlds/<world>/markers | 30 s   | 10 min                       |
// | map-direct| map tiles, positions, change logs        | never cached here (tile disk cache, live hub) |
//
// The round in play's soul position (/v2/onesoul/rounds/<cycle>/map/players, TH-31) is map-direct too.
//
// The map index (/v2/map) is `live`; a finished round's map settings
// (/v2/onesoul/rounds/<cycle>/map/worlds/<world>) are `catalogue`: a round that is over never changes.
// The map routes are counted in their own bucket (map.ts), whatever their tier.
//
// "Served while refreshing" (stale-while-revalidate) is the window past the TTL in which a visitor
// gets the cached answer at once and one refresh runs behind it; past that window the page waits
// for a fresh answer. When cakeutils is down or throttling, the last good answer is served up to
// 24 h with "as of" (core.ts), whatever the tier.

export type RouteClass = "health" | "live" | "player" | "board" | "feed" | "catalogue" | "icon" | "map-world" | "map-markers" | "map-direct";

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
  icon: { cls: "icon", floorMs: Number.POSITIVE_INFINITY, swrMs: 0, negativeMs: 10 * MIN, staleOk: true },
  "map-world": { cls: "map-world", floorMs: 5 * MIN, swrMs: 1 * HOUR, negativeMs: 1 * MIN, staleOk: true },
  // MARKERS §3.4: cakeutils sends max-age=30; the answer is small JSON with an ETag ("m<rev>"), so the LRU keeps it and
  // revalidates with If-None-Match (a 304 costs one map-bucket request and no body). A 404 (no map, hidden world,
  // private mini) is remembered for the same 30 s.
  "map-markers": { cls: "map-markers", floorMs: 30 * SEC, swrMs: 10 * MIN, negativeMs: 30 * SEC, staleOk: true },
  // never in the LRU: core.direct() answers them (FM-1's disk cache and FM-2's hub keep what they need)
  "map-direct": { cls: "map-direct", floorMs: 0, swrMs: 0, negativeMs: 0, staleOk: false }
};

const MAP_DIRECT = /^\/v2\/(map\/[^/]+\/(tiles\/|players$|worlds\/[^/]+\/changes$)|onesoul\/rounds\/[^/]+\/map\/(tiles\/|players$))/;
const MAP_MARKERS = /^\/v2\/map\/[^/]+\/worlds\/[^/]+\/markers$/;
const MAP_WORLD = /^\/v2\/map\/[^/]+\/worlds\/[^/]+$/;
const ROUND_MAP_WORLD = /^\/v2\/onesoul\/rounds\/[^/]+\/map\/worlds\/[^/]+$/;

/** A path counted in cakeutils' map bucket (MAP §5.1): /v2/map* and a finished round's map routes. */
export function isMapPath(path: string): boolean {
  const p = path.split("?")[0];
  return p === "/v2/map" || p.startsWith("/v2/map/") || /^\/v2\/onesoul\/rounds\/[^/]+\/map\//.test(p);
}

/** The tier of a `/v2/...` path (query ignored). Anything unknown is "live": the shortest floor. */
export function policyFor(path: string): Policy {
  const p = path.split("?")[0];
  if (p === "/v2/health") return POLICIES.health;
  if (p.startsWith("/v2/icons/")) return POLICIES.icon;
  if (MAP_DIRECT.test(p)) return POLICIES["map-direct"];
  if (MAP_MARKERS.test(p)) return POLICIES["map-markers"];
  if (MAP_WORLD.test(p)) return POLICIES["map-world"];
  if (ROUND_MAP_WORLD.test(p)) return POLICIES.catalogue;
  if (p === "/v2/map") return POLICIES.live;
  if (p.startsWith("/v2/leaderboards/")) return POLICIES.board;
  if (p === "/v2/stats/types" || p.startsWith("/v2/stats/subjects")) return POLICIES.catalogue;
  if (p === "/v2/milestones" || p.startsWith("/v2/milestones/")) return POLICIES.feed;
  // the merged firsts feed and the death log are feeds too: a row appears when somebody does something
  if (p === "/v2/firsts" || p === "/v2/deaths") return POLICIES.feed;
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
