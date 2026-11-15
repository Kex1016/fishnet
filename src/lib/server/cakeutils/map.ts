// The web map's calls (FM-0; cakeutils v2/MAP.md §5, brief §2, §4). A sibling of the Client (client.ts) on
// its own transport core: its own token bucket (CAKEUTILS_MAP_RATE / CAKEUTILS_MAP_BURST, below cakeutils'
// map bucket) so tiles never delay a page render, and its own small LRU for the index and world settings.
// Tiles, positions and change logs never go through the LRU (policy.ts "map-direct"): FM-1's disk cache and
// FM-2's hub keep what they need.
//
// Hiding is built in, on every call, before anything leaves this module:
// - hidden servers and One Soul (standalone) servers leave /v2/map; any call naming one answers not_found
//   without asking cakeutils (the round routes hide only the owner's hidden servers: One Soul rounds are
//   what they are for);
// - hidden players leave every positions answer;
// - markers (FMK-0): the same server check, and a hidden server's markers are never asked for.
// Parameters are checked (links.ts) before a path is built: a bad id, zoom, coordinate or cycle is not_found.
//
// What a failure means (MAP §5.4, mapped in core.ts):
// - not_found: unknown server, no map, world not announced, tile not rendered (normal at the edges);
// - off: positions off (`problemCode` "off"), no change log ("not_supported"), a squaremap the proxy cannot
//   read or a route not built yet (status 501: "map_format_unsupported", "not_implemented"); and from
//   mapServers / mapEnabled, a proxy without the map or a token without read:map;
// - down: cakeutils unreachable, or status 503 "map_offline" / "map_busy" for that server (retryAfter set).
import type { MapChanges, MapIndex, MapMarkers, MapPlayers, MapWorld, RoundMapWorld } from "#lib/api/types.ts";
import { fail, ok, type Result } from "#lib/api/result.ts";
import { validCycle, validServerId, validTile, validWorldId, type TileKey } from "#lib/map/links.ts";
import type { Core, Priority } from "./core.ts";
import type { ServerList } from "../hidden-servers-list.ts";
import type { HiddenList } from "../hidden-list.ts";

/** A tile as cakeutils sent it, or "still the one you have" (304 on `etag`). */
export type MapTile =
  | { notModified: false; png: Uint8Array; etag: string | null; cacheControl: string | null; lastModified: string | null }
  | { notModified: true; png: null; etag: string | null; cacheControl: string | null; lastModified: string | null };

export type TileOptions = {
  /** the ETag of the copy on disk: cakeutils answers 304 while it is current */
  etag?: string | null;
  /** "page" (default) for a miss a visitor waits on, "background" for a revalidation */
  priority?: Priority;
  /** how long to wait for a token from the map bucket */
  waitMs?: number;
};

export type LiveOptions = {
  /** "background" (default): the hub's polls wait behind tile misses */
  priority?: Priority;
  waitMs?: number;
};

export interface MapClient {
  /**
   * May this server's map be shown at all (FM-1)? `live`: a valid id that is neither hidden nor One Soul;
   * `round`: a valid id that is not hidden. Anything that serves a copy without asking cakeutils (the tile
   * disk cache) checks it first, so a server hidden after its tiles were cached disappears at once.
   */
  serverVisible(server: string, scope: "live" | "round"): boolean;
  /** The proxy has /v2/map and the token may read it. Cached 10 min; false on 404/403/501, last known value when down. */
  mapEnabled(): Promise<boolean>;
  /** GET /v2/map (live tier, 15 s): hidden and One Soul servers left out. `off` without the map; `empty` when no server has one. */
  mapServers(): Promise<Result<MapIndex>>;
  /** GET /v2/map/{server}/worlds/{world} (map-world tier: 5 min, served while refreshing for 1 h). */
  mapWorld(server: string, world: string): Promise<Result<MapWorld>>;
  /** GET /v2/map/{server}/tiles/{world}/{z}/{x}_{y}.png, past the LRU; `etag` → 304 while unchanged. */
  mapTile(server: string, world: string, tile: TileKey, o?: TileOptions): Promise<Result<MapTile>>;
  /**
   * GET /v2/map/{server}/worlds/{world}/markers (map-markers tier: 30 s, served while refreshing for 10 min, last good
   * answer up to 24 h with `asOf` and `stale` when cakeutils is down). The LRU revalidates with the ETag ("m<rev>"):
   * a 304 costs one map-bucket request and no body. `not_found` is "no markers here": an unknown or hidden server, a
   * bad id, a world that is not on the map, a private mini-server or a standalone server (MARKERS §3.3). It is the
   * normal answer for a world with no map, not a failure to report; callers draw nothing and show no error. A world
   * with no markers is `ok` with `markers: []`.
   */
  markers(server: string, world: string, o?: LiveOptions): Promise<Result<MapMarkers>>;
  /** GET /v2/map/{server}/worlds/{world}/changes, past the LRU; `off` (not_supported) without a log. */
  mapChanges(server: string, world: string, o?: LiveOptions): Promise<Result<MapChanges>>;
  /** GET /v2/map/{server}/players, past the LRU, hidden players left out; `off` when positions are off. */
  mapPlayers(server: string, o?: LiveOptions): Promise<Result<MapPlayers>>;
  /** GET /v2/onesoul/rounds/{cycle}/map/worlds/{world}?server= (catalogue tier): not_found while the round runs. */
  roundMapWorld(cycle: number, world: string, server: string): Promise<Result<RoundMapWorld>>;
  /** GET /v2/onesoul/rounds/{cycle}/map/tiles/{world}/{z}/{x}_{y}.png?server=, past the LRU (never changes). */
  roundMapTile(cycle: number, world: string, tile: TileKey, server: string, o?: TileOptions): Promise<Result<MapTile>>;
}

