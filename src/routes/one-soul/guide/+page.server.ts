import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => ({
  title: "Guide",
  crumbs: [{ label: "One Soul", href: "/one-soul" }, { label: "Guide", href: "/one-soul/guide" }]
});
