// Every page of the site (PLAN §3.4), the sidebar and the breadcrumbs. Shared file: minimal
// additive edits only, named in the unit's report. Milestones only show when the proxy has them.
import type { Component } from "svelte";
import { Award, ChartColumn, Flame, House, Info, Flag, Server, Trophy, Users } from "@lucide/svelte";

export type Crumb = { label: string; href?: string };

export type NavItem = {
  href: string;
  label: string;
  icon: Component<{ class?: string; strokeWidth?: number }>;
  /** only rendered when the proxy has milestones (layout data `milestones`) */
  needsMilestones?: boolean;
  /** only rendered when the proxy has advancement milestones (layout data `advancements`, D-111) */
  needsAdvancements?: boolean;
  /** only rendered when the proxy has One Soul and the token may read it (layout data `onesoul`) */
  needsOneSoul?: boolean;
};

export type NavGroup = { label?: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    items: [
      { href: "/", label: "Home", icon: House },
      { href: "/servers", label: "Servers", icon: Server },
      { href: "/players", label: "Players", icon: Users }
    ]
  },
  {
    label: "Stats",
    items: [
      { href: "/leaderboards", label: "Leaderboards", icon: Trophy },
      { href: "/stats", label: "Stats", icon: ChartColumn },
      { href: "/milestones", label: "Milestones", icon: Flag, needsMilestones: true },
      { href: "/advancements", label: "Advancements", icon: Award, needsAdvancements: true }
    ]
  },
  {
    label: "Games",
    items: [{ href: "/one-soul", label: "One Soul", icon: Flame, needsOneSoul: true }]
  },
  {
    items: [{ href: "/about", label: "About", icon: Info }]
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
