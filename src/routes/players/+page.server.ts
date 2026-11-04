// Players (W5): the directory. Search, the online filter and paging are the API's own
// (/v2/players is ordered by name); each page's playtime comes from one batch call (PLAN §2.3).
// Hidden players leave the page before anything renders; the count stays the API's (a hidden
// player is still a player the network has seen).
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { withoutHidden } from "#lib/server/hidden.ts";
import type { BatchPlayer } from "#lib/api/types.ts";

const LIMIT = 48;

export const load: PageServerLoad = async ({ url }) => {
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 64);
  const online = url.searchParams.get("online") === "true" ? true : undefined;
  const offset = Math.max(0, Math.floor(Number(url.searchParams.get("offset") ?? 0) || 0));
  const c = api();
  const [players, network] = await Promise.all([c.players({ q: q || undefined, online, limit: LIMIT, offset }), c.network()]);
  const rows = players.ok ? withoutHidden(players.data.players) : [];
  if (players.ok) players.data.players = rows;

  // playtime per row, when there are rows; a failure here only loses the playtime column
  const playtime: Record<string, BatchPlayer["playtime"]> = {};
  let batchDown = false;
  if (rows.length) {
    const b = await c.batch(
      rows.map((p) => p.uuid),
      ["playtime"]
    );
    if (b.ok) for (const p of b.data.players) playtime[p.uuid] = p.playtime;
    else batchDown = true;
  }
  const serverNames: Record<string, string> = {};
  if (network.ok) for (const s of network.data.servers) serverNames[s.id] = s.display_name;

  const title = q ? `Players matching “${q}”` : online ? "Online players" : "Players";
  return {
    title: "Players",
    crumbs: [{ label: "Players", href: "/players" }],
    heading: title,
    players,
    playtime,
    batchDown,
    serverNames,
    totalOnline: network.ok ? network.data.total_online : null,
    q,
    online: !!online,
    limit: LIMIT,
    offset
  };
};
