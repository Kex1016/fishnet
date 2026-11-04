import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { fullType } from "#lib/api/metric.ts";

export const load: PageServerLoad = async ({ params }) => {
  const key = fullType(params.type);
  const [types, subjects] = await Promise.all([api().statTypes(), api().subjects({ type: key, limit: 100 })]);
  const type = types.ok ? types.data.types.find((t) => t.key === key) : undefined;
  if (types.ok && !type) error(404, "No such stat type");
  const label = type?.name ?? key;
  return { title: label, crumbs: [{ label: "Stats", href: "/stats" }, { label }], type, key, subjects };
};
