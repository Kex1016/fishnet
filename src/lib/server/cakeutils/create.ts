// The typed client over the transport core (core.ts): builds each route's path and keeps the
// signatures W0 froze in client.ts. Kept apart from client.ts so tests can import it without the
// SvelteKit env module.
import type { AdvancementFeed, MilestoneFeed } from "#lib/api/types.ts";
import { shortType } from "#lib/api/metric.ts";
import { fail } from "#lib/api/result.ts";
import type { Client, Icon } from "./client.ts";
import { createCore, type Core, type CoreOptions, type Priority } from "./core.ts";

export type { Priority };

export type ClientOptions = CoreOptions & {
  /** "page" (default) or "background"; a function is asked on every call (the recorder's context) */
  priority?: Priority | (() => Priority);
  /** share one cache, bucket and milestone check between clients */
  core?: Core;
  /**
   * Servers left out of network-scope figures (cakeutils D-113 `exclude=`), asked on every call: the
   * routes that take it get `exclude=<ids>` when their scope is the network. See hide.ts.
   */
  exclude?: () => readonly string[];
};

export function createClient(o: ClientOptions): Client {
  const core = o.core ?? createCore(o);
  const pr = o.priority ?? "page";
  const prio = typeof pr === "function" ? pr : () => pr;

  const get = <T>(path: string) => core.get<T>({ path }, prio());
  const q = (params: Record<string, string | number | boolean | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && !(k === "scope" && v === "network")) s.set(k, String(v));
    const t = s.toString();
    return t ? `?${t}` : "";
  };
  const enc = encodeURIComponent;
  // network-scope reads cakeutils can answer without some servers (D-113)
  const qx = (params: Record<string, string | number | boolean | undefined>) => {
    const ex = o.exclude?.() ?? [];
    const network = params.scope === undefined || params.scope === "network";
    return q(network && ex.length ? { ...params, exclude: ex.join(",") } : params);
  };

  const client: Client = {
    health: () => get("/v2/health"),
    network: () => get("/v2/network"),
    players: (p = {}) => get(`/v2/players${q(p)}`),
    player: (ref) => get(`/v2/players/${enc(ref)}${qx({})}`),
    playtime: (ref, scope) => get(`/v2/players/${enc(ref)}/playtime${qx({ scope })}`),
    playerStats: (ref, p = {}) => get(`/v2/players/${enc(ref)}/stats${qx(p)}`),
    playerStat: (ref, type, subject, scope) => get(`/v2/players/${enc(ref)}/stats/${enc(shortType(type))}/${enc(subject)}${qx({ scope })}`),
    batch: (refs, include, scope) => core.get({ path: `/v2/players:batch${qx({ scope })}`, method: "POST", body: JSON.stringify({ refs, include }) }, prio()),
    statTypes: () => get("/v2/stats/types"),
    subjects: (p = {}) => get(`/v2/stats/subjects${q(p)}`),
    subject: (key) => get(`/v2/stats/subjects/${enc(key)}`),
    leaderboard: (m, scope, page = {}) =>
      m.kind === "playtime"
        ? get(`/v2/leaderboards/playtime${qx({ scope, ...page })}`)
        : get(`/v2/leaderboards/stats/${enc(shortType(m.type))}/${enc(m.subject)}${qx({ scope, ...page })}`),
    miniServers: () => get("/v2/mini-servers"),
    icon: async (sha) => {
      if (!/^[0-9a-f]{64}$/.test(sha)) return fail("not_found");
      return core.get<Icon>({ path: `/v2/icons/${sha}.png`, binary: true }, prio());
    },
    milestonesEnabled: () => core.milestonesEnabled(prio()),
    milestones: async (p = {}) => {
      if (!(await client.milestonesEnabled())) return fail("off");
      return get<MilestoneFeed>(`/v2/milestones${q(p)}`);
    },
    milestoneLadder: async (type, subject, scope) => {
      if (!(await client.milestonesEnabled())) return fail("off");
      return get(`/v2/milestones/stats/${enc(shortType(type))}/${enc(subject)}${q({ scope })}`);
    },
    playerMilestones: async (ref, p = {}) => {
      if (!(await client.milestonesEnabled())) return fail("off");
      return get(`/v2/players/${enc(ref)}/milestones${q(p)}`);
    },
    advancementsEnabled: () => core.advancementsEnabled(prio()),
    advancements: async (p = {}) => {
      if (!(await client.advancementsEnabled())) return fail("off");
      return get<AdvancementFeed>(`/v2/milestones/advancements${qx(p)}`);
    },
    advancement: async (id) => {
      if (!(await client.advancementsEnabled())) return fail("off");
      return get(`/v2/milestones/advancement${qx({ id })}`);
    },
    playerAdvancements: async (ref, p = {}) => {
      if (!(await client.advancementsEnabled())) return fail("off");
      return get(`/v2/players/${enc(ref)}/advancement-milestones${qx(p)}`);
    }
  };
  return client;
}
