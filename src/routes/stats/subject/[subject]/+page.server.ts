import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { scopeParam } from "#lib/api/scope.ts";

export const load: PageServerLoad = async ({ params, url }) => {
  const subject = await api().subject(params.subject);
  if (!subject.ok && subject.kind === "not_found") error(404, "No such subject");
  const scope = scopeParam(url);
  const firstType = subject.ok ? subject.data.types[0] : undefined;
  const ladder = firstType ? await api().milestoneLadder(firstType, params.subject, scope) : null;
  const label = subject.ok ? (subject.data.names[0]?.name ?? params.subject) : params.subject;
  return { title: label, crumbs: [{ label: "Stats", href: "/stats" }, { label }], subject, scope, ladder, firstType };
};
