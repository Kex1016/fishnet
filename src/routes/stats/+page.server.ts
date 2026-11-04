// The catalogue (W6): types, subjects with icons, a subject's names and every type with data.
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";

export const load: PageServerLoad = async () => {
  const [types, subjects] = await Promise.all([api().statTypes(), api().subjects({ limit: 100 })]);
  return { title: "Stats", crumbs: [{ label: "Stats", href: "/stats" }], types, subjects };
};
