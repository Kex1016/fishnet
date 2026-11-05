// Pure helpers for the advancement milestone components and pages (cakeutils D-111, STATS §10). No server
// imports, so the components can use them in the browser too. Advancements are named by their namespaced
// id (vanilla and modded alike); the title is whatever the backend last reported, and may be missing.
import type { AdvancementRow } from "#lib/api/types.ts";
import { titleCase } from "#lib/players/names.ts";

/** A row's title: the API's, else the id's last path segment title-cased (`minecraft:story/mine_diamond` → "Mine Diamond"). */
export function advTitle(m: Pick<AdvancementRow, "advancement" | "title">): string {
  if (m.title && m.title.trim()) return m.title;
  const path = m.advancement.slice(m.advancement.indexOf(":") + 1);
  return titleCase(path.slice(path.lastIndexOf("/") + 1));
}

const TABS: Record<string, string> = { story: "Story", nether: "Nether", end: "The End", adventure: "Adventure", husbandry: "Husbandry" };

/**
 * Where an advancement sits: vanilla's tab ("Story", "Nether", ...) from the id's first path segment, a mod's
 * name from its namespace (`farmersdelight:main/get_knife` → "Farmersdelight"), or null for an id without a path.
 */
export function advCategory(id: string): string | null {
  const colon = id.indexOf(":");
  const ns = colon < 0 ? "minecraft" : id.slice(0, colon);
  const path = id.slice(colon + 1);
  const tab = path.split("/")[0];
  if (ns === "minecraft") return TABS[tab] ?? (path.includes("/") ? titleCase(tab) : null);
  return titleCase(ns);
}

/** Does this look like a namespaced advancement id? (`minecraft:` may be omitted, as the API allows.) */
export function isAdvId(id: string): boolean {
  return /^(?:[a-z0-9_.-]{1,64}:)?[a-z0-9_.\/-]{1,200}$/.test(id) && !id.includes("//") && !id.startsWith("/") && !id.endsWith("/");
}

/** The id with its namespace spelled out, as cakeutils stores it. */
export function fullAdvId(id: string): string {
  return id.includes(":") ? id : `minecraft:${id}`;
}

/** The detail page of an advancement on this site. The id goes into the path as it is (colon and slashes are fine there). */
export function advHref(id: string): string {
  return `/advancements/${fullAdvId(id).split("/").map(encodeURIComponent).join("/")}`;
}

/** The feed page for a scope. */
export function advFeedHref(scope?: string): string {
  return scope && scope !== "network" ? `/advancements?scope=${encodeURIComponent(scope)}` : "/advancements";
}

/** A stable key for a feed row (one first per advancement per scope). */
export function advKey(m: Pick<AdvancementRow, "advancement">): string {
  return m.advancement;
}

export type Completed = { advancement: string; title: string; earners: number };

/** Advancements by how many players have them, most first (ties by title); `earners` is per scope and never added across scopes. */
export function mostCompleted(rows: AdvancementRow[], limit = 10): Completed[] {
  return rows
    .map((m) => ({ advancement: m.advancement, title: advTitle(m), earners: m.earners }))
    .sort((a, b) => b.earners - a.earners || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/** "first of 12" / "the only one so far": how a row's `earners` reads next to its first earner. */
export function earnersLabel(earners: number): string {
  if (earners <= 1) return "the only one so far";
  return `first of ${earners}`;
}
