// The chronicle: every soul that has played, round by round (GET /v2/onesoul/souls). Turn order is the
// order souls played in, which is history; the queue for future turns is never shown.
import type { PageServerLoad } from "./$types";
import { oneSoul } from "#lib/server/onesoul/index.ts";
import { roundParam } from "#lib/onesoul/links.ts";

const LIMIT = 25;

export const load: PageServerLoad = async ({ parent, url }) => {
  const { os, osFeatures } = await parent();
  const crumbs = [{ label: "One Soul", href: "/one-soul" }, { label: "Chronicle", href: "/one-soul/chronicle" }];
  if (!os) return { title: "Chronicle", crumbs, souls: null, round: null, rounds: [], sort: "turn", limit: LIMIT, offset: 0 };
  const round = roundParam(url) ?? os.cycle;
  const offset = Math.max(0, Math.min(1_000_000, Number(url.searchParams.get("offset")) || 0));
  const sort = osFeatures.tracking && url.searchParams.get("sort") === "duration" ? "duration" : "turn";
  const souls = await oneSoul().souls({ server: os.server, cycle: round, limit: LIMIT, offset, ...(sort === "duration" ? { sort: "duration", order: "desc" } : {}) });
  const rounds = Array.from({ length: os.cycle }, (_, i) => os.cycle - i);
  return { title: `Chronicle, round ${round}`, crumbs, souls, round, rounds, sort, limit: LIMIT, offset };
};
