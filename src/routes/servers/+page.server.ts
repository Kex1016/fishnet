// Servers (W4): each server's status, version, platform, history, boards, milestones, minis.
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";

export const load: PageServerLoad = async () => {
  const [network, minis] = await Promise.all([api().network(), api().miniServers()]);
  return { title: "Servers", crumbs: [{ label: "Servers", href: "/servers" }], network, minis };
};
