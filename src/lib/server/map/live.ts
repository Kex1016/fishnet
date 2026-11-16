// The live hub (FM-2; brief §4.3): one poller per server, shared by every browser watching it, fanned out as
// Server-Sent Events. Pure: everything it needs comes in through `LiveDeps` (index.ts wires the map client),
// and time through a `Clock`, so the tests drive it with a fake one.
//
// Lifecycle of a server's hub:
//   - it starts when the first stream subscribes (or players.json asks), polls /v2/map/{server}/players at
//     max(2 s, player_update_ms) and each watched world's change log every 5 s; polls are single-flight and the
//     next one is armed only when the last has finished, so they never overlap;
//   - it stops 30 s after the last stream left (a reload within that window finds it warm);
//   - a server that becomes hidden closes its streams at the next poll.
// Before fan-out: hidden players are dropped (the map client drops them already; the hub checks again on every
// frame, so a list edited between two polls holds too), so are players on a world /v2/map no longer lists (a
// mini world that turned private), positions are floored to the block (the canvas draws a
// player at the centre of the block), rows that are not well formed are dropped, and the snapshot is diffed
// against the last one: a stream gets the full snapshot once, then only what changed.
//
// Streams: `retry: 5000`, then `status`, the snapshot, the world's catch-up; a `: hb` comment every 15 s; closed
// after 30 min (the browser reconnects). At most 4 per client and `total` (MAP_SSE_MAX) in all; more are
// refused (the route answers 503 + Retry-After). A client is an IPv4 address or an IPv6 /64 (address.ts: one
// IPv6 host owns a whole /64, so exact addresses would let it take every stream of the site). A stream whose
// reader stops reading is closed, not buffered.
import type { Result } from "#lib/api/result.ts";
import type { MapChanges, MapPlayers } from "#lib/api/types.ts";
import { tileVersion } from "#lib/map/links.ts";
import { addressKey } from "./address.ts";
import type { LiveState, PlayerDot, PlayersEvent, PlayersSnapshot, StatusEvent, TilesEvent } from "#lib/map/types.ts";

export type Clock = {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

export const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => {
    const t = setTimeout(fn, ms);
    (t as { unref?: () => void }).unref?.();
    return t;
  },
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>)
};

export type LiveDeps = {
  /** GET /v2/map/{server}/players (hidden players already left out by the map client) */
  players(server: string): Promise<Result<MapPlayers>>;
  /** GET /v2/map/{server}/worlds/{world}/changes; `off` = this world has no change log */
  changes(server: string, world: string): Promise<Result<MapChanges>>;
  /**
   * The worlds /v2/map lists for this server now (through the LRU), null when unknown. A player on a world not
   * listed (a mini world that turned private, a world that left) is not sent; unknown keeps the last known list.
   */
  worlds?(server: string): Promise<ReadonlySet<string> | null>;
  /** squaremap's player update interval for this server (the largest of its worlds), null when unknown */
  playerUpdateMs(server: string): Promise<number | null>;
  /**
   * GET /v2/map/{server}/worlds/{world}/markers at background priority (FMK-3): only `rev` is read. Through the map
   * client's LRU, so a revalidation is an `If-None-Match` request (a 304 costs one token and no body). Optional: a hub
   * without it sends no `markers` events. `not_found` = no markers access for this world.
   */
  markers?(server: string, world: string): Promise<Result<{ rev: number }>>;
  /** may the live map show this server (not hidden, not One Soul)? asked at every subscribe and every poll */
  visible(server: string): boolean;
  /** an opted-out player (hidden.ts): never in any frame */
  hiddenPlayer(p: { uuid: string; name: string }): boolean;
  clock?: Clock;
  limits?: Partial<LiveLimits>;
  /** one line per notable event; never a token or URL */
  log?: (line: string) => void;
};

