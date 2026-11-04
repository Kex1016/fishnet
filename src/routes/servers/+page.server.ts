// Servers (W4): each server's status, version, platform, who is on, its recent online line, its minis.
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { history } from "#lib/server/history.ts";
import { withoutHidden } from "#lib/server/hidden.ts";
import type { TimePoint } from "#lib/charts/index.ts";

const FACES = 12;

export const load: PageServerLoad = async () => {
  const c = api();
  const [network, minis, online] = await Promise.all([c.network(), c.miniServers(), c.players({ online: true, limit: 100 })]);
  const people = online.ok ? withoutHidden(online.data.players) : [];
  const servers = network.ok
    ? await Promise.all(
        network.data.servers.map(async (s) => {
          const here = people.filter((p) => p.server === s.id);
          const recent = await history().onlineRecent(`server:${s.id}`);
          const spark: TimePoint[] | undefined = recent.points.length >= 2 ? recent.points : undefined;
          return {
            ...s,
            faces: here.slice(0, FACES).map((p) => ({ uuid: p.uuid, name: p.name })),
            more: Math.max(0, s.online - Math.min(here.length, FACES)),
            // public mini-servers running on this server right now (a private one never shows, API §2.3)
            minis: minis.ok ? minis.data.mini_servers.filter((m) => m.server === s.id && m.public).length : null,
            spark
          };
        })
      )
    : [];
  return { title: "Servers", crumbs: [{ label: "Servers", href: "/servers" }], network, servers, facesKnown: online.ok };
};
