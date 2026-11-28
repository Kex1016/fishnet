// One round: its summary, records (GET /v2/onesoul/rounds/{cycle}), its souls and graves, and, where the
// proxy has round scopes, boards and firsts inside that round only (scope=round:<server>/<cycle>; the server
// scope is every round together, a separate figure, never a sum).
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import type { Leaderboard } from "#lib/api/types.ts";
import type { Result } from "#lib/api/result.ts";
import type { Scope } from "#lib/api/scope.ts";
import { oneSoul, sectionApi } from "#lib/server/onesoul/index.ts";
import { allGraves, allSouls, roundSummaries } from "#lib/server/onesoul/section.ts";
import { prepareAdvancements, prepareFeed } from "#lib/milestones/prepare.server.ts";
import { PLAYTIME } from "#lib/api/metric.ts";
import { inPlay, roundShapes, roundTiles } from "#lib/map/layers/round.server.ts";
import { roundThresholds } from "#lib/server/onesoul/thresholds.ts";

export const load: PageServerLoad = async ({ parent, params, url }) => {
  const { os, osFeatures } = await parent();
  if (!os) error(404, "Not found");
  const cycle = params.cycle as unknown as number;
  const [sums, detail, souls, graves] = await Promise.all([roundSummaries(os.server, os.cycle), oneSoul().round(cycle, os.server), allSouls(os.server, cycle), allGraves(os.server, cycle)]);
  const summary = sums.rounds.find((r) => r.cycle === cycle);
  if (!summary) error(404, "Not found");
  const scope = (detail.ok ? detail.data.scope : summary.scope) as Scope | null;
  const s = sectionApi();
  const board = (r: Result<Leaderboard>) => (r.ok ? r : null); // a 400 (no round scopes yet) hides the board
  const [playtime, mined, killed, firsts, advancements, pranks] = scope
    ? await Promise.all([
        s.leaderboard(PLAYTIME, scope, { limit: 5 }).then(board),
        s.leaderboard({ kind: "stat", type: "minecraft:mined", subject: "*" }, scope, { limit: 5 }).then(board),
        s.leaderboard({ kind: "stat", type: "minecraft:killed", subject: "*" }, scope, { limit: 5 }).then(board),
        s.milestones({ scope, limit: 8 }).then(prepareFeed),
        s.advancements({ scope, limit: 8 }).then(prepareAdvancements),
        summary.ended_at ? oneSoul().pranks({ server: os.server, cycle }) : Promise.resolve(null)
      ])
    : [null, null, null, null, null, summary.ended_at ? await oneSoul().pranks({ server: os.server, cycle }) : null];
  // every round's map is on its tiles (design §8.1): the archive, or the round in play with the living soul (TH-31)
  const over = !!summary.ended_at;
  const running = !over && inPlay(os, cycle);
  let map: { tile: NonNullable<Awaited<ReturnType<typeof roundTiles>>>; layers: Awaited<ReturnType<typeof roundShapes>>["maps"] } | null = null;
  if (over || running) {
    const st = running ? await oneSoul().status() : null;
    const soul = st?.ok ? st.data.servers.find((x) => x.server === os.server)?.soul : null;
    const shapes = await roundShapes(oneSoul(), os.server, cycle, running && soul ? { uuid: soul.uuid } : null, over);
    const tile = shapes.ok ? await roundTiles(os.server, cycle, shapes.maps, running, url.searchParams.get("world")) : null;
    if (tile) map = { tile, layers: shapes.maps };
  }
  // the round's steps into the Nether and the End (TH-26); null when the proxy cannot filter events by kind
  const thresholds = osFeatures.tracking ? await roundThresholds(os.server, cycle) : null;
  return {
    map,
    thresholds,
    title: `Round ${cycle}`,
    crumbs: [
      { label: "One Soul", href: "/one-soul" },
      { label: "Rounds", href: "/one-soul/rounds" },
      { label: `Round ${cycle}`, href: `/one-soul/rounds/${cycle}` }
    ],
    cycle,
    summary,
    records: detail.ok ? (detail.data.records ?? []) : null,
    souls,
    graves,
    scoped: !!scope && !!(playtime || mined || killed),
    boards: { playtime, mined, killed },
    firsts,
    advancements,
    pranks: pranks && pranks.ok ? pranks.data : null
  };
};
