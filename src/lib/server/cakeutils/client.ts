// The typed cakeutils client (PLAN §3.2): one function per route, every call returns a Result,
// nothing throws, the token never leaves this process. These signatures are frozen by W0; W1 owns
// the internals (LRU cache with per-route TTL floors, ETag revalidation, single-flight,
// serve-stale-on-error up to 24 h, the token bucket, Retry-After) and keeps the signatures.
//
// What callers can rely on:
// - `stale: true` = cakeutils could not be reached (or throttled us) and this is the last good answer,
//   at most 24 h old, from `asOf`. Pages show "as of"; the recorder ignores it.
// - A fresh answer is at most its TTL old: 5 s live data, 15 s boards, 10 min catalogue, icons forever;
//   a little older (up to one more TTL, ≥ 10 s) while a refresh runs behind it.
// - 404 and 400 answers are remembered briefly too (5 s, boards 15 s, catalogue 1 min).
// - `rate_limited` comes only when nothing stale can be served; `retryAfter` is in seconds.
//
// Routes the site must never call: /v2/players/{ref}/relations, /v2/admin/*. They are not here.
import type {
  AdvancementDetail, AdvancementFeed, BatchResponse, Health, Leaderboard, MilestoneFeed, MilestoneLadder, MiniServers, Network,
  PlayerAdvancements, PlayerList, PlayerMilestones, PlayerProfile, Playtime, StatList, StatRow, StatTypes, SubjectDetail, SubjectList
} from "#lib/api/types.ts";
import type { Metric } from "#lib/api/metric.ts";
import type { Scope } from "#lib/api/scope.ts";
import type { Result } from "#lib/api/result.ts";
import { apiToken, config } from "../env.ts";
import { mockFetch } from "./mock/index.ts";
import { createClient, type Priority } from "./create.ts";
import { createCore, type Core, type CoreStatus } from "./core.ts";
import { hideServers, type ExclusionStatus } from "./hide.ts";
import { hiddenServers } from "../hidden-servers.ts";
import { ServerList } from "../hidden-servers-list.ts";
import { standaloneExclude, standaloneIds } from "../onesoul/standalone.ts";

export type Page = { limit?: number; offset?: number };
export type PlayersQuery = Page & { online?: boolean; q?: string };
export type StatsQuery = Page & { scope?: Scope; type?: string; q?: string };
export type SubjectsQuery = Page & { type?: string; kind?: string; q?: string };
export type MilestonesQuery = Page & { scope?: Scope; type?: string };
export type AdvancementsQuery = Page & { scope?: Scope };

export type Icon = { png: Uint8Array; etag: string | null };

export interface Client {
  /** GET /v2/health (no token). */
  health(): Promise<Result<Health>>;
  /** GET /v2/network */
  network(): Promise<Result<Network>>;
  /** GET /v2/players?online=&q=&limit=&offset= (ordered by name). */
  players(q?: PlayersQuery): Promise<Result<PlayerList>>;
  /** GET /v2/players/{ref}: not_found for an unknown player. */
  player(ref: string): Promise<Result<PlayerProfile>>;
  /** GET /v2/players/{ref}/playtime?scope= */
  playtime(ref: string, scope?: Scope): Promise<Result<Playtime>>;
  /** GET /v2/players/{ref}/stats: ordered by type then subject, never by value. */
  playerStats(ref: string, q?: StatsQuery): Promise<Result<StatList>>;
  /** GET /v2/players/{ref}/stats/{type}/{subject}: value 0 when the player has none, not_found when nobody ever recorded it. */
  playerStat(ref: string, type: string, subject: string, scope?: Scope): Promise<Result<StatRow>>;
  /** POST /v2/players:batch (≤ 100 refs, ≤ 32 includes: "playtime" or "stats:<type>:<subject>"). A read. */
  batch(refs: string[], include: string[], scope?: Scope): Promise<Result<BatchResponse>>;
  /** GET /v2/stats/types */
  statTypes(): Promise<Result<StatTypes>>;
  /** GET /v2/stats/subjects?type=&kind=&q=&limit=&offset= */
  subjects(q?: SubjectsQuery): Promise<Result<SubjectList>>;
  /** GET /v2/stats/subjects/{subject} */
  subject(key: string): Promise<Result<SubjectDetail>>;
  /** GET /v2/leaderboards/playtime or /v2/leaderboards/stats/{type}/{subject}: not_found for a never-recorded stat, bad_request (mixed_units) for custom:*. */
  leaderboard(metric: Metric, scope?: Scope, page?: Page): Promise<Result<Leaderboard>>;
  /** GET /v2/mini-servers: occupied public mini-servers. */
  miniServers(): Promise<Result<MiniServers>>;
  /** GET /v2/icons/{sha256}.png as bytes (immutable). */
  icon(sha256: string): Promise<Result<Icon>>;
  /** Feature detection (PLAN §2.5): true when /v2/milestones exists on this proxy. Cached 10 min; false on 404, last known value when down. */
  milestonesEnabled(): Promise<boolean>;
  /** GET /v2/milestones?scope=&type=&limit=&offset=: newest first, backfilled last; `off` when the proxy has no milestones. */
  milestones(q?: MilestonesQuery): Promise<Result<MilestoneFeed>>;
  /** GET /v2/milestones/stats/{type}/{subject}?scope=: not_found for a never-recorded stat, `tracked:false` for time and damage. */
  milestoneLadder(type: string, subject: string, scope?: Scope): Promise<Result<MilestoneLadder>>;
  /** GET /v2/players/{ref}/milestones?scope=&type=&limit=&offset= */
  playerMilestones(ref: string, q?: MilestonesQuery): Promise<Result<PlayerMilestones>>;
  /** Feature detection (D-111): true when /v2/milestones/advancements exists on this proxy. Cached 10 min; false on 404, last known value when down. */
  advancementsEnabled(): Promise<boolean>;
  /** GET /v2/milestones/advancements?scope=&limit=&offset=: first earner of every advancement, newest first; `off` without D-111, bad_request for a mini: scope. */
  advancements(q?: AdvancementsQuery): Promise<Result<AdvancementFeed>>;
  /** GET /v2/milestones/advancement?id=: one advancement in the network and on each server; not_found when no backend ever reported it. */
  advancement(id: string): Promise<Result<AdvancementDetail>>;
  /** GET /v2/players/{ref}/advancement-milestones?scope=&limit=&offset=: what this player completed first (rows without uuid/name). */
  playerAdvancements(ref: string, q?: AdvancementsQuery): Promise<Result<PlayerAdvancements>>;
}