export type LiveLimits = {
  /** streams per client: an IPv4 address or an IPv6 /64 (address.ts) */
  perIp: number;
  /** streams in all (MAP_SSE_MAX) */
  total: number;
  /** a stream is closed after this long; the browser reconnects with `retry` */
  maxAgeMs: number;
  heartbeatMs: number;
  /** the hub keeps polling this long after its last stream left */
  idleMs: number;
  /** floor of the players poll (brief: max(2 s, player_update_ms)) */
  minPollMs: number;
  /** ceiling of the players poll, whatever squaremap says */
  maxPollMs: number;
  changesMs: number;
  /** a watched world's markers are revalidated this long after the last answer (the markers tier's TTL is 30 s) */
  markersMs: number;
  /** a world without a change log (or gone) is asked again after this long */
  noLogRetryMs: number;
  /** positions off (`404 off`) or server not on the map: ask again after this long */
  offRetryMs: number;
  /** how long a stale answer or a failure still counts as "stale" before "offline" */
  staleMs: number;
  /** the last good snapshot of a server is kept this long after its hub stopped (players.json, reconnects) */
  keepMs: number;
  /** a stream with more than this many bytes queued unread is closed */
  maxQueuedBytes: number;
  /** players.json waits this long for a hub's first answer */
  firstAnswerMs: number;
  /** `retry:` sent to the browser */
  retryMs: number;
  /** player_update_ms is asked again after this long */
  intervalRefreshMs: number;
};

export const DEFAULT_LIMITS: LiveLimits = {
  perIp: 4,
  total: 500,
  maxAgeMs: 30 * 60_000,
  heartbeatMs: 15_000,
  idleMs: 30_000,
  minPollMs: 2_000,
  maxPollMs: 60_000,
  changesMs: 5_000,
  markersMs: 30_000,
  noLogRetryMs: 5 * 60_000,
  offRetryMs: 60_000,
  staleMs: 30_000,
  keepMs: 24 * 60 * 60_000,
  maxQueuedBytes: 1024 * 1024,
  firstAnswerMs: 2_500,
  retryMs: 5_000,
  intervalRefreshMs: 5 * 60_000
};

/** Where a stream's frames go. `write` returns the bytes still queued unread (0 when unknown). */
export type Sink = {
  write(frame: string): number;
  /** end the stream from the hub's side (30 min, hidden server, slow reader, shutdown) */
  end(): void;
};

export type SubscribeRequest = {
  server: string;
  /** the client's address; the limit counts it by `addressKey` (IPv4 address, IPv6 /64) */
  ip: string;
  /** the world shown: its change log is polled and its `tiles` events sent; null = positions only */
  world?: string | null;
  /** the log the page loaded with: catch-up sends only what is newer (or a reset); without it the whole log */
  since?: { epoch: string; seq: number } | null;
  sink: Sink;
};

export type Refusal = { reason: "per_ip" | "total" | "hidden"; retryAfter: number };
export type Subscription = { close(): void };

export interface LiveHub {
  subscribe(req: SubscribeRequest): { ok: true; sub: Subscription } | ({ ok: false } & Refusal);
  /**
   * The last snapshot for players.json. Starts the server's hub (or keeps it 30 s longer); on a cold start waits
   * up to `firstAnswerMs` for the first answer. null = no answer yet and none kept (or the server is not shown).
   */
  snapshot(server: string): Promise<PlayersSnapshot | null>;
  /** numbers for /healthz and tests: no names, no positions */
  stats(): { streams: number; hubs: { server: string; streams: number; polling: boolean; worlds: string[]; state: LiveState }[] };
  /** close every stream and stop every poller */
  stop(): void;
}

