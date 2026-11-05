// Hidden servers (src/lib/server/hidden-servers.ts) applied to every client answer, so pages, the
// recorder and the scope switches never see them:
// - a server or mini scope on a hidden server answers like an unknown one (not_found);
// - lists that name servers (network, mini-servers, players, batch, advancement rows and servers)
//   drop them; a player on a hidden server reads as offline, and the network's online count leaves
//   that server's players out (total_online minus the hidden servers' own counts, never a sum);
// - network figures come from cakeutils without the hidden servers (`exclude=`, D-113; create.ts
//   adds it), and cakeutils says so in `excluded`. A proxy that does not echo it (older than D-113)
//   still counts the hidden servers in network stats: exclusionStatus() reports that, and the layout
//   says it on every page instead of passing those numbers off as without them. Playtime is fixed
//   here in that case (network minus the hidden servers' by_server time is exact).
// Network stat milestones (D-109) cannot leave a server out at all; pages say so (HiddenNote).
import type {
  AdvancementDetail,
  AdvancementFeed,
  AdvancementHolder,
  BatchResponse,
  Leaderboard,
  MiniServers,
  Network,
  PlayerAdvancements,
  PlayerList,
  PlayerProfile,
  Playtime,
  StatList,
  StatRow
} from "#lib/api/types.ts";
import type { Scope } from "#lib/api/scope.ts";
import { fail, type Result } from "#lib/api/result.ts";
import type { Client } from "./client.ts";
import type { ServerList } from "../hidden-servers-list.ts";

/** How long one answer without the echo keeps the "network numbers include hidden servers" notice up. */
const NOTICE_MS = 15 * 60_000;

export type ExclusionStatus = {
  /** how many servers are hidden (their ids never leave the server side) */
  hidden: number;
  /** cakeutils answered a network read without `excluded` lately: its network stats still count hidden servers */
  unsupported: boolean;
};

