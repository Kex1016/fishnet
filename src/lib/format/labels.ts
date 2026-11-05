// Every stat and milestone label on the site comes from here, so "You killed %s %s" never reaches a page
// and "1000 Pufferfish" says what happened to the pufferfish.
//
// Why this exists: cakeutils sends the game's own English strings. For stat types those are the
// stats-screen templates, e.g. `stat_type.minecraft.killed` = "You killed %s %s" and
// `stat_type.minecraft.killed_by` = "%s killed you %s time(s)", or column headings like "Times Mined".
// None of them read well on their own, so each type gets words here:
//   label  the type's short name ("Killed", "Killed by"), for chips, kickers and filters;
//   title  a stat without a number ("{subject} killed", "Killed by {subject}"), for headings and links;
//   phrase a milestone with its number ("Killed {n} {subject}", "Killed by {subject} {n} {times}").
// Vanilla types are a table below; any other type (modded) is derived from the API's name with the
// template parts stripped ("Times Pressed" → "Pressed" → "{subject} pressed", "Pressed {n} {subject}").
//
// Overrides: `setLabelOverrides` is the one hook for operator-edited names. Type words are keyed on the
// full type key ("minecraft:killed"); one stat's words on its criterion form from `metricKey`
// ("killed:minecraft:pufferfish", "killed:*" for a type total). Set them on both the server and the
// client (e.g. from the root layout's data) so hydration sees the same words.
//
// Pure: no server imports, safe in components.
import { metricKey } from "#lib/api/metric.ts";

/** Words for one stat type. Templates use {subject}, {n} (the threshold's display) and {times} ("time"/"times"). */
export type TypeWords = { label: string; title: string; phrase: string };
/** Words for one stat, overriding its type's. */
export type StatWords = { title?: string; phrase?: string };
export type LabelOverrides = { types?: Record<string, Partial<TypeWords>>; stats?: Record<string, StatWords> };

/** What a label needs to know about a stat. Names are the API's (catalogue or row), any of them may be missing. */
export type StatRef = {
  type: string;
  subject: string;
  typeName?: string | null;
  subjectName?: string | null;
  /** the type's subject kind (block, item, entity, custom), for a type total's noun */
  kind?: string | null;
};

const VANILLA: Record<string, TypeWords> = {
  "minecraft:mined": { label: "Mined", title: "{subject} mined", phrase: "Mined {n} {subject}" },
  "minecraft:used": { label: "Used", title: "{subject} used", phrase: "Used {subject} {n} {times}" },
  "minecraft:crafted": { label: "Crafted", title: "{subject} crafted", phrase: "Crafted {n} {subject}" },
  "minecraft:broken": { label: "Broken", title: "{subject} broken", phrase: "Broke {n} {subject}" },
  "minecraft:picked_up": { label: "Picked up", title: "{subject} picked up", phrase: "Picked up {n} {subject}" },
  "minecraft:dropped": { label: "Dropped", title: "{subject} dropped", phrase: "Dropped {n} {subject}" },
  "minecraft:killed": { label: "Killed", title: "{subject} killed", phrase: "Killed {n} {subject}" },
  "minecraft:killed_by": { label: "Killed by", title: "Killed by {subject}", phrase: "Killed by {subject} {n} {times}" },
  // general stats are already named for what they count ("Jumps", "Distance Walked")
  "minecraft:custom": { label: "General", title: "{subject}", phrase: "{subject}: {n}" }
};

/** What a type total ("killed:*") calls its subjects, by the type's kind. */
const TOTAL_NOUN: Record<string, string> = { block: "blocks", item: "items", entity: "mobs", custom: "general stats" };
const VANILLA_KIND: Record<string, string> = {
  "minecraft:mined": "block",
  "minecraft:used": "item",
  "minecraft:crafted": "item",
  "minecraft:broken": "item",
  "minecraft:picked_up": "item",
  "minecraft:dropped": "item",
  "minecraft:killed": "entity",
  "minecraft:killed_by": "entity",
  "minecraft:custom": "custom"
};

let overrides: LabelOverrides = {};

/** Replaces the operator overrides (the whole set). Pass `{}` to clear. */
export function setLabelOverrides(o: LabelOverrides | null | undefined): void {
  overrides = o ?? {};
}

export function labelOverrides(): LabelOverrides {
  return overrides;
}

