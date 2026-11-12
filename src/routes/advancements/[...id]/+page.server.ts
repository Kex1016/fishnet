// One advancement (D-111): its first earner in the network and on each server where someone has it, with how
// many players have it there. The id is the rest of the path (`minecraft:story/mine_diamond`); `minecraft:`
// may be omitted, as the API allows. An id nobody ever reported is a 200 with an empty state, like a board
// nobody is on; an id that is not even shaped like one is a 404.
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api, extras } from "#lib/server/cakeutils/client.ts";
import { hideFromAdvancement } from "#lib/milestones/prepare.server.ts";
import { advCategory, advTitle, fullAdvId, isAdvId } from "#lib/milestones/advancements.ts";

export const load: PageServerLoad = async ({ params }) => {
  const raw = params.id;
  if (!raw || !isAdvId(raw)) error(404, "No such advancement");
  const id = fullAdvId(raw);
  const c = api();
  const [network, detail, criteria] = await Promise.all([c.network(), c.advancement(id), extras().criteria({ advancement: id, limit: 100 })]);
  if (!detail.ok && detail.kind === "off") error(404, "This proxy has no advancement milestones");

  const serverNames: Record<string, string> = {};
  if (network.ok) for (const s of network.data.servers) serverNames[s.id] = s.display_name;

  const title = advTitle({ advancement: id, title: detail.ok ? detail.data.title : null });
  return {
    title,
    crumbs: [{ label: "Advancements", href: "/advancements" }, { label: title }],
    id,
    category: advCategory(id),
    detail: hideFromAdvancement(detail),
    /** who first earned each part of it, network-wide (cakeutils B1); null when the proxy has no such route */
    criteria: criteria.ok ? [...criteria.data.criteria].sort((a, b) => a.criterion.localeCompare(b.criterion)) : null,
    serverNames
  };
};
