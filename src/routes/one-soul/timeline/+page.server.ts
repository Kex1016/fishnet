// The timeline: what happened, newest first (GET /v2/onesoul/events), by round; kinds filter where the
// proxy has it. Pranks are one row per ghost and day, as the API folds them.
import type { PageServerLoad } from "./$types";
import { oneSoul } from "#lib/server/onesoul/index.ts";
import { roundParam } from "#lib/onesoul/links.ts";

const LIMIT = 50;
const KINDS: Record<string, string> = {
  deaths: "death,second_chance,second_chance_ended,offering",
  souls: "soul_chosen,absence_warning,absence_skip",
  graves: "grave_created,grave_claimed",
  round: "prep_started,prep_extended,prep_ended,round_started,exhausted,grace_started,grace_ended,round_ended,spawn_moved",
  ghosts: "prank"
};

export const load: PageServerLoad = async ({ parent, url }) => {
  const { os, osFeatures } = await parent();
  const crumbs = [{ label: "One Soul", href: "/one-soul" }, { label: "Timeline", href: "/one-soul/timeline" }];
  if (!os) return { title: "Timeline", crumbs, events: null, round: null, rounds: [], show: null, limit: LIMIT, offset: 0 };
  const round = roundParam(url) ?? os.cycle;
  const s = url.searchParams.get("show");
  const show = osFeatures.tracking && s && s in KINDS ? s : null;
  const offset = Math.max(0, Math.min(1_000_000, Number(url.searchParams.get("offset")) || 0));
  const events = await oneSoul().events({ server: os.server, cycle: round, kind: show ? KINDS[show] : undefined, limit: LIMIT, offset });
  return { title: `Timeline, round ${round}`, crumbs, events, round, rounds: Array.from({ length: os.cycle }, (_, i) => os.cycle - i), show, limit: LIMIT, offset };
};
