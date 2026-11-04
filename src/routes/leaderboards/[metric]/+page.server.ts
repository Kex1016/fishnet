import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { parseMetric } from "#lib/api/metric.ts";
import { scopeParam } from "#lib/api/scope.ts";
import { withoutHidden } from "#lib/server/hidden.ts";

export const load: PageServerLoad = async ({ params, url }) => {
  const metric = parseMetric(params.metric);
  if (!metric) error(404, "No such board");
  const scope = scopeParam(url);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  const limit = 50;
  const [network, board] = await Promise.all([api().network(), api().leaderboard(metric, scope, { limit, offset })]);
  if (board.ok) board.data.entries = withoutHidden(board.data.entries);
  const label = metric.kind === "playtime" ? "Playtime" : params.metric;
  return { title: label, crumbs: [{ label: "Leaderboards", href: "/leaderboards" }, { label }], metric, scope, network, board, limit, offset };
};
