// Words for the network routes planned in cakeutils: first kinds, death groups. Unknown kinds read as a
// title-cased id, never a crash.
import { titleId } from "#lib/onesoul/format.ts";
import { advHref, advTitle } from "#lib/milestones/advancements.ts";
import { boardHref } from "#lib/api/metric.ts";
import { statTitle } from "#lib/format/labels.ts";
import { group } from "#lib/format/stat-display.ts";
import type { First } from "./types.ts";

export const FIRST_KINDS: { id: string; label: string }[] = [
  { id: "advancement", label: "Advancements" },
  { id: "criterion", label: "Criteria" },
  { id: "dimension", label: "Dimensions" },
  { id: "biome", label: "Biomes" },
  { id: "structure", label: "Structures" },
  { id: "item", label: "Rare items" },
  { id: "playtime", label: "Playtime" },
  { id: "stat", label: "Stats" }
];

const ONE: Record<string, string> = { advancement: "Advancement", criterion: "Criterion", dimension: "Dimension", biome: "Biome", structure: "Structure", item: "Rare item", playtime: "Playtime", stat: "Stat" };
export function firstKind(k: string): string {
  return ONE[k] ?? titleId(k);
}

/** "x 120, y 64, z -40" */
export function posText(p: { x: number; y: number; z: number }): string {
  return `x ${Math.round(p.x)}, y ${Math.round(p.y)}, z ${Math.round(p.z)}`;
}

/** A criterion id as words: `minecraft:plains` → "Plains", `has_compass` → "Has compass". */
export function critLabel(c: string): string {
  const t = (c.includes(":") ? c.slice(c.indexOf(":") + 1) : c).replace(/[_/]+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : c;
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const ID = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/;
/** The API's title, unless it is only an id (a backend that never saw the display name sends the id). */
const own = (f: Pick<First, "title">): string | null => (f.title && !ID.test(f.title.trim()) ? f.title : null);

/**
 * What a first was, in words, and where it links (cakeutils `detail` by kind: stat {metric, type, subject,
 * threshold, unit, display}; dimension {dimension}; biome {biome}; structure {structure}; item {item, via};
 * advancement {advancement}; criterion {advancement, criterion}; playtime {threshold_ms, display}). Unknown
 * kinds and missing fields fall back to the API's title.
 */
export function firstLine(f: First): { text: string; href: string | null } {
  const d = (f.detail ?? {}) as Record<string, unknown>;
  switch (f.kind) {
    case "advancement": {
      const a = str(d.advancement);
      return a ? { text: advTitle({ advancement: a, title: f.title }), href: advHref(a) } : { text: f.title, href: null };
    }
    case "criterion": {
      const a = str(d.advancement);
      const c = str(d.criterion);
      if (!a) break;
      const t = advTitle({ advancement: a, title: f.title });
      return { text: c ? `${t}: ${critLabel(c)}` : t, href: advHref(a) };
    }
    case "stat": {
      const type = str(d.type);
      const subject = str(d.subject);
      // a count reads grouped like every other number on the site ("100 000"); other units keep the API's text
      const shown = str(d.unit) === "count" && typeof d.threshold === "number" && Number.isFinite(d.threshold) ? group(d.threshold) : str(d.display);
      if (!type || !subject) break;
      return { text: `${statTitle({ type, subject, unit: str(d.unit) })}${shown ? `: ${shown}` : ""}`, href: boardHref({ kind: "stat", type, subject }) };
    }
    case "playtime": {
      // the API's title is the duration alone ("100h 0m")
      const shown = str(d.display) ?? own(f);
      return { text: shown ? `First to ${shown} played` : "Playtime", href: "/leaderboards/playtime" };
    }
    case "dimension":
    case "biome":
    case "structure": {
      // the title is the place's English name when the catalogue has one, else its key
      const id = str(d[f.kind]);
      const name = own(f) ?? (id ? titleId(id) : null);
      return { text: name ? `First into ${name}` : f.title, href: null };
    }
    case "item": {
      const id = str(d.item);
      const name = own(f) ?? (id ? titleId(id) : null);
      return { text: name ? `First to ${str(d.via) === "crafted" ? "craft" : "pick up"} ${name}` : f.title, href: null };
    }
  }
  return { text: own(f) ?? titleId(f.title ?? ""), href: null };
}
