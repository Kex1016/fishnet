// Player profile (W5): prefix/suffix, first and last seen, playtime by server and mini, ranks,
// the stats explorer by type with icons and search, the scope switch, milestones they were first to.
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { isHidden } from "#lib/server/hidden.ts";
import { scopeParam } from "#lib/api/scope.ts";

export const load: PageServerLoad = async ({ params, url }) => {
  if (isHidden(params.name)) error(404, "No such player");
  const c = api();
  const player = await c.player(params.name);
  if (!player.ok && player.kind === "not_found") error(404, "No such player");
  if (player.ok && isHidden(player.data.uuid)) error(404, "No such player");
  const scope = scopeParam(url);
  const type = url.searchParams.get("type");
  const q = (url.searchParams.get("q") ?? "").slice(0, 64);
  const [network, types, stats, firsts] = await Promise.all([
    c.network(),
    c.statTypes(),
    c.playerStats(params.name, { scope, type: type ?? undefined, q: q || undefined, limit: 100 }),
    c.playerMilestones(params.name, { scope, limit: 10 })
  ]);
  const name = player.ok ? player.data.name : params.name;
  return { title: name, crumbs: [{ label: "Players", href: "/players" }, { label: name }], player, network, types, stats, firsts, scope, type, q };
};
