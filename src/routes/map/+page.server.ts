// /map (FM-0 skeleton; FM-4 builds the page): every server with a map. Hidden and One Soul servers never
// arrive (mapApi hides them).
import type { PageServerLoad } from "./$types";
import { mapApi } from "#lib/server/cakeutils/client.ts";

export const load: PageServerLoad = async () => {
  const servers = await mapApi().mapServers();
  return { title: "Map", crumbs: [{ label: "Map", href: "/map" }], servers };
};
