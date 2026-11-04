// The typed cakeutils client (PLAN §3.2): one function per route, every call returns a Result,
// nothing throws, the token never leaves this process. These signatures are frozen by W0; W1 owns
// the internals (LRU cache with per-route TTL floors, ETag revalidation, single-flight,
// serve-stale-on-error up to 24 h, the token bucket, Retry-After) and keeps the signatures.
//
// Routes the site must never call: /v2/players/{ref}/relations, /v2/admin/*. They are not here.
import type {
  BatchResponse, Health, Leaderboard, MilestoneFeed, MilestoneLadder, MiniServers, Network, PlayerList, PlayerMilestones,
  PlayerProfile, Playtime, StatList, StatRow, StatTypes, SubjectDetail, SubjectList
} from "#lib/api/types.ts";
import type { Metric } from "#lib/api/metric.ts";
import { shortType } from "#lib/api/metric.ts";
import type { Scope } from "#lib/api/scope.ts";
import { fail, listIsEmpty, ok, type Result } from "#lib/api/result.ts";
import { apiToken, config, displayUrl, tokenId } from "../env.ts";
import { mockFetch, type FetchLike } from "./mock/index.ts";

export type Page = { limit?: number; offset?: number };
export type PlayersQuery = Page & { online?: boolean; q?: string };
export type StatsQuery = Page & { scope?: Scope; type?: string; q?: string };
export type SubjectsQuery = Page & { type?: string; kind?: string; q?: string };
export type MilestonesQuery = Page & { scope?: Scope; type?: string };

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
}

export type ClientOptions = {
  baseUrl: string;
  token: string;
  fetchImpl?: FetchLike;
  log?: (line: string) => void;
};

// ---- W0's plain implementation: fetch, map statuses, no cache yet (W1 adds it).

export function createClient(o: ClientOptions): Client {
  const f: FetchLike = o.fetchImpl ?? ((input, init) => fetch(input, init));
  const log = o.log ?? ((l: string) => console.warn(l));
  const headers: Record<string, string> = o.token ? { authorization: `Bearer ${o.token}`, accept: "application/json" } : { accept: "application/json" };

  async function call<T>(path: string, init?: RequestInit): Promise<Result<T>> {
    let res: Response;
    try {
      res = await f(`${o.baseUrl}${path}`, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) } });
    } catch (e) {
      log(`cakeutils unreachable at ${displayUrl(o.baseUrl)} (${tokenId(o.token)}): ${(e as Error).message}`);
      return fail("down");
    }
    const asOf = Date.now();
    if (res.ok) {
      const data = (await res.json()) as T;
      return ok(data, asOf, { empty: listIsEmpty(data) });
    }
    const problem = await res.json().catch(() => undefined);
    const status = res.status;
    if (status === 404) return fail("not_found", { status, problem });
    if (status === 400) return fail("bad_request", { status, problem });
    if (status === 429) return fail("rate_limited", { status, problem, retryAfter: Number(res.headers.get("retry-after") ?? 1) || 1 });
    if (status === 401 || status === 403) log(`cakeutils refused ${tokenId(o.token)}: ${status} (check the token and its scopes)`);
    return fail("down", { status, problem });
  }

  const q = (params: Record<string, string | number | boolean | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && !(k === "scope" && v === "network")) s.set(k, String(v));
    const t = s.toString();
    return t ? `?${t}` : "";
  };
  const enc = encodeURIComponent;

  let milestonesCheck: { at: number; on: boolean } | null = null;

  const client: Client = {
    health: () => call("/v2/health"),
    network: () => call("/v2/network"),
    players: (p = {}) => call(`/v2/players${q(p)}`),
    player: (ref) => call(`/v2/players/${enc(ref)}`),
    playtime: (ref, scope) => call(`/v2/players/${enc(ref)}/playtime${q({ scope })}`),
    playerStats: (ref, p = {}) => call(`/v2/players/${enc(ref)}/stats${q(p)}`),
    playerStat: (ref, type, subject, scope) => call(`/v2/players/${enc(ref)}/stats/${enc(shortType(type))}/${enc(subject)}${q({ scope })}`),
    batch: (refs, include, scope) =>
      call(`/v2/players:batch${q({ scope })}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refs, include }) }),
    statTypes: () => call("/v2/stats/types"),
    subjects: (p = {}) => call(`/v2/stats/subjects${q(p)}`),
    subject: (key) => call(`/v2/stats/subjects/${enc(key)}`),
    leaderboard: (m, scope, page = {}) =>
      m.kind === "playtime"
        ? call(`/v2/leaderboards/playtime${q({ scope, ...page })}`)
        : call(`/v2/leaderboards/stats/${enc(shortType(m.type))}/${enc(m.subject)}${q({ scope, ...page })}`),
    miniServers: () => call("/v2/mini-servers"),
    icon: async (sha) => {
      if (!/^[0-9a-f]{64}$/.test(sha)) return fail("not_found");
      let res: Response;
      try {
        res = await f(`${o.baseUrl}/v2/icons/${sha}.png`, { headers: o.token ? { authorization: `Bearer ${o.token}` } : {} });
      } catch {
        return fail("down");
      }
      if (res.status === 404) return fail("not_found", { status: 404 });
      if (!res.ok) return fail("down", { status: res.status });
      return ok({ png: new Uint8Array(await res.arrayBuffer()), etag: res.headers.get("etag") }, Date.now());
    },
    milestonesEnabled: async () => {
      const now = Date.now();
      if (milestonesCheck && now - milestonesCheck.at < 10 * 60_000) return milestonesCheck.on;
      const r = await call<MilestoneFeed>("/v2/milestones?limit=1");
      if (r.ok || r.kind === "not_found" || r.kind === "bad_request") {
        milestonesCheck = { at: now, on: r.ok || r.kind === "bad_request" };
      } else if (!milestonesCheck) {
        return false; // down and never seen: hide until we know
      }
      return milestonesCheck.on;
    },
    milestones: async (p = {}) => {
      if (!(await client.milestonesEnabled())) return fail("off");
      return call(`/v2/milestones${q(p)}`);
    },
    milestoneLadder: async (type, subject, scope) => {
      if (!(await client.milestonesEnabled())) return fail("off");
      return call(`/v2/milestones/stats/${enc(shortType(type))}/${enc(subject)}${q({ scope })}`);
    },
    playerMilestones: async (ref, p = {}) => {
      if (!(await client.milestonesEnabled())) return fail("off");
      return call(`/v2/players/${enc(ref)}/milestones${q(p)}`);
    }
  };
  return client;
}

let instance: Client | null = null;

/** The site's one client, configured from the environment (mock fetch when FISHNET_MOCK is set). */
export function api(): Client {
  if (instance) return instance;
  const c = config();
  instance = c.mock
    ? createClient({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl: mockFetch(c.mock) })
    : createClient({ baseUrl: c.apiUrl, token: apiToken() });
  return instance;
}
