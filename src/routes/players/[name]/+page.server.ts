// Player profile (W5, PLAN §3.4): prefix/suffix, first and last seen, playtime by server and mini,
// standing on the featured boards, the stats explorer (by type, with icons and search), the scope
// switch, the milestone ladders (H3: thresholds passed, read against the player's own values), the milestones
// this player was first to and the advancements they completed first. Everything but the header follows ?scope=.
// Hidden players are a 404 before any other call (PLAN §3.4, §8.5).
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api, extras, mapApi } from "#lib/server/cakeutils/client.ts";
import { isHidden } from "#lib/server/hidden.ts";
import { parseScope, scopeOf, type Scope } from "#lib/api/scope.ts";
import { fail, ok, type Result } from "#lib/api/result.ts";
import type { BatchPlayer, Leaderboard, PlayerAdvancements, PlayerMilestones, StatList, StatValue } from "#lib/api/types.ts";
import { COMPOSITES, FEATURED } from "#lib/boards.ts";
import { featuredLeaderboard } from "#lib/server/featured.ts";
import { batchIncludes, compositeValue, standing, type BoardStanding } from "#lib/players/ranks.ts";
import { playtimeLadder, statLadder, type LadderView } from "#lib/players/ladders.ts";
import { playerLabel, splitMini, titleCase } from "#lib/players/names.ts";
import { showOnMap } from "#lib/map/showOnMap.ts";
import { prepareFeed } from "#lib/milestones/prepare.server.ts";
import { withAdvancementIcons } from "#lib/milestones/pictures.server.ts";
import { serverNameMap } from "#lib/servers.ts";
import { offsetParam } from "#lib/url.ts";

/** rows of a stat type shown per page in the explorer's type view */
const PAGE = 60;
/** the API's largest page; how many of them the explorer collects at most (PLAN §2.2: all pages, cheap and cached) */
const API_PAGE = 100;
const MAX_PAGES = 10;
/** how far down each featured board the page looks for the player */
const BOARD_PAGE = 100;
const TYPE_KEY = /^[a-z0-9_.-]{1,32}:[a-z0-9_./-]{1,64}$/;

/** Every page of a player's stats in one scope (ordered by type then subject by the API), as one list. */
async function collectStats(ref: string, scope: Scope, type: string | null, q: string): Promise<Result<StatList>> {
  const c = api();
  const base = { scope, type: type ?? undefined, q: q || undefined, limit: API_PAGE };
  const first = await c.playerStats(ref, { ...base, offset: 0 });
  if (!first.ok) return first;
  const rows: StatValue[] = [...first.data.stats];
  const total = first.data.total;
  const pages = Math.min(MAX_PAGES, Math.ceil(total / API_PAGE));
  if (pages > 1) {
    const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => c.playerStats(ref, { ...base, offset: (i + 1) * API_PAGE })));
    for (const r of rest) {
      if (!r.ok) return r; // a page failed: say so rather than show a short list
      rows.push(...r.data.stats);
    }
  }
  return ok({ ...first.data, stats: rows, total: Math.max(total, rows.length) }, first.asOf, { stale: first.stale, empty: first.empty || rows.length === 0 });
}

