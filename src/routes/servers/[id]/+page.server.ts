// One server (W4): status, who is on, online and waiting over the week, its boards, milestones and
// live public mini-servers. Every board is read at scope `server:<id>`, which already includes the
// server's minis; scopes are never added together (cakeutils I3).
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { history } from "#lib/server/history.ts";
import { withoutHidden } from "#lib/server/hidden.ts";
import { FEATURED } from "#lib/boards.ts";
import { boardHref, PLAYTIME } from "#lib/api/metric.ts";
import { parseScope, type Scope } from "#lib/api/scope.ts";
import { formatStat, group } from "#lib/format/stat-display.ts";
import type { TimePoint } from "#lib/charts/index.ts";
import { prepareFeed } from "#lib/milestones/prepare.server.ts";
import { barRows, boardSum, isOutage } from "../boards.ts";

export const load: PageServerLoad = async ({ params }) => {
  const id = params.id;
  if (parseScope(`server:${id}`)?.kind !== "server") error(404, "No such server");
  const scope: Scope = `server:${id}`;
  const c = api();
  const h = history();
  const featured = FEATURED.filter((b) => b.metric.kind === "stat");

  const [network, minis, online, playtime, stats, milestones, hist, onlineWeek, onlineRecent, presence] = await Promise.all([
    c.network(),
    c.miniServers(),
    c.players({ online: true, limit: 100 }),
    boardSum(c, PLAYTIME, scope, withoutHidden),
    Promise.all(featured.map((b) => c.leaderboard(b.metric, scope, { limit: 5 }))),
    c.milestones({ scope, limit: 5 }).then(prepareFeed),
    h.server(id, "week"),
    h.online(scope, "week"),
    h.onlineRecent(scope),
    h.miniPresence(id, "week")
  ]);
  const server = network.ok ? network.data.servers.find((s) => s.id === id) : undefined;
  if (network.ok && !server) error(404, "No such server");
  const name = server?.display_name ?? id;

  const here = online.ok ? withoutHidden(online.data.players).filter((p) => p.server === id) : [];
  const live = minis.ok ? minis.data.mini_servers.filter((m) => m.server === id && m.public) : [];

  // Stat boards with something on them; a stat nobody ever recorded (404) or an empty scope has no card.
  const boards = featured.flatMap((b, i) => {
    const r = stats[i];
    if (!r.ok || r.empty) return [];
    return [{ id: b.id, label: b.label, href: boardHref(b.metric, scope), unit: r.data.unit, rows: barRows(withoutHidden(r.data.entries)), asOf: r.asOf, stale: r.stale }];
  });

  // Busiest minis: the most players seen in each mini this week, from the recorder.
  const names = new Map(live.map((m) => [m.id, m.display_name]));
  const busiest = Object.entries(presence)
    .map(([key, s]) => ({ key, label: names.get(key.slice(key.lastIndexOf("/") + 1)) ?? key.slice(key.lastIndexOf("/") + 1), peak: Math.max(0, ...s.points.map((p) => p.v)) }))
    .filter((m) => m.peak > 0)
    .sort((a, b) => b.peak - a.peak)
    .slice(0, 5)
    .map((m, i) => ({ rank: i + 1, key: m.key, label: m.label, v: m.peak, display: group(m.peak) }));

  const waitingLine: TimePoint[] = hist.samples.map((s) => ({ t: s.t, v: s.waiting }));

  return {
    title: name,
    crumbs: [{ label: "Servers", href: "/servers" }, { label: name, href: `/servers/${id}` }],
    id,
    scope,
    name,
    network,
    server,
    faces: here.map((p) => ({ uuid: p.uuid, name: p.name })),
    live: live.map((m) => ({ id: m.id, name: m.display_name, count: m.player_count, players: withoutHidden(m.players) })),
    busiest,
    playtime: playtime.ok
      ? { ok: true as const, empty: playtime.empty, players: playtime.data.players, time: formatStat("ms", playtime.data.sum), rows: barRows(playtime.data.top), asOf: playtime.asOf, stale: playtime.stale }
      : { ok: false as const, outage: isOutage(playtime) },
    boards,
    outage: stats.some(isOutage),
    milestones,
    onlineWeek,
    onlineRecent,
    waiting: waitingLine.length >= 2 ? waitingLine : [],
    samples: hist.samples,
    since: hist.since
  };
};
