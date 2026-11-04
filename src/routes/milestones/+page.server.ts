// Milestones (W7): feed, filter by scope and type, per-day heatmap, "firsts" per player.
// 404 when the proxy has no milestones (the nav entry is hidden too).
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { scopeParam } from "#lib/api/scope.ts";
import { withoutHidden } from "#lib/server/hidden.ts";

export const load: PageServerLoad = async ({ url }) => {
  const scope = scopeParam(url);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  const limit = 50;
  const [network, feed] = await Promise.all([api().network(), api().milestones({ scope, type: url.searchParams.get("type") ?? undefined, limit, offset })]);
  if (!feed.ok && feed.kind === "off") error(404, "This proxy has no milestones");
  if (feed.ok) feed.data.milestones = feed.data.milestones.filter((m) => !m.uuid || !m.name || withoutHidden([{ uuid: m.uuid, name: m.name }]).length);
  return { title: "Milestones", crumbs: [{ label: "Milestones", href: "/milestones" }], network, scope, feed, limit, offset };
};
