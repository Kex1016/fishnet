// One player across every round: GET /v2/players/{uuid}/onesoul where the proxy has it, otherwise
// gathered from the souls and graves lists (no pranks or sign-up history then). Turns of a soul still
// playing carry no death position and no waiting time.
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import type { PlayerOneSoul, Soul } from "#lib/onesoul/types.ts";
import { oneSoul } from "#lib/server/onesoul/index.ts";
import { allGraves, allSouls } from "#lib/server/onesoul/section.ts";

const living = (s: Soul): Soul => (s.outcome === "playing" ? { ...s, death: null, waited_ms: null } : s);

export const load: PageServerLoad = async ({ parent, params }) => {
  const { os } = await parent();
  if (!os) error(404, "Not found");
  const uuid = params.uuid;
  const r = await oneSoul().player(uuid);
  let p: PlayerOneSoul | null = null;
  let full = false;
  let asOf: number | null = null;
  if (r.ok) {
    p = r.data;
    full = true;
    asOf = r.asOf;
  } else {
    if (r.kind === "not_found" && r.status === 404 && (await oneSoul().enabled("tracking"))) error(404, "Not found");
    const [souls, graves] = await Promise.all([allSouls(os.server), allGraves(os.server)]);
    const turns = souls.rows.filter((s) => s.uuid === uuid);
    const claimed = graves.rows.filter((g) => g.claimed_by?.uuid === uuid);
    const own = graves.rows.filter((g) => g.soul.uuid === uuid);
    if (turns.length === 0 && claimed.length === 0) error(404, "Not found");
    const ended = turns.filter((t) => t.duration_ms !== null && t.outcome !== "playing");
    const best = ended.reduce<Soul | null>((a, t) => (!a || t.duration_ms! > a.duration_ms! ? t : a), null);
    p = {
      uuid,
      name: turns.at(-1)?.name ?? claimed[0]?.claimed_by?.name ?? uuid,
      turns,
      graves_claimed: claimed.length,
      graves_left_open: own.filter((g) => !g.claimed_by).length,
      journals: turns.filter((t) => t.has_journal && t.outcome !== "playing").length,
      registrations: [],
      pranks: { total: 0 },
      best: best ? { duration_ms: best.duration_ms!, cycle: best.cycle, turn: best.turn } : null
    };
    asOf = souls.asOf;
  }
  const turns = [...p.turns].map(living).sort((a, b) => b.cycle - a.cycle || b.turn - a.turn);
  return {
    title: `${p.name} in One Soul`,
    crumbs: [
      { label: "One Soul", href: "/one-soul" },
      { label: p.name, href: `/one-soul/souls/${uuid}` }
    ],
    p: { ...p, turns },
    full,
    asOf
  };
};
