// One subject (W6): its names by kind, every board it is on in the chosen scope (who leads each),
// and its milestone ladder for one of its types (?type=).
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { fullType } from "#lib/api/metric.ts";
import { scopeParam } from "#lib/api/scope.ts";
import { subjectName, titleCase } from "#lib/players/names.ts";
import { withoutHidden } from "#lib/server/hidden.ts";
import { hideFromLadder } from "#lib/milestones/prepare.server.ts";
import { scopeLabel, scopeMinis } from "../../../leaderboards/board.ts";

export const load: PageServerLoad = async ({ params, url }) => {
  const c = api();
  const subject = await c.subject(params.subject);
  if (!subject.ok && subject.kind === "not_found") error(404, "No such subject");
  const scope = scopeParam(url);
  const keys = subject.ok ? [...subject.data.types] : [];

  const typeParam = url.searchParams.get("type");
  const firstType = (typeParam && keys.includes(fullType(typeParam)) ? fullType(typeParam) : keys[0]) as string | undefined;
  // milestones are tracked per server and for the network, never per mini-server (D-109)
  const miniScope = scope.startsWith("mini:");

  const [network, minis, types, boards, ladder] = await Promise.all([
    c.network(),
    c.miniServers(),
    c.statTypes(),
    Promise.all(keys.map((t) => c.leaderboard({ kind: "stat", type: t, subject: params.subject }, scope, { limit: 1 }))),
    firstType && !miniScope ? c.milestoneLadder(firstType, params.subject, scope) : null
  ]);

  const typeName = (key: string) => (types.ok ? types.data.types.find((t) => t.key === key)?.name : null) ?? titleCase(key);
  const names = subject.ok ? subject.data.names : [];
  const primary = names[0];
  const label = subjectName(primary?.name, params.subject);
  const servers = network.ok ? network.data.servers : [];
  const miniList = scopeMinis(scope, minis.ok ? minis.data.mini_servers.map((m) => ({ server: m.server, id: m.id, display_name: m.display_name })) : []);
  return {
    title: label,
    crumbs: [{ label: "Stats", href: "/stats" }, { label }],
    key: params.subject,
    label,
    subject,
    scope,
    scopeName: scopeLabel(scope, servers, miniList),
    network,
    minis: miniList,
    /** one row per type the subject has data under */
    boards: keys.map((t, i) => {
      const r = boards[i];
      const leader = r.ok ? (withoutHidden(r.data.entries)[0] ?? null) : null;
      return {
        type: t,
        typeName: typeName(t),
        result: r.ok ? { ok: true as const, total: r.data.total, empty: r.empty, stale: r.stale, asOf: r.asOf, leader } : { ok: false as const, kind: r.kind }
      };
    }),
    firstType: firstType ?? null,
    firstTypeName: firstType ? typeName(firstType) : null,
    miniScope,
    ladder: ladder ? hideFromLadder(ladder) : null
  };
};
