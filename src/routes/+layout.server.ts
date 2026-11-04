// Every page gets: the theme, whether the proxy has milestones (nav entry), mock scenario (dev banner).
import type { LayoutServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    theme: locals.theme,
    mock: locals.mock,
    milestones: await api().milestonesEnabled()
  };
};
