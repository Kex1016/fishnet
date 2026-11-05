// Every page gets: the theme, whether the proxy has milestones and advancement milestones (nav entries),
// mock scenario (dev banner).
import type { LayoutServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";

export const load: LayoutServerLoad = async ({ locals }) => {
  const [milestones, advancements] = await Promise.all([api().milestonesEnabled(), api().advancementsEnabled()]);
  return {
    theme: locals.theme,
    mock: locals.mock,
    milestones,
    advancements
  };
};
