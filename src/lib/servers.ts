// Names of servers and scopes for labels. A server's name is its `display_name` from /v2/network; a server
// the network answer does not list (hidden, gone, or cakeutils down) falls back to its id.
import type { Result } from "#lib/api/result.ts";
import { parseScope, type Scope } from "#lib/api/scope.ts";
import type { Network } from "#lib/api/types.ts";

type Named = { id: string; display_name: string };
type NamedMini = { server: string; id: string; display_name: string };

/** Server id → display name, from the network answer ({} when it could not be read). */
export function serverNameMap(network: Result<Network>): Record<string, string> {
  const names: Record<string, string> = {};
  if (network.ok) for (const s of network.data.servers) names[s.id] = s.display_name;
  return names;
}

/** "Network", "Survival" (a server's display name), "Skyblock 1" (a mini), or the raw id as a fallback. */
export function scopeLabel(scope: Scope | string, servers: Named[] = [], minis: NamedMini[] = []): string {
  const p = parseScope(scope);
  if (!p || p.kind === "network") return "Network";
  if (p.kind === "server") return servers.find((s) => s.id === p.server)?.display_name ?? p.server;
  return minis.find((m) => m.server === p.server && m.id === p.mini)?.display_name ?? p.mini;
}
