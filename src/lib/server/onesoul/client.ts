// The One Soul client (cakeutils `/v2/onesoul*`, scope read:onesoul), on the same transport core as the
// regular client (cache, ETag, single-flight, stale-on-error, the token bucket), so the site's request budget
// is shared. Server code only; nothing here reaches a browser.
//
// Feature detection (WEBSITE-BRIEF §3.5): each planned route group is probed once and remembered 10 min;
// a 404 (route not on this proxy) or a 401/403 (the token lacks read:onesoul) means "hide that widget".
// Callers get `off` for a group the proxy does not have, so pages never confuse "missing route" with
// "nothing here" (a 404 on one item still answers not_found).
import { fail, type Result } from "#lib/api/result.ts";
import type {
  EventList, FeatureCollection, GraveList, Journal, Live, MapIndex, PlayerOneSoul, Pranks, Registrations, RoundDetail, RoundList,
  SoulDetail, SoulList, SoulStats, Status, Trail, Waystones
} from "#lib/onesoul/types.ts";
import type { Core, Priority } from "../cakeutils/core.ts";
import { normalizeGuide } from "#lib/onesoul/guide/text.ts";
import type { Guide } from "#lib/onesoul/guide/types.ts";
import { hasPortalPlace, mapOk, refuseLiving, withoutPosition, withoutQueue, withoutRunningPortalPlaces } from "./privacy.ts";

export type Params = Record<string, string | number | boolean | undefined | null>;

/** Route groups as the cakeutils work units ship them (WEBSITE-EXPANSION-PLAN §3). */
export type Group = "status" | "live" | "tracking" | "map" | "guide";

const PROBES: Record<Group, string> = {
  status: "/v2/onesoul",
  live: "/v2/onesoul/live",
  // WE-12: rounds, soul detail, run stats, filters, pranks, the player route
  tracking: "/v2/onesoul/rounds?limit=1",
  // WE-13: trail, waystones, map index and layers
  map: "/v2/onesoul/map",
  // TH-26: the mod's guide snapshot (a 404 until the server has sent one: the tab stays away until then)
  guide: "/v2/onesoul/guide"
};

const CHECK_MS = 10 * 60_000;

export type SoulQuery = { server?: string; cycle?: number; uuid?: string; outcome?: string; sort?: "turn" | "duration" | "started"; order?: "asc" | "desc"; limit?: number; offset?: number };
export type GraveQuery = { server?: string; cycle?: number; claimed?: boolean; claimed_by?: string; soul?: string; limit?: number; offset?: number };
export type EventQuery = { server?: string; cycle?: number; since?: number; uuid?: string; kind?: string; limit?: number; offset?: number };
export type Where = { server?: string; cycle?: number };

export interface OneSoulClient {
  /** Which groups this proxy has (and whether the token may read them). */
  enabled(g: Group): Promise<boolean>;
  status(): Promise<Result<Status>>;
  live(server?: string): Promise<Result<Live>>;
  rounds(q?: { server?: string; limit?: number; offset?: number }): Promise<Result<RoundList>>;
  round(cycle: number, server?: string): Promise<Result<RoundDetail>>;
  souls(q?: SoulQuery): Promise<Result<SoulList>>;
  soul(turn: number, w?: Where): Promise<Result<SoulDetail>>;
  soulStats(turn: number, w?: Where & { type?: string; q?: string; limit?: number; offset?: number }): Promise<Result<SoulStats>>;
  trail(turn: number, w?: Where & { max_points?: number }): Promise<Result<Trail>>;
  graves(q?: GraveQuery): Promise<Result<GraveList>>;
  journal(turn: number, w?: Where): Promise<Result<Journal>>;
  registrations(q?: { round?: number; limit?: number; offset?: number }): Promise<Result<Registrations>>;
  events(q?: EventQuery): Promise<Result<EventList>>;
  pranks(w?: Where): Promise<Result<Pranks>>;
  waystones(w?: Where): Promise<Result<Waystones>>;
  mapIndex(w?: Where): Promise<Result<MapIndex>>;
  mapLayer(layer: string, w?: Where & { dim?: string }): Promise<Result<FeatureCollection>>;
  player(ref: string): Promise<Result<PlayerOneSoul>>;
  /** The guide snapshot (TH-26), read defensively; `off` on a proxy without the route or before a guide arrived. */
  guide(server?: string): Promise<Result<Guide>>;
}

export function query(p: Params = {}): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  const t = s.toString();
  return t ? `?${t}` : "";
}

