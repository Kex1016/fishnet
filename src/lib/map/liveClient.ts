// The browser side of the live map (FM-4, brief §4.3): one EventSource on /map/<server>/live; after three failed
// attempts in a row (or without EventSource) it polls /map/<server>/players.json every 5 s instead. Tolerant of
// anything odd: a bad frame is dropped, never thrown. The page owns what the events mean; this only transports.
import { liveHref, playersJsonHref } from "./links.ts";
import { mergePlayers } from "./pages.ts";
import type { LiveState, PlayerDot, PlayersEvent, PlayersSnapshot, StatusEvent, TilesEvent } from "./types.ts";

export type LiveHandlers = {
  /** the whole current list of players of the server (already merged) */
  onPlayers: (players: PlayerDot[], at: number) => void;
  onTiles?: (ev: TilesEvent) => void;
  onStatus?: (state: LiveState, asOf: number | null) => void;
  /** "stream" or "poll": which transport is carrying the page now */
  onMode?: (mode: "stream" | "poll") => void;
  /**
   * Map markers (FMK-3 sends it, FMK-2 listens): the markers of `world` changed to `rev`; the page refetches
   * `markers.json` for that world and redraws without moving the view. Never fires for a world nobody watches.
   */
  onMarkers?: (ev: { world: string; rev: number }) => void;
};

export type LiveDeps = {
  EventSource?: typeof EventSource | undefined;
  fetch?: typeof fetch;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (t: unknown) => void;
};

export type LiveConnection = { close(): void };

/** The change log the page loaded with: the hub's catch-up sends only what is newer (brief §4.3). */
export type Since = { epoch: string; seq: number };

export const POLL_MS = 5000;
export const MAX_FAILURES = 3;
const RETRY_MS = [1000, 3000];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isDot = (v: unknown): v is PlayerDot => isObj(v) && typeof v.uuid === "string" && typeof v.name === "string" && typeof v.world === "string" && Number.isFinite(v.x) && Number.isFinite(v.z) && Number.isFinite(v.yaw);

function parse(data: unknown): unknown {
  if (typeof data !== "string") return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Connects to a server's live feed: `?world=&epoch=&seq=`, so the hub knows which change log to watch and where the
 * page stands in it (`since` null: the world has no change log). A reconnect resumes after the last tile event seen.
 */
export function connectLive(server: string, world: string, since: Since | null, h: LiveHandlers, deps: LiveDeps = {}): LiveConnection {
  const ES = "EventSource" in deps ? deps.EventSource : typeof EventSource !== "undefined" ? EventSource : undefined;
  const doFetch = deps.fetch ?? (typeof fetch !== "undefined" ? fetch.bind(globalThis) : undefined);
  const later = deps.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel = deps.clearTimeout ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));

  let closed = false;
  let es: EventSource | null = null;
  let timer: unknown = null;
  let failures = 0;
  let players: PlayerDot[] = [];
  let at: Since | null = since ? { ...since } : null;
  let fresh = true; // the next `players` event is a full snapshot (a connect or reconnect)

  function applyPlayers(ev: unknown): void {
    if (!isObj(ev) || !Array.isArray(ev.players)) return;
    const gone = Array.isArray(ev.gone) ? ev.gone.filter((g): g is string => typeof g === "string") : [];
    players = mergePlayers(players, { players: ev.players.filter(isDot), gone }, fresh);
    fresh = false;
    h.onPlayers(players, typeof ev.at === "number" ? ev.at : Date.now());
  }

  function startPolling(): void {
    h.onMode?.("poll");
    const tick = async () => {
      timer = null;
      if (closed) return;
      if (doFetch && !(typeof document !== "undefined" && document.hidden)) {
        try {
          const res = await doFetch(playersJsonHref(server), { headers: { accept: "application/json" } });
          if (res.ok && !closed) {
            const body = (await res.json()) as Partial<PlayersSnapshot>;
            if (Array.isArray(body.players)) {
              players = body.players.filter(isDot);
              h.onPlayers(players, typeof body.at === "number" ? body.at : Date.now());
              if (body.state === "live" || body.state === "stale" || body.state === "offline") h.onStatus?.(body.state, typeof body.at === "number" ? body.at : null);
            }
          }
        } catch {
          /* the next poll tries again */
        }
      }
      if (!closed) timer = later(tick, POLL_MS);
    };
    void tick();
  }

  function open(): void {
    if (closed) return;
    if (!ES) return startPolling();
    fresh = true;
    const q = `world=${encodeURIComponent(world)}${at ? `&epoch=${encodeURIComponent(at.epoch)}&seq=${at.seq}` : ""}`;
    const src = new ES(`${liveHref(server)}?${q}`);
    es = src;
    src.addEventListener("open", () => {
      failures = 0;
      h.onMode?.("stream");
    });
    src.addEventListener("players", (e) => applyPlayers(parse((e as MessageEvent).data)));
    src.addEventListener("tiles", (e) => {
      const v = parse((e as MessageEvent).data);
      if (isObj(v) && typeof v.world === "string" && Array.isArray(v.tiles)) {
        const ev = v as unknown as TilesEvent;
        if (typeof ev.epoch === "string") at = { epoch: ev.epoch, seq: Math.max(ev.epoch === at?.epoch ? at.seq : 0, ...ev.tiles.map((t) => Number(String(t[0]).split(".").pop()) || 0)) };
        h.onTiles?.(ev);
      }
    });
    src.addEventListener("status", (e) => {
      const v = parse((e as MessageEvent).data) as Partial<StatusEvent> | null;
      if (v && (v.state === "live" || v.state === "stale" || v.state === "offline")) h.onStatus?.(v.state, typeof v.as_of === "number" ? v.as_of : null);
    });
    src.addEventListener("error", () => {
      // the browser retries by itself while the stream is CONNECTING; a CLOSED stream (a 503, a bad type) is ours to retry
      if (closed || src.readyState !== 2) return;
      src.close();
      es = null;
      failures += 1;
      if (failures >= MAX_FAILURES) return startPolling();
      timer = later(() => {
        timer = null;
        open();
      }, RETRY_MS[Math.min(failures - 1, RETRY_MS.length - 1)]);
    });
  }

  open();
  return {
    close() {
      closed = true;
      es?.close();
      es = null;
      if (timer !== null) cancel(timer);
    }
  };
}
