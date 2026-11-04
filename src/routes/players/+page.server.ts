// Players (W5): directory with search, online filter, paging and faces.
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { withoutHidden } from "#lib/server/hidden.ts";

export const load: PageServerLoad = async ({ url }) => {
  const q = (url.searchParams.get("q") ?? "").slice(0, 64);
  const online = url.searchParams.get("online") === "true" ? true : undefined;
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  const limit = 50;
  const players = await api().players({ q: q || undefined, online, limit, offset });
  if (players.ok) players.data.players = withoutHidden(players.data.players);
  return { title: "Players", crumbs: [{ label: "Players", href: "/players" }], players, q, online: !!online, limit, offset };
};
