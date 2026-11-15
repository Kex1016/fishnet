// /map/<server> (FM-0 skeleton; FM-4 builds the page, FM-8 adds ?follow=): one server's map. A server that is
// not on /v2/map (no map, hidden, One Soul, unknown) is a 404 like any page that does not exist.
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { mapApi } from "#lib/server/cakeutils/client.ts";
import { parseMapLink } from "#lib/map/links.ts";

export const load: PageServerLoad = async ({ params, url }) => {
  const servers = await mapApi().mapServers();
  const entry = servers.ok ? servers.data.servers.find((s) => s.server === params.server) : undefined;
  if (servers.ok && !entry) error(404, "Not found");
  if (!servers.ok && servers.kind !== "down" && servers.kind !== "rate_limited") error(404, "Not found");
  const name = entry?.display_name ?? params.server;
  return {
    title: `Map of ${name}`,
    crumbs: [{ label: "Map", href: "/map" }, { label: name }],
    server: params.server,
    entry: entry ?? null,
    link: parseMapLink(url),
    down: !servers.ok
  };
};
