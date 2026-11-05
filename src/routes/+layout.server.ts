// Every page gets: the theme, whether the proxy has milestones and advancement milestones (nav entries),
// mock scenario (dev banner), and whether servers are hidden (src/lib/server/hidden-servers.ts).
import { error } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { api, exclusionStatus } from "#lib/server/cakeutils/client.ts";
import { hiddenServers } from "#lib/server/hidden-servers.ts";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  // A hidden server answers like one that never existed: its page and any ?scope= inside it are a 404.
  const hidden = hiddenServers();
  if (hidden.size) {
    const m = /^\/servers\/([^/]+)\/?$/.exec(url.pathname);
    if (hidden.hidesScope(url.searchParams.get("scope")) || (m && hidden.has(decodeURIComponent(m[1])))) error(404, "Not found");
  }
  const [milestones, advancements] = await Promise.all([api().milestonesEnabled(), api().advancementsEnabled()]);
  const ex = exclusionStatus();
  return {
    theme: locals.theme,
    mock: locals.mock,
    milestones,
    advancements,
    /** servers are hidden: network milestones (D-109) still count them, pages say so */
    serversHidden: ex.hidden > 0,
    /** cakeutils is older than D-113: its network stats still count the hidden servers */
    exclusionUnsupported: ex.unsupported
  };
};
