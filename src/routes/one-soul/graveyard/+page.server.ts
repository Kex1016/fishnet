// The graveyard: every grave, newest first (GET /v2/onesoul/graves), by round, open or claimed.
import type { PageServerLoad } from "./$types";
import { oneSoul } from "#lib/server/onesoul/index.ts";
import { roundParam } from "#lib/onesoul/links.ts";

const LIMIT = 24;

export const load: PageServerLoad = async ({ parent, url }) => {
  const { os } = await parent();
  const crumbs = [{ label: "One Soul", href: "/one-soul" }, { label: "Graveyard", href: "/one-soul/graveyard" }];
  if (!os) return { title: "Graveyard", crumbs, graves: null, round: null, rounds: [], claimed: null, limit: LIMIT, offset: 0 };
  const round = roundParam(url);
  const cl = url.searchParams.get("claimed");
  const claimed = cl === "true" ? true : cl === "false" ? false : null;
  const offset = Math.max(0, Math.min(1_000_000, Number(url.searchParams.get("offset")) || 0));
  const graves = await oneSoul().graves({ server: os.server, cycle: round ?? undefined, claimed: claimed ?? undefined, limit: LIMIT, offset });
  return { title: "Graveyard", crumbs, graves, round, rounds: Array.from({ length: os.cycle }, (_, i) => os.cycle - i), claimed, limit: LIMIT, offset };
};
