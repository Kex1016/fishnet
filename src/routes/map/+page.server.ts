// /map (FM-4): every server with a map. One server: straight to its map (the query, a share link, travels along).
// Hidden and One Soul servers never arrive (mapApi hides them).
import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { mapApi } from "#lib/server/cakeutils/client.ts";
import { mapHref } from "#lib/map/links.ts";
import { sortWorlds, worldLabel } from "#lib/map/worlds.ts";

export const load: PageServerLoad = async ({ url }) => {
  const servers = await mapApi().mapServers();
  if (servers.ok && servers.data.servers.length === 1) {
    const only = servers.data.servers[0];
    redirect(307, mapHref(only.server) + url.search);
  }
  const list = servers.ok ? servers.data.servers.map((s) => ({ ...s, worlds: sortWorlds(s.worlds).map((w) => ({ id: w.id, name: worldLabel(w) })) })) : [];
  return { title: "Map", crumbs: [{ label: "Map", href: "/map" }], servers, list };
};
