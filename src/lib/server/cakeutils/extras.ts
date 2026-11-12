// The network routes planned in cakeutils (WEBSITE-BRIEF §3.5, API-EXPANSION §4): firsts, criteria, deaths,
// activity, playtime milestones and board history. On the shared transport (one cache, one request budget).
// Each group is probed once and remembered 10 min: a 404 (or 401/403) hides its widgets (`off`), never
// confused with "nothing yet". Hidden servers and One Soul servers leave every answer: rows naming them are
// dropped, their scopes answer not_found, and network reads ask cakeutils without them (`exclude=`).
import { fail, type Result } from "#lib/api/result.ts";
import type { Scope } from "#lib/api/scope.ts";
import { shortType, type Metric } from "#lib/api/metric.ts";
import type {
  ActivityHeatmap, BoardHistory, CriteriaFeed, DeathFeed, FirstsFeed, OnlineSeries, PlayerActivity, PlayerCriteria, PlaytimeMilestones, PlaytimeSeries
} from "#lib/network/types.ts";
import type { Core, Priority } from "./core.ts";
import type { ServerList } from "../hidden-servers-list.ts";

export type Feature = "firsts" | "criteria" | "deaths" | "activity" | "playtimeMilestones" | "history";

const PROBES: Record<Feature, string> = {
  firsts: "/v2/firsts?limit=1",
  criteria: "/v2/milestones/criteria?limit=1",
  deaths: "/v2/deaths?limit=1",
  activity: "/v2/activity/online?bucket=day",
  playtimeMilestones: "/v2/milestones/playtime?limit=1",
  history: "/v2/leaderboards/history/playtime?limit=1"
};
const CHECK_MS = 10 * 60_000;

type Params = Record<string, string | number | boolean | undefined | null>;
type Page = { limit?: number; offset?: number };

export interface Extras {
  enabled(f: Feature): Promise<boolean>;
  firsts(q?: Page & { scope?: Scope; kinds?: string[]; since?: number }): Promise<Result<FirstsFeed>>;
  criteria(q?: Page & { scope?: Scope; advancement?: string }): Promise<Result<CriteriaFeed>>;
  playerCriteria(ref: string, q?: Page & { scope?: Scope; advancement?: string }): Promise<Result<PlayerCriteria>>;
  deaths(q?: Page & { scope?: Scope; player?: string; since?: number; until?: number }): Promise<Result<DeathFeed>>;
  activityPlaytime(q?: { scope?: Scope; player?: string; since?: number; until?: number; bucket?: "day" | "week" | "month" }): Promise<Result<PlaytimeSeries>>;
  activityHeatmap(q?: { scope?: Scope; player?: string; since?: number; until?: number }): Promise<Result<ActivityHeatmap>>;
  activityOnline(q?: { scope?: Scope; since?: number; until?: number; bucket?: "5m" | "hour" | "day" }): Promise<Result<OnlineSeries>>;
  playerActivity(ref: string, scope?: Scope): Promise<Result<PlayerActivity>>;
  playtimeMilestones(q?: Page & { scope?: Scope }): Promise<Result<PlaytimeMilestones>>;
  history(metric: Metric, q?: { scope?: Scope; since?: number; until?: number; limit?: number }): Promise<Result<BoardHistory>>;
}

