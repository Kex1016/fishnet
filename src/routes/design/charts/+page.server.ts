// The chart gallery (W3): every chart in every state, for review and PR screenshots. Dev and mock only,
// like /design.
import { error } from "@sveltejs/kit";
import { dev } from "$app/env";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => {
  if (!dev && !locals.mock) error(404, "Not found");
  return { title: "Charts", crumbs: [{ label: "Design", href: "/design" }, { label: "Charts" }] };
};
