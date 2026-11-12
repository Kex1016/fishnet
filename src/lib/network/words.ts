// Words for the network routes planned in cakeutils: first kinds, death groups. Unknown kinds read as a
// title-cased id, never a crash.
import { titleId } from "#lib/onesoul/format.ts";
import { advHref, advTitle } from "#lib/milestones/advancements.ts";
import { boardHref } from "#lib/api/metric.ts";
import { statTitle } from "#lib/format/labels.ts";
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
const own = (f: First): string | null => (f.title && !ID.test(f.title.trim()) ? f.title : null);

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
      const shown = str(d.display);
      if (!type || !subject) break;
      return { text: `${statTitle({ type, subject, unit: str(d.unit) })}${shown ? `: ${shown}` : ""}`, href: boardHref({ kind: "stat", type, subject }) };
    }
    case "playtime": {
      const shown = str(d.display);
      return { text: own(f) ?? (shown ? `First to ${shown} played` : "Playtime"), href: "/leaderboards/playtime" };
    }
    case "dimension":
    case "biome":
    case "structure": {
      const id = str(d[f.kind]);
      return { text: own(f) ?? (id ? `First into ${titleId(id)}` : f.title), href: null };
    }
    case "item": {
      const id = str(d.item);
      const via = str(d.via);
      return { text: own(f) ?? (id ? `First to ${via === "crafted" ? "craft" : "pick up"} ${titleId(id)}` : f.title), href: null };
    }
  }
  return { text: own(f) ?? titleId(f.title), href: null };
}
