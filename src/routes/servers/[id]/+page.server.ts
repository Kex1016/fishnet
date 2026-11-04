import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { history } from "#lib/server/history.ts";

export const load: PageServerLoad = async ({ params }) => {
  const network = await api().network();
  const server = network.ok ? network.data.servers.find((s) => s.id === params.id) : undefined;
  if (network.ok && !server) error(404, "No such server");
  const [playtime, hist] = await Promise.all([api().leaderboard({ kind: "playtime" }, `server:${params.id}`, { limit: 10 }), history().server(params.id, "week")]);
  const name = server?.display_name ?? params.id;
  return { title: name, crumbs: [{ label: "Servers", href: "/servers" }, { label: name, href: `/servers/${params.id}` }], network, server, playtime, hist };
};
