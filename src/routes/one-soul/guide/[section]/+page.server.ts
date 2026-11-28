// One section of the guide: its entries in full. An unknown section is a 404; a guide that is missing or cannot
// be loaded still answers 200 with the page's own empty state (the layout's `guide` is null).
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { groupBySection } from "#lib/onesoul/guide/text.ts";

export const load: PageServerLoad = async ({ parent, params }) => {
  const { guide } = await parent();
  const crumbs = [{ label: "One Soul", href: "/one-soul" }, { label: "Guide", href: "/one-soul/guide" }];
  if (!guide) return { title: "Guide", crumbs, section: null };
  const groups = groupBySection(guide);
  const at = groups.findIndex((g) => g.section.id === params.section);
  if (at < 0) error(404, "Not found");
  const g = groups[at];
  return {
    title: `Guide: ${g.section.title}`,
    crumbs: [...crumbs, { label: g.section.title, href: `/one-soul/guide/${g.section.id}` }],
    section: g.section,
    entries: g.entries,
    prev: at > 0 ? groups[at - 1].section : null,
    next: at < groups.length - 1 ? groups[at + 1].section : null
  };
};
