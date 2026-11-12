// Every page gets: the theme, whether the proxy has milestones and advancement milestones (nav entries),
// mock scenario (dev banner), and whether servers are hidden (src/lib/server/hidden-servers.ts).
import { error } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { api, exclusionStatus, extras } from "#lib/server/cakeutils/client.ts";
import { hiddenServers } from "#lib/server/hidden-servers.ts";
import { labelOverrides } from "#lib/server/admin/index.ts";
import { oneSoul } from "#lib/server/onesoul/index.ts";
import { standaloneExclude, standaloneIds } from "#lib/server/onesoul/standalone.ts";
import { ServerList } from "#lib/server/hidden-servers-list.ts";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  // A hidden server answers like one that never existed: its page and any ?scope= inside it are a 404.
  // One Soul servers too, outside the One Soul section (they have their own pages there)
  const hidden = url.pathname === "/one-soul" || url.pathname.startsWith("/one-soul/") ? hiddenServers() : new ServerList([...hiddenServers().ids, ...standaloneIds()]);
  if (hidden.size) {
    const m = /^\/servers\/([^/]+)\/?$/.exec(url.pathname);
    if (hidden.hidesScope(url.searchParams.get("scope")) || (m && hidden.has(decodeURIComponent(m[1])))) error(404, "Not found");
  }
  const x = extras();
  const [milestones, advancements, onesoul, firsts, deaths, activity] = await Promise.all([
    api().milestonesEnabled(),
    api().advancementsEnabled(),
    oneSoul().enabled("status"),
    x.enabled("firsts"),
    x.enabled("deaths"),
    x.enabled("activity")
  ]);
  const ex = exclusionStatus();
  return {
    theme: locals.theme,
    tz: locals.tz,
    mock: locals.mock,
    milestones,
    advancements,
    /** servers are hidden: network milestones (D-109) still count them, pages say so */
    serversHidden: hiddenServers().size > 0 || standaloneExclude().length > 0,
    /** the proxy has One Soul and the token may read it: the section's nav entry */
    onesoul,
    /** the planned network routes this proxy has (nav entries; each page probes its own widgets too) */
    firsts,
    deaths,
    activity,
    /** cakeutils is older than D-113: its network stats still count the hidden servers */
    exclusionUnsupported: ex.unsupported,
    /** the owner's stat names (admin.db), for labels.ts in the browser */
    labelOverrides: labelOverrides()
  };
};
