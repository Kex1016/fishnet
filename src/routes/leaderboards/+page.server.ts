// Leaderboards (W6): playtime, featured boards, any stat from the catalogue; scope switch.
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { FEATURED } from "#lib/boards.ts";
import { scopeParam } from "#lib/api/scope.ts";
import { withoutHidden } from "#lib/server/hidden.ts";

export const load: PageServerLoad = async ({ url }) => {
  const scope = scopeParam(url);
  const c = api();
  const [network, ...boards] = await Promise.all([c.network(), ...FEATURED.map((b) => c.leaderboard(b.metric, scope, { limit: 10 }))]);
  const featured = FEATURED.map((b, i) => {
    const r = boards[i];
    if (r.ok) r.data.entries = withoutHidden(r.data.entries);
    return { ...b, result: r };
  });
  return { title: "Leaderboards", crumbs: [{ label: "Leaderboards", href: "/leaderboards" }], network, scope, featured };
};
