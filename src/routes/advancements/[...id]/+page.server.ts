// One advancement (D-111): its first earner in the network and on each server where someone has it, with how
// many players have it there. The id is the rest of the path (`minecraft:story/mine_diamond`); `minecraft:`
// may be omitted, as the API allows. Below it, every player who has it in the chosen scope, in the order they
// got it (cakeutils listAdvancementEarners; the section is left out on a proxy without that route). Opted-out
// players leave that list (extras.ts). An id nobody ever reported is a 200 with an empty state, like a board
// nobody is on; an id that is not even shaped like one is a 404.
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { scopeParam } from "#lib/api/scope.ts";
import { fail } from "#lib/api/result.ts";
import { offsetParam } from "#lib/url.ts";
import { api, extras } from "#lib/server/cakeutils/client.ts";
import { hideFromAdvancement } from "#lib/milestones/prepare.server.ts";
import { advancementIcon } from "#lib/milestones/pictures.server.ts";
import { advCategory, advTitle, fullAdvId, isAdvId } from "#lib/milestones/advancements.ts";
import { serverNameMap } from "#lib/servers.ts";

const EARNERS = 50;

export const load: PageServerLoad = async ({ params, url }) => {
  const raw = params.id;
  if (!raw || !isAdvId(raw)) error(404, "No such advancement");
  const id = fullAdvId(raw);
  const c = api();
  const x = extras();
  const scope = scopeParam(url);
  const miniScope = scope.startsWith("mini:");
  const offset = offsetParam(url);
  const [network, detail, criteria, icon, earners] = await Promise.all([
    c.network(),
    c.advancement(id),
    x.criteria({ advancement: id, limit: 100 }),
    advancementIcon(id),
    miniScope ? Promise.resolve(fail("bad_request")) : x.advancementEarners(id, { scope, limit: EARNERS, offset })
  ]);
  if (!detail.ok && detail.kind === "off") error(404, "This proxy has no advancement milestones");

  const serverNames = serverNameMap(network);

  const title = advTitle({ advancement: id, title: detail.ok ? detail.data.title : null });
  return {
    title,
    crumbs: [{ label: "Advancements", href: "/advancements" }, { label: title }],
    id,
    category: advCategory(id),
    /** the catalogue's icon of the item the game shows for it, or null */
    icon,
    detail: hideFromAdvancement(detail),
    /** who first earned each part of it, network-wide (cakeutils B1); null when the proxy has no such route */
    criteria: criteria.ok ? [...criteria.data.criteria].sort((a, b) => a.criterion.localeCompare(b.criterion)) : null,
    serverNames,
    servers: network.ok ? network.data.servers : [],
    scope,
    miniScope,
    /** who has it in `scope`, earliest first; `off` when the proxy has no such route */
    earners,
    limit: EARNERS,
    offset
  };
};
