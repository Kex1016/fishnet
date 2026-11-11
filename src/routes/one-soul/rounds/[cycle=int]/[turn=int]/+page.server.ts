// One life: a soul's turn in a round. GET /v2/onesoul/souls/{turn} and its run stats where the proxy has
// them; otherwise the row from the souls list. The living soul's page shows no position, journal or trail.
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import type { Grave, SoulDetail } from "#lib/onesoul/types.ts";
import { oneSoul } from "#lib/server/onesoul/index.ts";
import { allGraves, allSouls } from "#lib/server/onesoul/section.ts";

export const load: PageServerLoad = async ({ parent, params }) => {
  const { os } = await parent();
  if (!os) error(404, "Not found");
  const cycle = params.cycle as unknown as number;
  const turn = params.turn as unknown as number;
  const c = oneSoul();
  const w = { server: os.server, cycle };
  const [detail, stats] = await Promise.all([c.soul(turn, w), c.soulStats(turn, { ...w, limit: 100 })]);
  let soul: SoulDetail | null = detail.ok ? detail.data : null;
  let grave: Grave | null = soul?.grave ?? null;
  if (!soul) {
    if (!detail.ok && detail.kind === "not_found") error(404, "Not found");
    const list = await allSouls(os.server, cycle);
    soul = list.rows.find((s) => s.turn === turn) ?? null;
    if (!soul) error(404, "Not found");
  }
  if (!grave && soul.grave_id) grave = (await allGraves(os.server, cycle)).rows.find((g) => g.id === soul!.grave_id) ?? null;
  const playing = soul.outcome === "playing";
  return {
    title: `${soul.name}, round ${cycle} turn ${turn}`,
    crumbs: [
      { label: "One Soul", href: "/one-soul" },
      { label: `Round ${cycle}`, href: `/one-soul/rounds/${cycle}` },
      { label: `Turn ${turn}`, href: `/one-soul/rounds/${cycle}/${turn}` }
    ],
    cycle,
    turn,
    // the living soul: no death position (there is none) and never a waiting time
    soul: playing ? { ...soul, death: null, waited_ms: null } : soul,
    playing,
    grave,
    stats: stats.ok ? stats.data : null,
    asOf: detail.ok ? detail.asOf : null
  };
};