export function createExtras(core: Core, o: { priority: () => Priority; hidden: () => ServerList; exclude: () => readonly string[]; now?: () => number }): Extras {
  const now = o.now ?? Date.now;
  const get = <T>(path: string) => core.get<T>({ path }, o.priority());
  const enc = encodeURIComponent;
  const q = (p: Params) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== "" && !(k === "scope" && v === "network")) s.set(k, String(v));
    const t = s.toString();
    return t ? `?${t}` : "";
  };
  /** network-scope reads leave the hidden and One Soul servers out (D-113) */
  const qx = (p: Params) => {
    const ex = o.exclude();
    const network = p.scope === undefined || p.scope === "network";
    return q(network && ex.length ? { ...p, exclude: ex.join(",") } : p);
  };
  const known = new Map<Feature, { at: number; on: boolean }>();

  async function enabled(f: Feature): Promise<boolean> {
    const t = now();
    const k = known.get(f);
    if (k && t - k.at < CHECK_MS) return k.on;
    const r = await get<unknown>(PROBES[f]);
    let on: boolean | null = null;
    if (r.ok && !r.stale) on = true;
    else if (!r.ok && r.kind === "bad_request") on = true;
    else if (!r.ok && (r.kind === "not_found" || r.status === 401 || r.status === 403)) on = false;
    if (on === null) return k?.on ?? r.ok;
    known.set(f, { at: t, on });
    return on;
  }

  const hiddenScope = (scope: Scope | undefined) => !!scope && o.hidden().hidesScope(scope);
  /** rows that name a hidden or One Soul server leave the list; `total` drops by as many */
  function dropRows<T extends { total: number }, K extends keyof T>(r: Result<T>, key: K): Result<T> {
    const l = o.hidden();
    if (!r.ok || l.size === 0) return r;
    const rows = r.data[key] as unknown as { server?: string | null }[];
    if (!Array.isArray(rows)) return r;
    const kept = rows.filter((x) => !l.has(x.server ?? null));
    return { ...r, data: { ...r.data, [key]: kept, total: Math.max(0, r.data.total - (rows.length - kept.length)) } };
  }
  const gated = async <T>(f: Feature, scope: Scope | undefined, run: () => Promise<Result<T>>): Promise<Result<T>> => {
    if (!(await enabled(f))) return fail("off");
    if (hiddenScope(scope)) return fail("not_found", { status: 404 });
    return run();
  };

  return {
    enabled,
    firsts: (p = {}) => gated("firsts", p.scope, async () => dropRows(await get<FirstsFeed>(`/v2/firsts${qx({ ...p, kinds: p.kinds?.join(",") })}`), "firsts")),
    criteria: (p = {}) => gated("criteria", p.scope, async () => dropRows(await get<CriteriaFeed>(`/v2/milestones/criteria${qx(p)}`), "criteria")),
    playerCriteria: (ref, p = {}) => gated("criteria", p.scope, () => get<PlayerCriteria>(`/v2/players/${enc(ref)}/advancement-criteria${qx(p)}`)),
    deaths: (p = {}) => gated("deaths", p.scope, async () => dropRows(await get<DeathFeed>(`/v2/deaths${qx(p)}`), "deaths")),
    activityPlaytime: (p = {}) => gated("activity", p.scope, () => get<PlaytimeSeries>(`/v2/activity/playtime${qx({ ...p, tz_offset_min: 0 })}`)),
    activityHeatmap: (p = {}) => gated("activity", p.scope, () => get<ActivityHeatmap>(`/v2/activity/heatmap${qx({ ...p, tz_offset_min: 0 })}`)),
    activityOnline: (p = {}) => gated("activity", p.scope, () => get<OnlineSeries>(`/v2/activity/online${qx(p)}`)),
    playerActivity: (ref, scope) =>
      gated("activity", scope, async () => {
        const r = await get<PlayerActivity>(`/v2/players/${enc(ref)}/activity${qx({ scope })}`);
        // the longest session on a hidden server keeps its length but not the server's name
        return r.ok && r.data.longest_session && o.hidden().has(r.data.longest_session.server) ? { ...r, data: { ...r.data, longest_session: { ...r.data.longest_session, server: null } } } : r;
      }),
    playtimeMilestones: (p = {}) => gated("playtimeMilestones", p.scope, () => get<PlaytimeMilestones>(`/v2/milestones/playtime${qx(p)}`)),
    history: (m, p = {}) =>
      gated("history", p.scope, () =>
        get<BoardHistory>(m.kind === "playtime" ? `/v2/leaderboards/history/playtime${qx(p)}` : `/v2/leaderboards/history/${enc(shortType(m.type))}/${enc(m.subject)}${qx(p)}`)
      )
  };
}