export function createOneSoulClient(core: Core, priority: () => Priority = () => "page", now: () => number = Date.now): OneSoulClient {
  // every answer passes the privacy guard (privacy.ts) before a page sees it
  const get = async <T>(path: string) => mapOk(await core.get<T>({ path }, priority()), withoutQueue);
  const enc = encodeURIComponent;
  const known = new Map<Group, { at: number; on: boolean }>();

  async function enabled(g: Group): Promise<boolean> {
    const t = now();
    const k = known.get(g);
    if (k && t - k.at < CHECK_MS) return k.on;
    const r = await get<unknown>(PROBES[g]);
    let on: boolean | null = null;
    if (r.ok && !r.stale) on = true;
    else if (!r.ok && r.kind === "bad_request") on = true; // the route exists, it disliked the probe
    else if (!r.ok && (r.kind === "not_found" || r.status === 401 || r.status === 403)) on = false;
    if (on === null) return k?.on ?? r.ok; // down or throttled: last known value
    known.set(g, { at: t, on });
    return on;
  }

  /** Is that soul the one playing now (from the status, cached)? A journal of theirs is never shown. */
  async function stillPlaying(cycle: number, turn: number, server: string): Promise<boolean> {
    const st = await core.get<Status>({ path: "/v2/onesoul" }, priority());
    if (!st.ok) return false;
    const s = st.data.servers.find((x) => x.server === server);
    if (!s?.soul || s.cycle !== cycle) return false;
    const souls = await core.get<SoulList>({ path: `/v2/onesoul/souls${query({ server, cycle, limit: 100 })}` }, priority());
    return souls.ok ? souls.data.souls.some((x) => x.turn === turn && x.outcome === "playing") : s.played === turn;
  }

  /** Is that round over (so a portal's position may be shown)? Older rounds are; the current one when it is in grace or ended. */
  async function roundOver(server: string | undefined, cycle: number | undefined): Promise<boolean> {
    const st = await core.get<Status>({ path: "/v2/onesoul" }, priority());
    if (!st.ok || cycle === undefined) return false;
    const s = server ? st.data.servers.find((x) => x.server === server) : st.data.servers[0];
    if (!s) return false;
    return cycle < s.cycle || (cycle === s.cycle && (s.state === "grace" || s.state === "ended"));
  }

  /** Runs `f` only when the group exists; `off` otherwise. */
  const gated = async <T>(g: Group, f: () => Promise<Result<T>>): Promise<Result<T>> => ((await enabled(g)) ? f() : fail("off"));

  return {
    enabled,
    status: async () =>
      mapOk(await gated("status", () => get<Status>("/v2/onesoul")), (d) => ({ ...d, servers: d.servers.map((s) => ({ ...s, soul: withoutPosition(s.soul) })) })),
    live: async (server) => mapOk(await gated("live", () => get<Live>(`/v2/onesoul/live${query({ server })}`)), (d) => ({ ...d, soul: withoutPosition(d.soul) })),
    rounds: (q = {}) => gated("tracking", () => get<RoundList>(`/v2/onesoul/rounds${query(q)}`)),
    round: (cycle, server) => gated("tracking", () => get<RoundDetail>(`/v2/onesoul/rounds/${cycle}${query({ server })}`)),
    // souls, graves and events exist today; the planned filters are only sent when the tracking group exists
    souls: async (q = {}) => {
      const { uuid, outcome, sort, order, ...base } = q;
      const extra = (uuid || outcome || sort || order) && (await enabled("tracking")) ? { uuid, outcome, sort, order } : {};
      if ((uuid || outcome) && !("uuid" in extra)) return fail("off");
      return gated("status", () => get<SoulList>(`/v2/onesoul/souls${query({ ...base, ...extra })}`));
    },
    soul: (turn, w = {}) => gated("tracking", () => get<SoulDetail>(`/v2/onesoul/souls/${turn}${query(w)}`)),
    soulStats: (turn, w = {}) => gated("tracking", () => get<SoulStats>(`/v2/onesoul/souls/${turn}/stats${query(w)}`)),
    // the living soul's trail is served live since TH-31 (design §8.1 [David], cakeutils OSD-73): not refused here
    trail: (turn, w = {}) => gated("map", () => get<Trail>(`/v2/onesoul/souls/${turn}/trail${query({ ...w, format: "points" })}`)),
    graves: async (q = {}) => {
      const { claimed_by, soul, ...base } = q;
      if ((claimed_by || soul) && !(await enabled("tracking"))) return fail("off");
      return gated("status", () => get<GraveList>(`/v2/onesoul/graves${query({ ...base, claimed_by, soul })}`));
    },
    journal: async (turn, w = {}) => {
      const r = await gated("status", () => get<Journal>(`/v2/onesoul/journals/${turn}${query(w)}`));
      return refuseLiving(r, r.ok && (await stillPlaying(r.data.soul.cycle, r.data.soul.turn, r.data.server)));
    },
    registrations: (q = {}) => gated("status", () => get<Registrations>(`/v2/onesoul/registrations${query(q)}`)),
    events: async (q = {}) => {
      const { uuid, kind, ...base } = q;
      if ((uuid || kind) && !(await enabled("tracking"))) return fail("off");
      const r = await gated("status", () => get<EventList>(`/v2/onesoul/events${query({ ...base, uuid, kind })}`));
      if (!r.ok || !hasPortalPlace(r.data)) return r;
      // defence in depth (TH-26): a portal event of a running round carries no place, whatever the proxy sent
      const over = new Map<number | undefined, boolean>();
      for (const e of r.data.events) if (!over.has(e.cycle)) over.set(e.cycle, await roundOver(q.server ?? e.server, e.cycle));
      return mapOk(r, (d) => withoutRunningPortalPlaces(d, (c) => over.get(c) ?? false));
    },
    pranks: (w = {}) => gated("tracking", () => get<Pranks>(`/v2/onesoul/pranks${query(w)}`)),
    waystones: (w = {}) => gated("map", () => get<Waystones>(`/v2/onesoul/waystones${query({ ...w, format: "list" })}`)),
    mapIndex: (w = {}) => gated("map", () => get<MapIndex>(`/v2/onesoul/map${query(w)}`)),
    mapLayer: (layer, w = {}) => {
      if (!/^[a-z]{1,32}$/.test(layer)) return Promise.resolve(fail("not_found"));
      return gated("map", () => get<FeatureCollection>(`/v2/onesoul/map/${layer}${query(w)}`));
    },
    player: (ref) => gated("tracking", () => get<PlayerOneSoul>(`/v2/players/${enc(ref)}/onesoul`)),
    guide: async (server) => {
      const r = await gated("guide", () => get<unknown>(`/v2/onesoul/guide${query({ server })}`));
      if (!r.ok) return r;
      const g = normalizeGuide(r.data);
      return g ? { ...r, data: g } : fail("down");
    }
  };
}
