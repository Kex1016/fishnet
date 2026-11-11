// The One Soul section (WEBSITE-BRIEF §4): its own pages, its own look (data-realm="onesoul" on <html>,
// set by hooks.server.ts). The whole section is a 404 when the proxy has no One Soul or the token may not
// read it (read:onesoul), so nothing links to an empty shell.
import { error } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { oneSoul, visibleOneSoul } from "#lib/server/onesoul/index.ts";

export const load: LayoutServerLoad = async () => {
  const c = oneSoul();
  if (!(await c.enabled("status"))) error(404, "Not found");
  const [status, tracking, map, live] = await Promise.all([c.status(), c.enabled("tracking"), c.enabled("map"), c.enabled("live")]);
  const servers = status.ok ? visibleOneSoul(status.data.servers) : [];
  if (status.ok && servers.length === 0) error(404, "Not found");
  // today there is one One Soul server; with several, the first one is the section's server
  const s = servers[0] ?? null;
  return {
    os: s ? { server: s.server, display_name: s.display_name, cycle: s.cycle, state: s.state } : null,
    osDown: !status.ok,
    osFeatures: { tracking, map, live }
  };
};