// ---- W1: the internals live in create.ts (paths) and core.ts (cache, ETag, single-flight,
// stale-on-error, token bucket, Retry-After). This file keeps the frozen surface and the singleton.
export { createClient, type ClientOptions, type Priority } from "./create.ts";
export type { CoreStatus } from "./core.ts";

let instance: (Client & { exclusionStatus(): ExclusionStatus }) | null = null;
let section: Client | null = null;
let core: Core | null = null;
let priorityOf: () => Priority = () => "page";

function shared(): Core {
  if (core) return core;
  const c = config();
  core = c.mock
    ? createCore({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl: mockFetch(c.mock), ratePerMinute: 100_000, burst: 10_000 })
    : createCore({ baseUrl: c.apiUrl, token: apiToken(), ratePerMinute: c.ratePerMinute, burst: c.burst });
  return core;
}

/** The site's one client, configured from the environment (mock fetch when FISHNET_MOCK is set). */
export function api(): Client {
  if (instance) return instance;
  // hidden servers (hidden-servers.ts) and the One Soul servers (onesoul/standalone.ts) leave every answer
  // here, and network reads ask cakeutils without them (One Soul only while cakeutils still rolls it up)
  instance = hideServers(
    createClient({ baseUrl: "", token: "", core: shared(), priority: () => priorityOf(), exclude: () => [...new Set([...hiddenServers().ids, ...standaloneExclude()])] }),
    regularList
  );
  return instance;
}

let listMemo: { hidden: ServerList; ids: readonly string[]; list: ServerList } | null = null;
/** The hide list of the regular site: the owner's hidden servers plus every One Soul server. */
function regularList(): ServerList {
  const hidden = hiddenServers();
  const ids = standaloneIds();
  if (listMemo && listMemo.hidden === hidden && listMemo.ids === ids) return listMemo.list;
  listMemo = { hidden, ids, list: ids.length ? new ServerList([...hidden.ids, ...ids]) : hidden };
  return listMemo.list;
}

/**
 * The client of the One Soul section: the owner's hidden servers still leave it, the One Soul servers do not
 * (its pages read scope=server:<id> and round:<server>/<cycle>, never the network).
 */
export function sectionApi(): Client {
  if (section) return section;
  section = hideServers(createClient({ baseUrl: "", token: "", core: shared(), priority: () => priorityOf(), exclude: () => hiddenServers().ids }), hiddenServers);
  return section;
}

/** The shared transport (one cache and one request budget for every client). */
export function sharedCore(): Core {
  return shared();
}

/** Whether servers are hidden and whether cakeutils leaves them out of network figures (D-113); for the layout. */
export function exclusionStatus(): ExclusionStatus {
  api();
  return instance!.exclusionStatus();
}

/**
 * Decide each call's priority from its context. The recorder sets this once at start:
 * `setRequestPriority(() => (inRecorder() ? "background" : "page"))`, so its calls wait behind
 * page renders without a flag in the Client signatures.
 */
export function setRequestPriority(fn: () => Priority): void {
  priorityOf = fn;
}

/** Reachability, cache and bucket numbers for /about and /healthz (no token, no paths). */
export function apiStatus(): CoreStatus {
  return shared().status();
}
