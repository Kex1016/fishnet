// Every round of One Soul, newest first (GET /v2/onesoul/rounds; summed from the souls on an older proxy).
import type { PageServerLoad } from "./$types";
import { roundSummaries } from "#lib/server/onesoul/section.ts";

export const load: PageServerLoad = async ({ parent }) => {
  const { os } = await parent();
  const crumbs = [{ label: "One Soul", href: "/one-soul" }, { label: "Rounds", href: "/one-soul/rounds" }];
  if (!os) return { title: "Rounds", crumbs, rounds: null };
  return { title: "Rounds", crumbs, rounds: await roundSummaries(os.server, os.cycle) };
};