export function hideServers(inner: Client, list: () => ServerList, now: () => number = Date.now): Client & { exclusionStatus(): ExclusionStatus } {
  let missingAt = -Infinity;

  /** Copies an ok answer through `f`; failures pass unchanged. Never mutates the (cached) original. */
  const map = <T>(r: Result<T>, f: (d: T, l: ServerList) => T): Result<T> => {
    const l = list();
    if (!r.ok || l.size === 0) return r;
    return { ...r, data: f(r.data, l) };
  };
  const hiddenScope = (scope: Scope | undefined) => list().hidesScope(scope);
  const notFound = <T>(): Promise<Result<T>> => Promise.resolve(fail("not_found", { status: 404 }));

  /** The echo has done its job once read: the hidden ids never travel on to a page's data. */
  const strip = <T>(d: T): T => (d && typeof d === "object" && "excluded" in d ? { ...d, excluded: [] } : d);

  /** True when cakeutils applied the exclusion (D-113); remembers when it did not. */
  const applied = (d: unknown, scope: Scope | undefined): boolean => {
    if (scope !== undefined && scope !== "network") return true;
    const ex = (d as { excluded?: unknown }).excluded;
    if (Array.isArray(ex)) return true;
    missingAt = now();
    return false;
  };

  const playtime = (p: Playtime, l: ServerList): Playtime => {
    const echoed = Array.isArray((p as { excluded?: unknown }).excluded);
    let total = p.total_ms;
    const by_server: Record<string, number> = {};
    for (const [id, ms] of Object.entries(p.by_server)) {
      if (!l.has(id)) by_server[id] = ms;
      else if (!echoed && p.scope === "network") total -= ms; // older proxy: network minus that server, exact
    }
    const by_mini: Record<string, number> = {};
    for (const [k, ms] of Object.entries(p.by_mini)) if (!l.hidesMiniKey(k)) by_mini[k] = ms;
    return { ...strip(p), total_ms: Math.max(0, total), by_server, by_mini };
  };

  const presence = <P extends { online: boolean; server: string | null }>(p: P, l: ServerList): P =>
    l.has(p.server) ? { ...p, online: false, server: null } : p;

  const holder = <H extends AdvancementHolder | null>(h: H, l: ServerList): H | null => (h && l.has(h.server) ? null : h);

  const client: Client & { exclusionStatus(): ExclusionStatus } = {
    ...inner,

    network: async () =>
      map(await inner.network(), (d: Network, l) => {
        const hidden = d.servers.filter((s) => l.has(s.id));
        const gone = hidden.reduce((n, s) => n + s.online, 0);
        return { ...d, servers: d.servers.filter((s) => !l.has(s.id)), total_online: Math.max(0, d.total_online - gone) };
      }),

    miniServers: async () => map(await inner.miniServers(), (d: MiniServers, l) => ({ ...d, mini_servers: d.mini_servers.filter((m) => !l.has(m.server)) })),

    players: async (q) =>
      map(await inner.players(q), (d: PlayerList, l) => {
        if (q?.online === true) {
          const players = d.players.filter((p) => !l.has(p.server));
          return { ...d, total: Math.max(0, d.total - (d.players.length - players.length)), players };
        }
        return { ...d, players: d.players.map((p) => presence(p, l)) };
      }),

    player: async (ref) =>
      map(await inner.player(ref), (d: PlayerProfile, l) => {
        applied(d.playtime, "network");
        return { ...presence(d, l), playtime: playtime(d.playtime, l) };
      }),

    playtime: async (ref, scope) => {
      if (hiddenScope(scope)) return notFound();
      return map(await inner.playtime(ref, scope), (d, l) => {
        applied(d, scope);
        return playtime(d, l);
      });
    },

    playerStats: async (ref, q) => {
      if (hiddenScope(q?.scope)) return notFound();
      return map(await inner.playerStats(ref, q), (d: StatList) => (applied(d, q?.scope), strip(d)));
    },

    playerStat: async (ref, type, subject, scope) => {
      if (hiddenScope(scope)) return notFound();
      return map(await inner.playerStat(ref, type, subject, scope), (d: StatRow) => (applied(d, scope), strip(d)));
    },

    batch: async (refs, include, scope) => {
      if (hiddenScope(scope)) return notFound();
      return map(await inner.batch(refs, include, scope), (d: BatchResponse, l) => {
        if (include.some((i) => i.startsWith("stats:"))) applied(d, scope);
        return { ...strip(d), players: d.players.map((p) => ({ ...presence(p, l), ...(p.playtime ? { playtime: playtime(p.playtime, l) } : {}) })) };
      });
    },

    leaderboard: async (metric, scope, page) => {
      if (hiddenScope(scope)) return notFound();
      return map(await inner.leaderboard(metric, scope, page), (d: Leaderboard) => (applied(d, scope), strip(d)));
    },

    milestones: async (q) => (hiddenScope(q?.scope) ? notFound() : inner.milestones(q)),
    milestoneLadder: async (type, subject, scope) => (hiddenScope(scope) ? notFound() : inner.milestoneLadder(type, subject, scope)),
    playerMilestones: async (ref, q) => (hiddenScope(q?.scope) ? notFound() : inner.playerMilestones(ref, q)),

    advancements: async (q) => {
      if (hiddenScope(q?.scope)) return notFound();
      const r = await inner.advancements(q);
      return map(r, (d: AdvancementFeed, l) => {
        if (applied(d, q?.scope)) return strip(d);
        // older proxy: a row first earned on a hidden server is dropped (who came next is unknown)
        const milestones = d.milestones.filter((m) => !l.has(m.server));
        return { ...d, total: Math.max(0, d.total - (d.milestones.length - milestones.length)), milestones };
      });
    },

    advancement: async (id) =>
      map(await inner.advancement(id), (d: AdvancementDetail, l) => {
        const servers = d.servers.filter((s) => !l.has(s.server));
        let network = d.network;
        if (!applied(d, "network") && network && l.has(network.server)) {
          // older proxy: the earliest holder on a visible server; earners there is a lower bound
          network = servers.reduce<AdvancementHolder | null>((a, s) => (!a || s.earned_at < a.earned_at ? s : a), null);
          if (network) network = { ...network, earners: Math.max(...servers.map((s) => s.earners)) };
        }
        return { ...strip(d), network: holder(network, l), servers };
      }),

    playerAdvancements: async (ref, q) => {
      if (hiddenScope(q?.scope)) return notFound();
      return map(await inner.playerAdvancements(ref, q), (d: PlayerAdvancements, l) => {
        if (applied(d, q?.scope)) return strip(d);
        const milestones = d.milestones.filter((m) => !l.has(m.server));
        return { ...d, total: Math.max(0, d.total - (d.milestones.length - milestones.length)), milestones };
      });
    },

    exclusionStatus: () => ({ hidden: list().size, unsupported: list().size > 0 && now() - missingAt < NOTICE_MS })
  };
  return client;
}
