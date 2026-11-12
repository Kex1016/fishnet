// A soul's journal (GET /v2/onesoul/journals/{turn}), published when the turn ends. The journal of the
// soul who is playing now is refused by the client (privacy.ts) and answers 404 here like an unknown one.
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { oneSoul } from "#lib/server/onesoul/index.ts";
import { unifontFor } from "#lib/server/onesoul/unifont.ts";

export const load: PageServerLoad = async ({ parent, params }) => {
  const { os } = await parent();
  if (!os) error(404, "Not found");
  const cycle = params.cycle as unknown as number;
  const turn = params.turn as unknown as number;
  const r = await oneSoul().journal(turn, { server: os.server, cycle });
  if (!r.ok) {
    if (r.kind === "not_found" || r.kind === "off") error(404, "Not found");
    return { title: `Journal, round ${cycle} turn ${turn}`, crumbs: crumbs(cycle, turn), cycle, turn, journal: null };
  }
  if (r.data.soul.cycle !== cycle || r.data.soul.turn !== turn) error(404, "Not found");
  return { title: `${r.data.soul.name}'s journal`, crumbs: crumbs(cycle, turn), cycle, turn, journal: r.data, uni: unifontFor(r.data.pages), asOf: r.asOf, stale: r.stale };
};

function crumbs(cycle: number, turn: number) {
  return [
    { label: "One Soul", href: "/one-soul" },
    { label: `Round ${cycle}`, href: `/one-soul/rounds/${cycle}` },
    { label: `Turn ${turn}`, href: `/one-soul/rounds/${cycle}/${turn}` },
    { label: "Journal", href: `/one-soul/rounds/${cycle}/${turn}/journal` }
  ];
}
