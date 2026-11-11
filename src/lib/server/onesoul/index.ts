// The One Soul section's server side: the configured client, which servers are One Soul (standalone.ts),
// and the section's own stat client (sectionApi: One Soul servers not hidden there).
import { sectionApi, sharedCore } from "../cakeutils/client.ts";
import { hiddenServers } from "../hidden-servers.ts";
import { createOneSoulClient, type OneSoulClient } from "./client.ts";
import { setStandalone, standaloneIds, standaloneStale } from "./standalone.ts";
import type { Network } from "#lib/api/types.ts";
import type { StatusServer } from "#lib/onesoul/types.ts";

export { sectionApi };
export type { OneSoulClient };

let instance: OneSoulClient | null = null;

export function oneSoul(): OneSoulClient {
  instance ??= createOneSoulClient(sharedCore());
  return instance;
}

type NetServer = Network["servers"][number] & { standalone?: boolean; game?: string | null };

let flight: Promise<void> | null = null;

/**
 * Refreshes which servers are One Soul, at most once a minute (single-flight). Reads the raw network (not
 * the hiding client) and the One Soul status; keeps the last known answer when cakeutils is down.
 */
export function ensureStandalone(): Promise<void> {
  if (!standaloneStale()) return Promise.resolve();
  flight ??= (async () => {
    try {
      const core = sharedCore();
      const [net, status] = await Promise.all([core.get<Network>({ path: "/v2/network" }, "page"), oneSoul().status()]);
      if (!net.ok && !status.ok && (net.kind === "down" || net.kind === "rate_limited")) return; // keep what we had
      const ids = new Set<string>();
      let flag = false;
      if (net.ok) {
        for (const s of net.data.servers as NetServer[]) {
          if ("standalone" in s) flag = true;
          if (s.standalone === true || s.game === "onesoul") ids.add(s.id);
        }
      }
      if (status.ok) for (const s of status.data.servers) ids.add(s.server);
      setStandalone(ids, flag);
    } finally {
      flight = null;
    }
  })();
  return flight;
}

/** The One Soul servers the section may show (the owner's hide list still applies). */
export function visibleOneSoul(servers: StatusServer[]): StatusServer[] {
  const hidden = hiddenServers();
  return servers.filter((s) => !hidden.has(s.server));
}

export function isOneSoulServer(id: string | null | undefined): boolean {
  return !!id && standaloneIds().includes(id);
}
