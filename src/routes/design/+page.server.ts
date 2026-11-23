// The design preview: every shared part of the haiiro look, for units and screenshots. Not a public page:
// dev and mock mode only. The numbers on it are samples, which is why it never ships to visitors.
import { error } from "@sveltejs/kit";
import { dev } from "$app/env";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => {
  if (!dev && !locals.mock) error(404, "Not found");
  return { title: "Design", crumbs: [{ label: "Design" }] };
};
