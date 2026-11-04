// Home (W4 builds it): network status, stat tiles, online faces, latest milestones, joins per week,
// online over the week. W0 skeleton: network status and the online players from the contracts.
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { history } from "#lib/server/history.ts";
import { withoutHidden } from "#lib/server/hidden.ts";

export const load: PageServerLoad = async () => {
  const c = api();
  const [network, online, playtime, milestones, onlineWeek, since] = await Promise.all([
    c.network(),
    c.players({ online: true, limit: 100 }),
    c.leaderboard({ kind: "playtime" }, "network", { limit: 5 }),
    c.milestones({ limit: 5 }),
    history().online("network", "week"),
    history().recordingSince()
  ]);
  if (online.ok) online.data.players = withoutHidden(online.data.players);
  if (playtime.ok) playtime.data.entries = withoutHidden(playtime.data.entries);
  return { title: undefined, crumbs: [], network, online, playtime, milestones, onlineWeek, since };
};