/** "minecraft:diamond_ore" → "Diamond Ore"; the fallback when the API has no name. */
export function titleCase(key: string): string {
  const path = key.includes(":") ? key.slice(key.indexOf(":") + 1) : key;
  return path
    .split(/[_/.-]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

const PLACEHOLDER = /%(?:\d+\$)?[sd]/g;

/** A name with format placeholders (`%s`, `%1$s`, `%d`) removed and spaces collapsed; "" when nothing is left. */
export function cleanName(name: string | null | undefined): string {
  if (!name) return "";
  return name.replace(PLACEHOLDER, " ").replace(/\s+/g, " ").trim();
}

/** A subject's name: the API's (cleaned), else the key title-cased. */
export function subjectLabel(name: string | null | undefined, key: string): string {
  return cleanName(name) || titleCase(key);
}

/** First letter up, the rest as given lowered (site copy is sentence case: "Picked up"). */
function sentence(s: string): string {
  const l = s.toLowerCase();
  return l ? l[0].toUpperCase() + l.slice(1) : l;
}

/**
 * A type's short name from an API name that may be a stats-screen template: placeholders, "time(s)",
 * "times", "you"/"your" and "number of" are dropped ("You killed %s %s" → "Killed", "Times Pressed" →
 * "Pressed"). Empty when nothing useful is left.
 */
export function cleanTypeName(name: string | null | undefined): string {
  const s = cleanName(name)
    .replace(/\btime\(s\)/gi, " ")
    .replace(/\btimes\b/gi, " ")
    .replace(/\b(you|your|number of)\b/gi, " ")
    .replace(/[:.!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return sentence(s);
}

/** The words for a type: overrides, then the vanilla table, then words derived from the API's name. */
export function typeWords(key: string, apiName?: string | null): TypeWords {
  const base = VANILLA[key] ?? derived(key, apiName);
  const o = overrides.types?.[key];
  if (!o) return base;
  // an overridden label without its own templates still names the stat ("{subject} <label>")
  const fromLabel = o.label && !VANILLA[key] ? derivedFrom(o.label) : null;
  return {
    label: o.label || base.label,
    title: o.title || fromLabel?.title || base.title,
    phrase: o.phrase || fromLabel?.phrase || base.phrase
  };
}

function derived(key: string, apiName?: string | null): TypeWords {
  return derivedFrom(cleanTypeName(apiName) || sentence(titleCase(key)) || key);
}

function derivedFrom(label: string): TypeWords {
  return { label, title: `{subject} ${label.toLowerCase()}`, phrase: `${label} {n} {subject}` };
}

/** A stat type's short name ("Killed", "Picked up", "General"). */
export function typeLabel(key: string, apiName?: string | null): string {
  return typeWords(key, apiName).label;
}

function subjectWords(r: StatRef): string {
  if (r.subject === "*") return TOTAL_NOUN[r.kind ?? VANILLA_KIND[r.type] ?? ""] ?? "stats";
  return subjectLabel(r.subjectName, r.subject);
}

function statWords(r: StatRef): TypeWords {
  const t = typeWords(r.type, r.typeName);
  const s = overrides.stats?.[metricKey({ kind: "stat", type: r.type, subject: r.subject })];
  return s ? { ...t, title: s.title || t.title, phrase: s.phrase || t.phrase } : t;
}

function fill(template: string, subject: string, n: string, one: boolean): string {
  // the subject goes in last, so a name that happens to contain "{n}" stays text
  return template.replaceAll("{times}", one ? "time" : "times").replaceAll("{n}", n).replaceAll("{subject}", subject);
}

/** Up-cases the first letter only (subject names keep their own capitals: "Diamond Ore mined"). */
function capFirst(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** A stat without a number: "Pufferfish killed", "Killed by Zombie", "Mobs killed" for a type total, "Jumps". */
export function statTitle(r: StatRef): string {
  return capFirst(fill(statWords(r).title, subjectWords(r), "", false).replace(/\s+/g, " ").trim());
}

/** A milestone as words around its number, so the number can be styled on its own. */
export type Phrase = { before: string; value: string; after: string; text: string };

/**
 * A milestone: "Killed 1000 Pufferfish", "Killed by Zombie 50 times", "Mined 10000 blocks", "Jumps: 1000".
 * `display` is the API's threshold text, shown as given; `threshold` picks "time" or "times".
 */
export function milestonePhrase(r: StatRef, display: string, threshold?: number): Phrase {
  let tpl = statWords(r).phrase;
  if (!tpl.includes("{n}")) tpl += " {n}";
  const t = fill(tpl, subjectWords(r), "\u0000", threshold === 1).replace(/\s+/g, " ").trim();
  const i = t.indexOf("\u0000");
  const before = capFirst(t.slice(0, i));
  const after = t.slice(i + 1).replaceAll("\u0000", display);
  return { before, value: display, after, text: capFirst(before + display + after) };
}
