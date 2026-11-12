// Deaths on the network (cakeutils GET /v2/deaths, B4): a feed newest first, the commonest causes and who
// died most, per server or the whole network. Positions only when the operator turned them on in cakeutils.
// One Soul deaths are never here (they are in the One Soul section).
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api, extras } from "#lib/server/cakeutils/client.ts";
import { scopeParam } from "#lib/api/scope.ts";
import type { Death } from "#lib/network/types.ts";
import { causeOf } from "#lib/network/deaths.ts";

const PAGE = 30;

export const load: PageServerLoad = async ({ url }) => {
  const x = extras();
  if (!(await x.enabled("deaths"))) error(404, "Not found");
  const scope = scopeParam(url);
  const mini = scope.startsWith("mini:");
  const offset = Math.max(0, Math.min(1_000_000, Number(url.searchParams.get("offset")) || 0));
  const [network, feed, recent] = await Promise.all([
    api().network(),
    mini ? Promise.resolve(null) : x.deaths({ scope, limit: PAGE, offset }),
    // the side boards count the newest 300 deaths (three reads), and say so
    mini ? Promise.resolve([]) : Promise.all([0, 100, 200].map((o) => x.deaths({ scope, limit: 100, offset: o })))
  ]);
  if (feed && !feed.ok && feed.kind === "not_found") error(404, "Not found");
  const rows: Death[] = [];
  for (const r of recent) if (r.ok) rows.push(...r.data.deaths);
  const unique = [...new Map(rows.map((d) => [`${d.uuid}-${d.at}-${d.server}`, d])).values()];
  const causes = new Map<string, number>();
  const who = new Map<string, { uuid: string; name: string; n: number }>();
  for (const d of unique) {
    const c = causeOf(d);
    causes.set(c, (causes.get(c) ?? 0) + 1);
    const w = who.get(d.uuid) ?? { uuid: d.uuid, name: d.name, n: 0 };
    w.n += 1;
    who.set(d.uuid, w);
  }
  const serverNames: Record<string, string> = {};
  if (network.ok) for (const s of network.data.servers) serverNames[s.id] = s.display_name;
  return {
    title: "Deaths",
    crumbs: [{ label: "Deaths", href: "/deaths" }],
    network,
    serverNames,
    scope,
    mini,
    feed,
    limit: PAGE,
    offset,
    counted: unique.length,
    total: feed?.ok ? feed.data.total : 0,
    causes: [...causes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10),
    who: [...who.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, 10)
  };
};
