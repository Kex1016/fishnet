// Every page of the site (PLAN §3.4), the sidebar and the breadcrumbs. Shared file: minimal
// additive edits only, named in the unit's report. Milestones only show when the proxy has them.
export type Crumb = { label: string; href?: string };

export type NavItem = {
  href: string;
  label: string;
  /** only rendered when the proxy has milestones (layout data `milestones`) */
  needsMilestones?: boolean;
  /** only rendered when the proxy has advancement milestones (layout data `advancements`, D-111) */
  needsAdvancements?: boolean;
  /** only rendered when the proxy has One Soul and the token may read it (layout data `onesoul`) */
  needsOneSoul?: boolean;
  /** only rendered when the proxy has that planned network route (layout data `firsts`, `deaths`, `activity`) */
  needs?: "firsts" | "deaths" | "activity" | "map";
};

export type NavGroup = { label?: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Network",
    items: [
      { href: "/", label: "Home" },
      { href: "/servers", label: "Servers" },
      { href: "/map", label: "Map", needs: "map" },
      { href: "/players", label: "Players" }
    ]
  },
  {
    label: "Stats",
    items: [
      { href: "/leaderboards", label: "Leaderboards" },
      { href: "/stats", label: "Stats" },
      { href: "/milestones", label: "Milestones", needsMilestones: true },
      { href: "/advancements", label: "Advancements", needsAdvancements: true },
      { href: "/firsts", label: "Firsts", needs: "firsts" },
      { href: "/activity", label: "Activity", needs: "activity" },
      { href: "/deaths", label: "Deaths", needs: "deaths" }
    ]
  },
  {
    label: "Games",
    items: [{ href: "/one-soul", label: "One Soul", needsOneSoul: true }]
  },
  {
    label: "Site",
    items: [{ href: "/about", label: "About" }]
  }
];

/** The site name and where it is served (PLAN §8.6): the site is Fishnet, the network it shows is Fishplex. */
export const SITE = { name: "Fishnet", host: "fishnet.haiiro.moe", tagline: "the Fishplex network, in numbers" } as const;

/** Is `pathname` on this nav item (its page or below it)? */
export function here(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** `<title>`: "Players · Fishnet", or "Fishnet" on the home page. */
export function pageTitle(title?: string): string {
  return title ? `${title} · ${SITE.name}` : SITE.name;
}