export type MapClientOptions = {
  core: Core;
  /** servers never shown on the live map: the owner's hidden servers plus every One Soul server */
  hiddenLive: () => ServerList;
  /** servers never shown at all (the round routes): the owner's hidden servers */
  hiddenServers: () => ServerList;
  hiddenPlayers: () => HiddenList;
  now?: () => number;
};

const CHECK_MS = 10 * 60_000;

export function createMapClient(o: MapClientOptions): MapClient {
  const { core } = o;
  const now = o.now ?? Date.now;
  const enc = encodeURIComponent;
  const notFound = <T>(): Promise<Result<T>> => Promise.resolve(fail("not_found", { status: 404 }));
  /** a server the live map may name: a valid id, not hidden, not One Soul */
  const liveOk = (server: string) => validServerId(server) && !o.hiddenLive().has(server);
  const roundOk = (server: string, cycle: number) => validServerId(server) && validCycle(cycle) && !o.hiddenServers().has(server);

  async function tile(path: string, t: TileKey, opt: TileOptions): Promise<Result<MapTile>> {
    if (!validTile(t)) return fail("not_found", { status: 404 });
    const r = await core.direct<Uint8Array>({ path, binary: true, ifNoneMatch: opt.etag ?? null, waitMs: opt.waitMs }, opt.priority ?? "page");
    if (!r.ok) return r;
    const { status, body, etag, cacheControl, lastModified } = r.data;
    return ok(status === 304 ? { notModified: true, png: null, etag, cacheControl, lastModified } : { notModified: false, png: body!, etag, cacheControl, lastModified }, r.asOf);
  }

  async function live<T>(path: string, opt: LiveOptions): Promise<Result<T>> {
    const r = await core.direct<T>({ path, waitMs: opt.waitMs }, opt.priority ?? "background");
    if (!r.ok) return r;
    return ok(r.data.body as T, r.asOf);
  }

  /** a proxy without the map (404), a token without read:map (403) and a route not built (501) are all "off" */
  const offWhenMissing = <T>(r: Result<T>): Result<T> =>
    !r.ok && (r.kind === "not_found" || r.status === 403 || r.status === 401 || r.status === 501) ? fail("off", { status: r.status, problem: r.problem }) : r;

  let known: { at: number; on: boolean } | null = null;

  const client: MapClient = {
    serverVisible: (server, scope) => (scope === "live" ? liveOk(server) : validServerId(server) && !o.hiddenServers().has(server)),

    mapEnabled: async () => {
      const t = now();
      if (known && t - known.at < CHECK_MS) return known.on;
      const r = await client.mapServers();
      if (r.ok && !r.stale) known = { at: t, on: true };
      else if (!r.ok && r.kind === "off") known = { at: t, on: false };
      else return known?.on ?? r.ok;
      return known.on;
    },

    mapServers: async () => {
      const r = offWhenMissing(await core.get<MapIndex>({ path: "/v2/map" }, "page"));
      if (!r.ok) return r;
      const l = o.hiddenLive();
      const servers = l.size === 0 ? r.data.servers : r.data.servers.filter((s) => !l.has(s.server));
      return { ...r, data: { ...r.data, servers }, empty: servers.length === 0 };
    },

    mapWorld: (server, world) => {
      if (!liveOk(server) || !validWorldId(world)) return notFound();
      return core.get<MapWorld>({ path: `/v2/map/${enc(server)}/worlds/${world}` }, "page");
    },

    mapTile: (server, world, t, opt = {}) => {
      if (!liveOk(server) || !validWorldId(world)) return notFound();
      return tile(`/v2/map/${enc(server)}/tiles/${world}/${t.z}/${t.x}_${t.y}.png`, t, opt);
    },

    markers: async (server, world, opt = {}) => {
      if (!liveOk(server) || !validWorldId(world)) return notFound();
      const r = await core.get<MapMarkers>({ path: `/v2/map/${enc(server)}/worlds/${world}/markers` }, opt.priority ?? "page");
      // a body that is not the contract's shape is no answer ("down"), never a crash downstream
      if (r.ok && (!r.data || !Array.isArray(r.data.markers) || typeof r.data.rev !== "number")) return fail("down");
      // `empty` = "No markers in this world yet" (the core only knows the list keys it was taught)
      return r.ok ? { ...r, empty: r.data.markers.length === 0 } : r;
    },

    mapChanges: (server, world, opt = {}) => {
      if (!liveOk(server) || !validWorldId(world)) return notFound();
      return live<MapChanges>(`/v2/map/${enc(server)}/worlds/${world}/changes`, opt);
    },

    mapPlayers: async (server, opt = {}) => {
      if (!liveOk(server)) return notFound();
      const r = await live<MapPlayers>(`/v2/map/${enc(server)}/players`, opt);
      if (!r.ok) return r;
      const hp = o.hiddenPlayers();
      return hp.size === 0 ? r : { ...r, data: { ...r.data, players: r.data.players.filter((p) => !hp.hasPlayer(p)) } };
    },

    roundMapWorld: (cycle, world, server) => {
      if (!roundOk(server, cycle) || !validWorldId(world)) return notFound();
      return core.get<RoundMapWorld>({ path: `/v2/onesoul/rounds/${cycle}/map/worlds/${world}?server=${enc(server)}` }, "page");
    },

    roundMapTile: (cycle, world, t, server, opt = {}) => {
      if (!roundOk(server, cycle) || !validWorldId(world)) return notFound();
      return tile(`/v2/onesoul/rounds/${cycle}/map/tiles/${world}/${t.z}/${t.x}_${t.y}.png?server=${enc(server)}`, t, opt);
    }
  };
  return client;
}
