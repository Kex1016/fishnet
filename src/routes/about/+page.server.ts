// About (W9b): what the site is, data freshness, API reachable yes/no, milestones and advancements on/off,
// recorded since.
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { history } from "#lib/server/history.ts";

export const load: PageServerLoad = async () => {
  const [health, milestones, advancements, since] = await Promise.all([api().health(), api().milestonesEnabled(), api().advancementsEnabled(), history().recordingSince()]);
  return {
    title: "About",
    crumbs: [{ label: "About", href: "/about" }],
    reachable: health.ok,
    checkedAt: health.asOf ?? null,
    milestones,
    advancements,
    since
  };
};