export const load: PageServerLoad = async ({ params, url }) => {
  if (isHidden(params.name)) error(404, "No such player");
  const c = api();
  const player = await c.player(params.name);
  if (!player.ok && player.kind === "not_found") error(404, "No such player");
  if (player.ok && isHidden(player.data.uuid)) error(404, "No such player");
  // the profile's own name: the API matches names case-insensitively, the rest of the page uses the uuid
  const ref = player.ok ? player.data.uuid : params.name;
  const name = player.ok ? player.data.name : params.name;

  const parsed = parseScope(url.searchParams.get("scope"));
  const scope = parsed ? scopeOf(parsed) : "network";
  const rawType = url.searchParams.get("type");
  const type = rawType && TYPE_KEY.test(rawType) ? rawType : null;
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 64);
  const offset = offsetParam(url);
  const miniScope = parsed?.kind === "mini";

  // the ladders of the featured stat boards that are one stat (a board that adds stats has no one ladder); read in
  // parallel with the rest. Milestones have no mini scope (PLAN §2.5): no call there.
  const ladderBoards = FEATURED.filter((b) => b.metric.kind === "stat" && !b.also);
  const ladderCalls = player.ok && !miniScope ? ladderBoards.map((b) => (b.metric.kind === "stat" ? c.milestoneLadder(b.metric.type, b.metric.subject, scope) : Promise.resolve(null))) : [];
  const activity = player.ok ? extras().playerActivity(ref) : Promise.resolve(null);
  // "Show on map" (FM-8): only an online player on a server the map knows needs the map's server list
  const maps = player.ok ? mapApi().mapServers() : Promise.resolve(null);
  const [network, types, minis, stats, firsts, advFirsts, me, ...boards] = await Promise.all([
    c.network(),
    c.statTypes(),
    c.miniServers(),
    collectStats(ref, scope, type, q),
    // milestones have no mini scope (PLAN §2.5): the section is left out there, no call made
    // W7's prepareFeed drops opted-out players and adds icons from the catalogue
    miniScope ? Promise.resolve(null) : c.playerMilestones(ref, { scope, limit: 10 }).then(prepareFeed),
    // advancement milestones (D-111) have no mini scope either; their rows name no player, so nothing to hide
    miniScope ? Promise.resolve(null) : c.playerAdvancements(ref, { scope, limit: 10 }).then((r) => withAdvancementIcons(r)),
    player.ok ? c.batch([ref], batchIncludes(FEATURED, COMPOSITES), scope) : Promise.resolve(null),
    ...(player.ok ? FEATURED.map((b) => featuredLeaderboard(c, b, scope, { limit: BOARD_PAGE })) : [])
  ] as const);

  // standings: a board that answers 404 does not exist yet and is left out (PLAN §3.4)
  const meRow: BatchPlayer | null = me?.ok ? (me.data.players[0] ?? null) : null;
  const standings: BoardStanding[] = [];
  let boardsDown = false;
  if (player.ok) {
    FEATURED.forEach((b, i) => {
      const board = boards[i] as Result<Leaderboard>;
      if (!board.ok && (board.kind === "down" || board.kind === "rate_limited")) boardsDown = true;
      const s = standing(b, board, meRow, player.data, scope, BOARD_PAGE);
      if (s) standings.push(s);
    });
  }
  const composites = COMPOSITES.map((cb) => ({ id: cb.id, label: cb.label, value: compositeValue(cb, meRow) })).filter((x) => x.value !== null);

  // ladders: the player's own value against each rung. No batch row, no ladder (a value of 0 is a row with no stat).
  const ladders: { id: string; label: string; view: LadderView }[] = [];
  let laddersDown = false;
  let laddersOff = false;
  const results = await Promise.all(ladderCalls);
  ladderBoards.forEach((b, i) => {
    const r = results[i];
    if (!r || b.metric.kind !== "stat") return;
    if (!r.ok) {
      if (r.kind === "off") laddersOff = true;
      else if (r.kind === "down" || r.kind === "rate_limited") laddersDown = true;
      return; // not_found: nobody recorded the stat yet, so there is no ladder
    }
    // the standing already holds the player's value in this scope (the board's own entry, else the batch row's)
    const st = standings.find((x) => x.id === b.id);
    const view = st ? statLadder(r.data, st.value, st.value > 0 ? st.unit : null) : null;
    if (view) ladders.push({ id: b.id, label: b.label, view });
  });
  const activityRes = await activity;
  const playtimeSteps = activityRes?.ok ? playtimeLadder(activityRes.data.playtime_milestones) : null;

  // names for the playtime breakdown and the scope switch
  const serverNames = serverNameMap(network);
  const miniNames: Record<string, string> = {};
  let currentMini: string | null = null;
  if (minis.ok) {
    for (const m of minis.data.mini_servers) {
      miniNames[`${m.server}/${m.id}`] = m.display_name;
      if (player.ok && m.players.some((p) => p.uuid === player.data.uuid)) currentMini = m.display_name;
    }
  }
  // minis for the switch: the ones this player has time on (public ones only reach the token)
  const miniOptions = player.ok
    ? Object.keys(player.data.playtime.by_mini)
        .map((k) => ({ key: k, parts: splitMini(k) }))
        .filter((x): x is { key: string; parts: { server: string; mini: string } } => x.parts !== null)
        .map(({ key, parts }) => ({ server: parts.server, id: parts.mini, display_name: miniNames[key] ?? titleCase(parts.mini) }))
    : [];

  const label = playerLabel(name);
  const mapList = await maps;
  const onMap =
    player.ok && mapList
      ? showOnMap({
          uuid: player.data.uuid,
          name: label,
          online: player.data.online,
          server: player.data.server ?? null,
          maps: mapList.ok ? mapList.data.servers : null,
          mapOff: !mapList.ok && (mapList.kind === "off" || mapList.kind === "not_found"),
          serverNames
        })
      : null;
  return {
    onMap,
    title: label,
    crumbs: [{ label: "Players", href: "/players" }, { label }],
    player,
    network,
    types,
    stats,
    firsts: (firsts ?? fail("bad_request")) as Result<PlayerMilestones>,
    advFirsts: (advFirsts ?? fail("bad_request")) as Result<PlayerAdvancements>,
    /** sessions, streaks and play time milestones (cakeutils B5), network-wide; null or off when absent */
    activity: activityRes,
    ladders,
    laddersDown,
    laddersOff,
    playtimeSteps,
    showFirsts: !miniScope,
    standings,
    boardsDown,
    composites,
    serverNames,
    miniNames,
    miniOptions,
    currentMini,
    scope,
    type,
    q,
    offset,
    limit: PAGE
  };
};