// ---- frames

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
export const HEARTBEAT = ": hb\n\n";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A row of the players answer as a dot: floored to the block, or null when it is not well formed. */
export function toDot(p: unknown): PlayerDot | null {
  if (!p || typeof p !== "object") return null;
  const r = p as Record<string, unknown>;
  if (typeof r.uuid !== "string" || typeof r.name !== "string" || typeof r.world !== "string") return null;
  const uuid = r.uuid.toLowerCase();
  if (!UUID.test(uuid)) return null;
  const x = Number(r.x);
  const z = Number(r.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  const yaw = Number(r.yaw);
  return { uuid, name: r.name, world: r.world, x: Math.floor(x) || 0, z: Math.floor(z) || 0, yaw: Number.isFinite(yaw) ? Math.round(yaw) || 0 : 0 };
}

const sameDot = (a: PlayerDot, b: PlayerDot) => a.x === b.x && a.z === b.z && a.world === b.world && a.yaw === b.yaw && a.name === b.name;

/** What changed between two snapshots: new or moved dots, and the uuids that left. */
export function diffDots(prev: ReadonlyMap<string, PlayerDot>, next: ReadonlyMap<string, PlayerDot>): { players: PlayerDot[]; gone: string[] } {
  const players: PlayerDot[] = [];
  const gone: string[] = [];
  for (const [k, d] of next) {
    const p = prev.get(k);
    if (!p || !sameDot(p, d)) players.push(d);
  }
  for (const k of prev.keys()) if (!next.has(k)) gone.push(k);
  return { players, gone };
}

type Row = [number, number, number, number];
const isRow = (r: unknown): r is Row => Array.isArray(r) && r.length >= 4 && r.slice(0, 4).every((n) => Number.isInteger(n));

/** The `tiles` event for the rows of a log newer than `after` (all when `after` is null). */
function tilesEvent(world: string, log: Log, after: number | null, reset: boolean): TilesEvent {
  const tiles: TilesEvent["tiles"] = [];
  for (const [seq, z, x, y] of log.rows) if (after === null || seq > after) tiles.push([tileVersion(log.epoch, seq), z, x, y]);
  return { world, epoch: log.epoch, tiles, reset };
}

type Log = { epoch: string; seq: number; dropped: number; rows: Row[] };

function toLog(c: MapChanges): Log | null {
  if (typeof c.epoch !== "string" || !c.epoch || !Number.isInteger(c.seq) || !Number.isInteger(c.dropped) || !Array.isArray(c.tiles)) return null;
  const rows = c.tiles.filter(isRow).map((r) => [r[0], r[1], r[2], r[3]] as Row);
  return { epoch: c.epoch, seq: c.seq, dropped: c.dropped, rows };
}

// ---- the hub

type Stream = {
  id: number;
  server: string;
  ip: string;
  world: string | null;
  /** where the stream stands in its world's change log: what the page loaded with, then the last position sent */
  at: { epoch: string; seq: number } | null;
  sink: Sink;
  /** got its full players snapshot */
  primed: boolean;
  /** heard its world's log at least once */
  caught: boolean;
  closed: boolean;
  hb: unknown;
  age: unknown;
};

type WorldPoll = {
  id: string;
  watchers: number;
  /** stop polling at this time when nobody watches (idle window) */
  idleUntil: number;
  log: Log | null;
  timer: unknown;
  inFlight: boolean;
  alive: boolean;
  /** markers revalidation (FMK-3): the last `rev` seen (null = none yet, so the next one fires nothing), its timer */
  mrev: number | null;
  mtimer: unknown;
  minFlight: boolean;
  /** polling markers now: while watched, until a 404 or the last watcher leaves */
  mon: boolean;
};

type ServerHub = {
  server: string;
  streams: Set<Stream>;
  dots: Map<string, PlayerDot> | null;
  at: number;
  state: LiveState;
  /** time of the last fresh answer */
  goodAt: number;
  intervalMs: number;
  intervalAt: number;
  /** the worlds the server lists (last known), null = never known */
  listed: ReadonlySet<string> | null;
  timer: unknown;
  inFlight: boolean;
  idle: unknown;
  /** players.json keeps the hub until then */
  touchedUntil: number;
  worlds: Map<string, WorldPoll>;
  alive: boolean;
  first: Promise<void>;
  firstDone: () => void;
};

export function createLiveHub(deps: LiveDeps): LiveHub {
  const clock = deps.clock ?? realClock;
  const L: LiveLimits = { ...DEFAULT_LIMITS, ...deps.limits };
  const log = deps.log ?? (() => {});
  const hubs = new Map<string, ServerHub>();
  /** last good snapshot per server, kept past the hub (keepMs) */
  const kept = new Map<string, { dots: Map<string, PlayerDot>; at: number; keptAt: number }>();
  const perIp = new Map<string, number>();
  let total = 0;
  let nextId = 1;

  const visibleDots = (dots: Iterable<PlayerDot>) => [...dots].filter((d) => !deps.hiddenPlayer(d));

  function statusOf(h: ServerHub): StatusEvent {
    return { state: h.state, as_of: h.dots ? h.at : null };
  }

  function send(s: Stream, frame: string): void {
    if (s.closed) return;
    let queued = 0;
    try {
      queued = s.sink.write(frame);
    } catch {
      drop(s, true);
      return;
    }
    if (queued > L.maxQueuedBytes) {
      log(`map live: closed a stream of ${s.server} that stopped reading`);
      drop(s, true);
    }
  }

  function prime(h: ServerHub, s: Stream): void {
    if (s.primed || !h.dots) return;
    s.primed = true;
    const ev: PlayersEvent = { at: h.at, players: visibleDots(h.dots.values()), gone: [] };
    send(s, sse("players", ev));
  }

  /**
   * Brings one stream level with a world's log, from where that stream stands (`s.at`: the log position the page
   * loaded with, then the last one sent). `frames` shares the encoded event between streams at the same position.
   *   - no position: the whole log, once (not a reset: the page has no versions to throw away);
   *   - another epoch, or the log dropped rows the stream never saw: a reset with the whole log;
   *   - behind: the rows it has not seen;
   *   - level, or ahead of the hub: nothing. Ahead is normal, not a log gone backwards: the page asked cakeutils for
   *     the log when it loaded, the hub up to `changesMs` earlier (FM-7: this used to be a reset, so a page that
   *     loaded just after a tile changed reloaded every tile).
   */
  function deliver(w: WorldPoll, s: Stream, frames?: Map<string, string>, force = false): void {
    const log = w.log;
    if (!log || s.closed) return;
    const at = s.at;
    const first = !s.caught;
    s.caught = true;
    const reset = force || (!!at && (at.epoch !== log.epoch || log.dropped > at.seq));
    const after = !at || reset ? null : at.seq;
    s.at = { epoch: log.epoch, seq: after === null ? log.seq : Math.max(after, log.seq) };
    if (after !== null && log.seq <= after) return;
    const key = `${reset ? "r" : ""}${after ?? ""}`;
    let frame = frames?.get(key);
    if (frame === undefined) {
      const ev = tilesEvent(w.id, log, after, reset);
      // a stream without a position hears the log even when it is empty (it then knows the epoch)
      frame = ev.reset || ev.tiles.length || (first && !at) ? sse("tiles", ev) : "";
      frames?.set(key, frame);
    }
    if (frame) send(s, frame);
  }

  function setState(h: ServerHub, state: LiveState): void {
    if (h.state === state) return;
    h.state = state;
    const frame = sse("status", statusOf(h));
    for (const s of h.streams) send(s, frame);
  }

  // ---- players poll

  function arm(h: ServerHub, ms: number): void {
    if (!h.alive) return;
    clock.clearTimeout(h.timer);
    h.timer = clock.setTimeout(() => void poll(h), Math.max(0, ms));
  }

  async function interval(h: ServerHub): Promise<void> {
    if (h.intervalAt && clock.now() - h.intervalAt < L.intervalRefreshMs) return;
    h.intervalAt = clock.now();
    try {
      const ms = await deps.playerUpdateMs(h.server);
      if (ms !== null && Number.isFinite(ms) && ms > 0) h.intervalMs = Math.min(L.maxPollMs, Math.max(L.minPollMs, ms));
    } catch {
      /* keep the last known */
    }
  }

  async function poll(h: ServerHub): Promise<void> {
    if (!h.alive || h.inFlight) return;
    if (!deps.visible(h.server)) return shutdown(h, "hidden");
    h.inFlight = true;
    const started = clock.now();
    let next = h.intervalMs;
    try {
      const [r, listed] = await Promise.all([
        deps.players(h.server).catch(() => ({ ok: false, kind: "down" }) as Result<MapPlayers>),
        deps.worlds ? deps.worlds(h.server).catch(() => null) : Promise.resolve(null),
        interval(h)
      ]);
      if (listed) h.listed = listed;
      if (!h.alive) return;
      if (!deps.visible(h.server)) return shutdown(h, "hidden");
      next = h.intervalMs;
      if (r.ok) {
        const dots = new Map<string, PlayerDot>();
        for (const row of Array.isArray(r.data.players) ? r.data.players : []) {
          const d = toDot(row);
          if (d && !deps.hiddenPlayer(d) && (!h.listed || h.listed.has(d.world))) dots.set(d.uuid, d);
        }
        const at = Number.isFinite(r.data.updated_at) && r.data.updated_at > 0 ? r.data.updated_at : clock.now();
        apply(h, dots, at);
        if (r.data.stale) setState(h, "stale");
        else {
          h.goodAt = clock.now();
          setState(h, "live");
        }
      } else if (r.kind === "off" || r.kind === "not_found") {
        // positions off for this server (or it left the map): nobody to draw; the page reads live_players from /v2/map
        apply(h, new Map(), clock.now());
        h.goodAt = clock.now();
        setState(h, r.kind === "off" ? "live" : "offline");
        next = L.offRetryMs;
      } else {
        // cakeutils or the backend unreachable, or throttled: keep the last dots, say how old they are
        setState(h, h.dots && clock.now() - h.goodAt < L.staleMs ? "stale" : "offline");
        next = Math.max(h.intervalMs, (r.retryAfter ?? 5) * 1000);
      }
    } finally {
      h.inFlight = false;
      h.firstDone();
      // the interval is measured from the start of the poll, so the cadence is the interval, not interval + latency
      if (h.alive) arm(h, next - (clock.now() - started));
    }
  }

  function apply(h: ServerHub, dots: Map<string, PlayerDot>, at: number): void {
    const prev = h.dots;
    h.dots = dots;
    h.at = at;
    kept.set(h.server, { dots, at, keptAt: clock.now() });
    if (prev) {
      const d = diffDots(prev, dots);
      if (d.players.length || d.gone.length) {
        const ev: PlayersEvent = { at, players: visibleDots(d.players), gone: d.gone };
        const frame = sse("players", ev);
        for (const s of h.streams) if (s.primed) send(s, frame);
      }
    }
    for (const s of h.streams) prime(h, s);
  }

  // ---- change logs

  function armWorld(h: ServerHub, w: WorldPoll, ms: number): void {
    if (!h.alive || !w.alive) return;
    clock.clearTimeout(w.timer);
    w.timer = clock.setTimeout(() => void pollWorld(h, w), Math.max(0, ms));
  }

  function stopWorld(h: ServerHub, w: WorldPoll): void {
    w.alive = false;
    clock.clearTimeout(w.timer);
    stopMarkers(w);
    h.worlds.delete(w.id);
  }

  async function pollWorld(h: ServerHub, w: WorldPoll): Promise<void> {
    if (!h.alive || !w.alive || w.inFlight) return;
    if (w.watchers === 0 && clock.now() >= w.idleUntil) return stopWorld(h, w);
    w.inFlight = true;
    const started = clock.now();
    let next = L.changesMs;
    try {
      const r = await deps.changes(h.server, w.id).catch(() => ({ ok: false, kind: "down" }) as Result<MapChanges>);
      if (!h.alive || !w.alive) return;
      const got = r.ok ? toLog(r.data) : null;
      if (got) applyLog(h, w, got);
      else if (!r.ok && (r.kind === "off" || r.kind === "not_found")) next = L.noLogRetryMs;
      else if (!r.ok && r.retryAfter) next = Math.max(L.changesMs, r.retryAfter * 1000);
    } finally {
      w.inFlight = false;
      if (h.alive && w.alive) armWorld(h, w, next - (clock.now() - started));
    }
  }

  function applyLog(h: ServerHub, w: WorldPoll, got: Log): void {
    const prev = w.log;
    w.log = got;
    // the hub itself saw the log go backwards inside one epoch (cakeutils starts a new epoch instead): reload every tile
    const backwards = !!prev && got.epoch === prev.epoch && got.seq < prev.seq;
    const frames = new Map<string, string>();
    for (const s of [...h.streams]) if (s.world === w.id) deliver(w, s, frames, backwards);
  }

  // ---- markers (FMK-3): one revalidation per watched world per markersMs; `markers` events to that world's streams

  function stopMarkers(w: WorldPoll): void {
    w.mon = false;
    w.mrev = null;
    clock.clearTimeout(w.mtimer);
    w.mtimer = null;
  }

  function startMarkers(h: ServerHub, w: WorldPoll): void {
    if (!deps.markers || w.mon) return;
    w.mon = true;
    w.mrev = null;
    void pollMarkers(h, w);
  }

  async function pollMarkers(h: ServerHub, w: WorldPoll): Promise<void> {
    if (!deps.markers || !h.alive || !w.alive || !w.mon || w.minFlight) return;
    if (w.watchers === 0 || !deps.visible(h.server)) return stopMarkers(w);
    w.minFlight = true;
    let next = L.markersMs;
    try {
      const r = await deps.markers(h.server, w.id).catch(() => ({ ok: false, kind: "down" }) as Result<{ rev: number }>);
      if (!h.alive || !w.alive || !w.mon || w.watchers === 0) return;
      if (r.ok) {
        // an answer served stale (cakeutils down) says nothing new
        if (!r.stale && Number.isInteger(r.data?.rev)) {
          const prev = w.mrev;
          w.mrev = r.data.rev;
          if (prev !== null && prev !== r.data.rev) {
            const frame = sse("markers", { world: w.id, rev: r.data.rev });
            for (const s of [...h.streams]) if (s.world === w.id) send(s, frame);
          }
        }
      } else if (r.kind === "not_found" || r.kind === "off" || r.kind === "bad_request") {
        // this world has no markers access: quiet until somebody starts watching it again
        return stopMarkers(w);
      } else if (r.retryAfter) next = Math.max(L.markersMs, r.retryAfter * 1000);
    } finally {
      w.minFlight = false;
      // measured from the answer, not the request: the cached answer is fresh for 30 s after it, so an earlier tick would only hit the LRU
      if (h.alive && w.alive && w.mon) {
        clock.clearTimeout(w.mtimer);
        w.mtimer = clock.setTimeout(() => void pollMarkers(h, w), next);
      }
    }
  }

  function watch(h: ServerHub, world: string): void {
    let w = h.worlds.get(world);
    if (!w) {
      w = { id: world, watchers: 0, idleUntil: 0, log: null, timer: null, inFlight: false, alive: true, mrev: null, mtimer: null, minFlight: false, mon: false };
      h.worlds.set(world, w);
      w.watchers++;
      void pollWorld(h, w);
      startMarkers(h, w);
      return;
    }
    w.watchers++;
    startMarkers(h, w);
  }

  function unwatch(h: ServerHub, world: string): void {
    const w = h.worlds.get(world);
    if (!w) return;
    w.watchers = Math.max(0, w.watchers - 1);
    if (w.watchers === 0) {
      w.idleUntil = clock.now() + L.idleMs;
      stopMarkers(w);
    }
  }

  // ---- hub lifecycle

  function hubOf(server: string): ServerHub {
    let h = hubs.get(server);
    if (h) return h;
    let firstDone = () => {};
    const first = new Promise<void>((r) => (firstDone = r));
    const k = kept.get(server);
    const fresh = k && clock.now() - k.keptAt < L.keepMs ? k : null;
    h = {
      server,
      streams: new Set(),
      dots: fresh ? new Map(fresh.dots) : null,
      at: fresh?.at ?? 0,
      // a kept snapshot is old until the first answer says otherwise
      state: fresh ? "stale" : "live",
      goodAt: 0,
      intervalMs: L.minPollMs,
      intervalAt: 0,
      listed: null,
      timer: null,
      inFlight: false,
      idle: null,
      touchedUntil: 0,
      worlds: new Map(),
      alive: true,
      first,
      firstDone
    };
    hubs.set(server, h);
    log(`map live: polling ${server}`);
    void poll(h);
    return h;
  }

  function armIdle(h: ServerHub): void {
    if (!h.alive) return;
    clock.clearTimeout(h.idle);
    h.idle = null;
    if (h.streams.size > 0) return;
    const until = Math.max(clock.now() + L.idleMs, h.touchedUntil);
    h.idle = clock.setTimeout(() => {
      if (h.streams.size === 0 && clock.now() >= h.touchedUntil) shutdown(h, "idle");
      else armIdle(h);
    }, until - clock.now());
  }

  function shutdown(h: ServerHub, why: "idle" | "hidden" | "stop"): void {
    if (!h.alive) return;
    h.alive = false;
    clock.clearTimeout(h.timer);
    clock.clearTimeout(h.idle);
    for (const w of [...h.worlds.values()]) stopWorld(h, w);
    for (const s of [...h.streams]) drop(s, true);
    if (why === "hidden") kept.delete(h.server);
    h.firstDone();
    if (hubs.get(h.server) === h) hubs.delete(h.server);
    log(`map live: stopped ${h.server} (${why})`);
  }

  /** Remove a stream; `end` = the hub ends it (else the browser already went). */
  function drop(s: Stream, end: boolean): void {
    if (s.closed) return;
    s.closed = true;
    clock.clearTimeout(s.hb);
    clock.clearTimeout(s.age);
    total--;
    const n = (perIp.get(s.ip) ?? 1) - 1;
    if (n > 0) perIp.set(s.ip, n);
    else perIp.delete(s.ip);
    const h = hubs.get(s.server);
    if (h && h.streams.delete(s)) {
      if (s.world) unwatch(h, s.world);
      armIdle(h);
    }
    if (end) {
      try {
        s.sink.end();
      } catch {
        /* already gone */
      }
    }
  }

  function heartbeat(s: Stream): void {
    s.hb = clock.setTimeout(() => {
      if (s.closed) return;
      send(s, HEARTBEAT);
      if (!s.closed) heartbeat(s);
    }, L.heartbeatMs);
  }

  for (const [k, v] of Object.entries(L)) if (!Number.isFinite(v) || v < 0) throw new Error(`map live: limit ${k} must be a non-negative number`);

  return {
    subscribe(req) {
      if (!deps.visible(req.server)) return { ok: false, reason: "hidden", retryAfter: 0 };
      if (total >= L.total) return { ok: false, reason: "total", retryAfter: 30 };
      const ip = addressKey(req.ip);
      if ((perIp.get(ip) ?? 0) >= L.perIp) return { ok: false, reason: "per_ip", retryAfter: 30 };
      const h = hubOf(req.server);
      const s: Stream = {
        id: nextId++,
        server: req.server,
        ip,
        world: req.world ?? null,
        at: req.since ? { epoch: req.since.epoch, seq: req.since.seq } : null,
        sink: req.sink,
        primed: false,
        caught: false,
        closed: false,
        hb: null,
        age: null
      };
      total++;
      perIp.set(ip, (perIp.get(ip) ?? 0) + 1);
      h.streams.add(s);
      clock.clearTimeout(h.idle);
      h.idle = null;
      send(s, `retry: ${L.retryMs}\n\n`);
      send(s, sse("status", statusOf(h)));
      prime(h, s);
      if (s.world) {
        watch(h, s.world);
        const w = h.worlds.get(s.world);
        if (w) deliver(w, s);
      }
      heartbeat(s);
      s.age = clock.setTimeout(() => drop(s, true), L.maxAgeMs);
      return { ok: true, sub: { close: () => drop(s, false) } };
    },

    async snapshot(server) {
      if (!deps.visible(server)) {
        kept.delete(server);
        return null;
      }
      const cold = !hubs.has(server);
      const h = hubOf(server);
      h.touchedUntil = Math.max(h.touchedUntil, clock.now() + L.idleMs);
      armIdle(h);
      // a cold hub's kept snapshot may be old: wait (briefly) for the first answer
      if (!h.dots || (cold && h.inFlight)) {
        let t: unknown = null;
        await Promise.race([h.first, new Promise<void>((r) => (t = clock.setTimeout(r, L.firstAnswerMs)))]);
        clock.clearTimeout(t);
      }
      if (!deps.visible(server)) return null;
      const src = h.dots ? { dots: h.dots, at: h.at } : null;
      if (!src) return null;
      return { server, at: src.at, state: h.state, players: visibleDots(src.dots.values()) };
    },

    stats() {
      return {
        streams: total,
        hubs: [...hubs.values()].map((h) => ({ server: h.server, streams: h.streams.size, polling: h.alive, worlds: [...h.worlds.keys()], state: h.state }))
      };
    },

    stop() {
      for (const h of [...hubs.values()]) shutdown(h, "stop");
    }
  };
}
