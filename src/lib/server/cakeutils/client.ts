// The typed cakeutils client (PLAN §3.2): one function per route, every call returns a Result,
// nothing throws, the token never leaves this process. These signatures are frozen by W0; W1 owns
// the internals (LRU cache with per-route TTL floors, ETag revalidation, single-flight,
// serve-stale-on-error up to 24 h, the token bucket, Retry-After) and keeps the signatures.
//
// What callers can rely on:
// - `stale: true` = cakeutils could not be reached (or throttled us) and this is the last good answer,
//   at most 24 h old, from `asOf`. Pages show "as of"; the recorder ignores it.
// - A fresh answer is at most its tier's TTL old (policy.ts: live data 15 s, players 30 s, boards and
//   feeds 60 s, the catalogue 30 min, icons forever), then served a while longer while one refresh runs
//   behind it (the tier's stale-while-revalidate window).
// - 404 and 400 answers are remembered for the tier's negative TTL (15 s to 5 min).
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
import { createExtras, type Extras } from "./extras.ts";
import { hiddenServers } from "../hidden-servers.ts";
import { ServerList } from "../hidden-servers-list.ts";
import { standaloneExclude, standaloneIds } from "../onesoul/standalone.ts";
import { createMapClient, type MapClient } from "./map.ts";
import { hiddenPlayers } from "../hidden.ts";
import { HiddenList } from "../hidden-list.ts";
import { worldOf } from "./mock/index.ts";
import { mockMapHidden } from "./mock/map.ts";

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

let extrasInstance: Extras | null = null;
/** The planned network routes (firsts, deaths, activity, ...), feature-detected, with the regular hide list. */
export function extras(): Extras {
  if (extrasInstance) return extrasInstance;
  extrasInstance = createExtras(shared(), {
    priority: () => priorityOf(),
    hidden: regularList,
    exclude: () => [...new Set([...hiddenServers().ids, ...standaloneExclude()])],
    hiddenPlayer: (p) => hiddenPlayers().hasPlayer(p)
  });
  return extrasInstance;
}

let mapCore: Core | null = null;
let mapInstance: MapClient | null = null;

/**
 * The web map's calls (map.ts, FM-0) on their own transport: the map bucket (CAKEUTILS_MAP_RATE /
 * CAKEUTILS_MAP_BURST) and a small LRU of its own, so tiles and positions never spend the pages' budget.
 * Hidden servers, One Soul servers and hidden players never leave it. In mock mode the fixture's
 * hidden examples (a server and a player) are hidden too, so they never show in development either.
 */
export function mapApi(): MapClient {
  if (mapInstance) return mapInstance;
  const c = config();
  mapCore = c.mock
    ? createCore({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl: mockFetch(c.mock), ratePerMinute: 100_000, burst: 10_000, maxEntries: 2_000, maxBytes: 8 * 1024 * 1024 })
    : createCore({ baseUrl: c.apiUrl, token: apiToken(), ratePerMinute: c.mapRatePerMinute, burst: c.mapBurst, maxEntries: 2_000, maxBytes: 8 * 1024 * 1024, scopeHint: "read:map read:onesoul" });
  const extra = c.mock ? mockMapHidden(worldOf(c.mock)) : { servers: [], players: [] };
  const plus = <L>(memo: { from: L | null; to: L | null }, from: L, make: (l: L) => L): L => {
    if (memo.from !== from) {
      memo.from = from;
      memo.to = make(from);
    }
    return memo.to!;
  };
  const liveMemo = { from: null as ServerList | null, to: null as ServerList | null };
  const ownerMemo = { from: null as ServerList | null, to: null as ServerList | null };
  const playerMemo = { from: null as HiddenList | null, to: null as HiddenList | null };
  mapInstance = createMapClient({
    core: mapCore,
    hiddenLive: () => (extra.servers.length ? plus(liveMemo, regularList(), (l) => new ServerList([...l.ids, ...extra.servers])) : regularList()),
    hiddenServers: () => (extra.servers.length ? plus(ownerMemo, hiddenServers(), (l) => new ServerList([...l.ids, ...extra.servers])) : hiddenServers()),
    hiddenPlayers: () => (extra.players.length ? plus(playerMemo, hiddenPlayers(), (l) => l.with(extra.players)) : hiddenPlayers())
  });
  return mapInstance;
}

/** Reachability, cache and map-bucket numbers of the map's transport (no token, no paths). */
export function mapApiStatus(): CoreStatus {
  mapApi();
  return mapCore!.status();
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
