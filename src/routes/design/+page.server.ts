// The design preview: every component in both themes, for units and screenshots. Not a public page:
// dev and mock mode only.
import { error } from "@sveltejs/kit";
import { dev } from "$app/env";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => {
  if (!dev && !locals.mock) error(404, "Not found");
  return { title: "Design", crumbs: [{ label: "Design" }] };
};
