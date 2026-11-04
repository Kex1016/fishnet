// Home (W4): who is on right now, the network in numbers, playtime, online over the week, new players
// per week, latest milestones. Every number comes from the API or from the recorder (history).
// Each section keeps its own Result, so one failing call never blanks the page (PLAN §3.5).
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { history } from "#lib/server/history.ts";
import { withoutHidden } from "#lib/server/hidden.ts";
import { FEATURED } from "#lib/boards.ts";
import { boardHref, metricKey, PLAYTIME } from "#lib/api/metric.ts";
import type { Result } from "#lib/api/result.ts";
import { formatStat, group } from "#lib/format/stat-display.ts";
import { day } from "#lib/format/dates.ts";
import type { TimePoint } from "#lib/charts/index.ts";
import { prepareFeed } from "#lib/milestones/prepare.server.ts";
import { barRows, boardSum, isOutage, type BoardSum } from "./servers/boards.ts";

type Tile = { key: string; label: string; value: string; note?: string; href?: string; spark?: TimePoint[] };

type Totals =
  | { kind: "tiles"; tiles: Tile[]; asOf: number; stale: boolean; /** some totals could not be loaded */ missing: boolean }
  | { kind: "empty" }
  | { kind: "down" };

const show = (b: BoardSum) => (b.unit === "count" ? group(b.sum) : formatStat(b.unit, b.sum));

export const load: PageServerLoad = async () => {
  const c = api();
  const h = history();
  // Stat totals come from the featured boards (src/lib/boards.ts); playtime has its own tile.
  const featured = FEATURED.filter((b) => b.metric.kind === "stat");
  const boards = [{ id: "playtime", label: "Time played", metric: PLAYTIME }, ...featured];

  const [network, online, seen, sums, milestones, onlineWeek, onlineRecent, joins, since, series] = await Promise.all([
    c.network(),
    c.players({ online: true, limit: 100 }),
    c.players({ limit: 1 }),
    Promise.all(boards.map((b) => boardSum(c, b.metric, "network", withoutHidden))),
    c.milestones({ limit: 5 }).then(prepareFeed),
    h.online("network", "week"),
    h.onlineRecent("network"),
    h.joinsPerWeek("month"),
    h.recordingSince(),
    Promise.all(boards.map((b) => h.networkTotal(metricKey(b.metric), "network", "month")))
  ]);
  if (online.ok) online.data.players = withoutHidden(online.data.players);

  // The network in numbers. "Players seen" is the API's own count; the others add up players inside the
  // network scope (never scopes). A stat nobody ever recorded (404) gets no tile, and a network nobody
  // has played on gets one empty state instead of a row of zeros.
  const playtime = sums[0];
  let totals: Totals;
  if (!seen.ok || isOutage(playtime)) totals = { kind: "down" };
  else if (seen.data.total === 0) totals = { kind: "empty" };
  else {
    const tiles: Tile[] = [{ key: "seen", label: "Players seen", value: group(seen.data.total), href: "/players" }];
    const oks: Extract<Result<BoardSum>, { ok: true }>[] = [];
    sums.forEach((r, i) => {
      if (!r.ok) return;
      oks.push(r);
      const s = series[i];
      tiles.push({
        key: boards[i].id,
        label: boards[i].label,
        value: show(r.data),
        note: s.points.length >= 2 && s.since ? `since ${day(s.since)}` : r.data.complete ? undefined : `first ${group(r.data.players)} players`,
        href: boardHref(boards[i].metric),
        spark: s.points.length >= 2 ? s.points : undefined
      });
    });
    totals = {
      kind: "tiles",
      tiles: tiles.slice(0, 6),
      asOf: Math.min(seen.asOf, ...oks.map((r) => r.asOf)),
      stale: seen.stale || oks.some((r) => r.stale),
      missing: sums.some(isOutage)
    };
  }

  const top = playtime.ok ? { ok: true as const, rows: barRows(playtime.data.top), asOf: playtime.asOf, stale: playtime.stale } : { ok: false as const, rows: [], asOf: undefined, stale: false };
  return { title: undefined, crumbs: [], network, online, onlineRecent, totals, top, milestones, onlineWeek, joins, since };
};
