// One Soul in charts (WEBSITE-BRIEF §7): one round, or every round of the One Soul server side by side.
import type { PageServerLoad } from "./$types";
import { oneSoul } from "#lib/server/onesoul/index.ts";
import { allEvents, allGraves, allSouls, roundSummaries } from "#lib/server/onesoul/section.ts";
import { roundParam } from "#lib/onesoul/links.ts";
import { viewParam } from "#lib/charts/view.ts";
import { causes, deathsPerDay, graveStatus, perRound, prankHeatmap, secondChances, signupsOverTime, survivalPerSoul, timeToClaim } from "#lib/onesoul/charts.ts";

export const load: PageServerLoad = async ({ parent, url }) => {
  const { os } = await parent();
  const crumbs = [{ label: "One Soul", href: "/one-soul" }, { label: "Charts", href: "/one-soul/charts" }];
  const view = viewParam(url);
  if (!os) return { title: "Charts", crumbs, ok: false as const, view };
  const round = url.searchParams.get("round") === "all" ? null : Math.min(roundParam(url) ?? os.cycle, os.cycle);
  const [souls, graves, summaries] = await Promise.all([allSouls(os.server, round), allGraves(os.server, round), roundSummaries(os.server, os.cycle)]);
  if (!souls.ok) return { title: "Charts", crumbs, ok: false as const, view };
  const finishedRound = round !== null && round !== os.cycle && summaries.rounds.some((r) => r.cycle === round && r.ended_at !== null);
  const [regs, pranks] = await Promise.all([
    round !== null ? oneSoul().registrations({ round, limit: 100 }) : Promise.resolve(null),
    finishedRound ? allEvents(os.server, { cycle: round }) : Promise.resolve(null)
  ]);
  const surv = survivalPerSoul(souls.rows, round === null);
  return {
    title: round === null ? "Charts, every round" : `Charts, round ${round}`,
    crumbs,
    ok: true as const,
    view,
    round,
    rounds: Array.from({ length: os.cycle }, (_, i) => os.cycle - i),
    asOf: souls.asOf,
    stale: souls.stale,
    survival: surv.points,
    record: surv.record,
    perRound: round === null ? perRound(souls.rows) : null,
    signups: regs && regs.ok ? signupsOverTime(regs.data.players) : null,
    deaths: deathsPerDay(souls.rows),
    causes: causes(souls.rows),
    graves: graves.ok ? { status: graveStatus(graves.rows), claim: timeToClaim(graves.rows), total: graves.rows.length } : null,
    secondChances: secondChances(souls.rows),
    pranks: pranks && pranks.ok ? prankHeatmap(pranks.rows) : null,
    playing: souls.rows.some((s) => s.outcome === "playing")
  };
};
