// Records across every round: the longest lives, each round's best, who claimed the most graves of
// others, the busiest ghost of each finished round, and the journals. Counts are made inside one list
// (souls, graves) and never add figures from different scopes.
import type { PageServerLoad } from "./$types";
import type { Grave, PrankGhost, Soul } from "#lib/onesoul/types.ts";
import { oneSoul } from "#lib/server/onesoul/index.ts";
import { allGraves, allSouls, roundSummaries } from "#lib/server/onesoul/section.ts";

type Claimer = { uuid: string; name: string; graves: number; items: number };
type Haunt = { cycle: number; ghost: PrankGhost };

export const load: PageServerLoad = async ({ parent }) => {
  const { os, osFeatures } = await parent();
  const crumbs = [{ label: "One Soul", href: "/one-soul" }, { label: "Records", href: "/one-soul/records" }];
  if (!os) return { title: "Records", crumbs, ok: false as const };
  const [souls, graves, rounds] = await Promise.all([allSouls(os.server), allGraves(os.server), roundSummaries(os.server, os.cycle)]);
  if (!souls.ok) return { title: "Records", crumbs, ok: false as const };

  const finished = (s: Soul) => s.outcome !== "playing" && s.duration_ms !== null;
  const longest = souls.rows.filter(finished).sort((a, b) => b.duration_ms! - a.duration_ms!).slice(0, 10);

  // graves claimed by someone other than the soul who left them
  const by = new Map<string, Claimer>();
  for (const g of graves.rows as Grave[]) {
    const c = g.claimed_by;
    if (!c || c.uuid === g.soul.uuid) continue;
    const x = by.get(c.uuid) ?? { uuid: c.uuid, name: c.name, graves: 0, items: 0 };
    x.graves += 1;
    x.items += g.items;
    by.set(c.uuid, x);
  }
  const claimers = [...by.values()].sort((a, b) => b.graves - a.graves || b.items - a.items).slice(0, 10);

  // the busiest ghost of each finished round (prank kinds stay hidden until a round is over)
  const done = rounds.rounds.filter((r) => r.ended_at !== null && r.cycle !== os.cycle);
  const haunts: Haunt[] = [];
  if (osFeatures.tracking) {
    const all = await Promise.all(done.map((r) => oneSoul().pranks({ server: os.server, cycle: r.cycle })));
    all.forEach((p, i) => {
      if (!p.ok) return;
      const top = [...p.data.ghosts].sort((a, b) => b.total - a.total)[0];
      if (top && top.total > 0) haunts.push({ cycle: done[i].cycle, ghost: top });
    });
  }

  const journals = souls.rows.filter((s) => s.has_journal && s.outcome !== "playing").sort((a, b) => b.cycle - a.cycle || b.turn - a.turn);

  return {
    title: "Records",
    crumbs,
    ok: true as const,
    asOf: souls.asOf,
    stale: souls.stale,
    capped: souls.capped,
    longest,
    rounds: rounds.rounds.filter((r) => r.longest),
    claimers,
    gravesOk: graves.ok,
    haunts,
    journals
  };
};
