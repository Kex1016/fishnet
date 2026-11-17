// World firsts (cakeutils GET /v2/firsts, B8): one merged feed of who did something first, network or one
// server, filtered by kind. 404 when the proxy has no such route (the nav entry is hidden too).
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api, extras } from "#lib/server/cakeutils/client.ts";
import { scopeParam } from "#lib/api/scope.ts";
import { FIRST_KINDS } from "#lib/network/words.ts";
import { withFirstPictures } from "#lib/milestones/pictures.server.ts";
import { serverNameMap } from "#lib/servers.ts";
import { offsetParam } from "#lib/url.ts";

const PAGE = 40;

export const load: PageServerLoad = async ({ url }) => {
  const x = extras();
  if (!(await x.enabled("firsts"))) error(404, "Not found");
  const scope = scopeParam(url);
  const k = url.searchParams.get("kind");
  const kind = k && FIRST_KINDS.some((f) => f.id === k) ? k : null;
  const offset = offsetParam(url);
  const mini = scope.startsWith("mini:");
  const [network, feed] = await Promise.all([api().network(), mini ? Promise.resolve(null) : x.firsts({ scope, kinds: kind ? [kind] : undefined, limit: PAGE, offset }).then((r) => withFirstPictures(r))]);
  if (feed && !feed.ok && feed.kind === "not_found") error(404, "Not found");
  const serverNames = serverNameMap(network);
  return { title: "Firsts", crumbs: [{ label: "Firsts", href: "/firsts" }], network, serverNames, scope, mini, kind, feed, limit: PAGE, offset };
};
