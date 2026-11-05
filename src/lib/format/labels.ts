// Every stat and milestone label on the site comes from here, so "You killed %s %s" never reaches a page
// and "1000 Pufferfish" says what happened to the pufferfish.
//
// Why this exists: cakeutils sends the game's own English strings. For stat types those are the
// stats-screen templates, e.g. `stat_type.minecraft.killed` = "You killed %s %s" and
// `stat_type.minecraft.killed_by` = "%s killed you %s time(s)", or column headings like "Times Mined".
// None of them read well on their own, so each type gets words here:
//   label  the type's short name ("Killed", "Killed by"), for chips, kickers and filters;
//   title  a stat without a number ("{subject} killed", "Killed by {subject}"), for headings and links;
//   phrase a milestone as a sentence about its first player ("{player} killed {subject} for the {nth}
//          time" → "Sealily killed Pufferfish for the 10th time!", "{nth} swum by {player}" → "1st km
//          swum by Sealily!").
// Vanilla types are a table below, plus sentences for single general stats and type totals; any other
// type (modded) is derived from the API's name with the template parts stripped ("Times Pressed" →
// "Pressed" → "{subject} pressed", "{player} pressed {subject} for the {nth} time").
//
// Phrase tokens: {player} (the first player, "Someone" when unknown), {subject}, {nth} (the threshold
// as an ordinal: "10th", "1 000th", "1st km" / "500th m" for distances), {n} (the API's threshold text
// as given) and {times} ("time"/"times"). A sentence that ends in a letter or digit gets "!". A phrase
// without {player} (older overrides) still works: the page shows the player beside it.
//
// Overrides: `setLabelOverrides` is the one hook for operator-edited names. Type words are keyed on the
// full type key ("minecraft:killed"); one stat's words on its criterion form from `metricKey`
// ("killed:minecraft:pufferfish", "killed:*" for a type total). Set them on both the server and the
// client (e.g. from the root layout's data) so hydration sees the same words.
//
// Pure: no server imports, safe in components.
import { metricKey } from "#lib/api/metric.ts";

/** Words for one stat type. Templates use the tokens listed at the top of this file. */
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
  /** the stat's unit ("count", "distance_cm", ...), for how a milestone's number reads */
  unit?: string | null;
};

const VANILLA: Record<string, TypeWords> = {
  "minecraft:mined": { label: "Mined", title: "{subject} mined", phrase: "{player} mined {subject} for the {nth} time" },
  "minecraft:used": { label: "Used", title: "{subject} used", phrase: "{player} used {subject} for the {nth} time" },
  "minecraft:crafted": { label: "Crafted", title: "{subject} crafted", phrase: "{player} crafted {subject} for the {nth} time" },
  "minecraft:broken": { label: "Broken", title: "{subject} broken", phrase: "{player} wore out {subject} for the {nth} time" },
  "minecraft:picked_up": { label: "Picked up", title: "{subject} picked up", phrase: "{player} picked up {subject} for the {nth} time" },
  "minecraft:dropped": { label: "Dropped", title: "{subject} dropped", phrase: "{player} dropped {subject} for the {nth} time" },
  "minecraft:killed": { label: "Killed", title: "{subject} killed", phrase: "{player} killed {subject} for the {nth} time" },
  "minecraft:killed_by": { label: "Killed by", title: "Killed by {subject}", phrase: "{player} was killed by {subject} for the {nth} time" },
  // general stats are already named for what they count ("Jumps", "Distance Walked"); the common ones
  // have their own sentence in STAT_PHRASES, distances read "1st km walked by ..."
  "minecraft:custom": { label: "General", title: "{subject}", phrase: "{player} reached {n} in {subject}" }
};

/** Built-in sentences for single stats and type totals, keyed like the stat overrides (criterion form). */
const STAT_PHRASES: Record<string, string> = {
  "mined:*": "{player} mined their {nth} block",
  "used:*": "{player} used an item for the {nth} time",
  "crafted:*": "{player} crafted their {nth} item",
  "broken:*": "{player} wore out their {nth} tool",
  "picked_up:*": "{player} picked up their {nth} item",
  "dropped:*": "{player} dropped an item for the {nth} time",
  "killed:*": "{player} killed their {nth} mob",
  "killed_by:*": "{player} was killed by a mob for the {nth} time",
  "custom:minecraft:jump": "{player} jumped for the {nth} time",
  "custom:minecraft:deaths": "{player} died for the {nth} time",
  "custom:minecraft:mob_kills": "{player} killed their {nth} mob",
  "custom:minecraft:player_kills": "{player} killed another player for the {nth} time",
  "custom:minecraft:fish_caught": "{player} caught their {nth} fish",
  "custom:minecraft:animals_bred": "{player} bred their {nth} animal",
  "custom:minecraft:sleep_in_bed": "{player} slept in a bed for the {nth} time",
  "custom:minecraft:traded_with_villager": "{player} traded with a villager for the {nth} time",
  "custom:minecraft:talked_to_villager": "{player} talked to a villager for the {nth} time",
  "custom:minecraft:enchant_item": "{player} enchanted an item for the {nth} time",
  "custom:minecraft:open_chest": "{player} opened a chest for the {nth} time",
  "custom:minecraft:eat_cake_slice": "{player} ate their {nth} slice of cake",
  "custom:minecraft:bell_ring": "{player} rang a bell for the {nth} time",
  "custom:minecraft:raid_win": "{player} won a raid for the {nth} time",
  "custom:minecraft:leave_game": "{player} left the game for the {nth} time",
  "custom:minecraft:drop": "{player} dropped an item for the {nth} time",
  "custom:minecraft:boat_one_cm": "{nth} travelled by boat by {player}",
  "custom:minecraft:minecart_one_cm": "{nth} travelled by minecart by {player}",
  "custom:minecraft:horse_one_cm": "{nth} ridden on a horse by {player}",
  "custom:minecraft:pig_one_cm": "{nth} ridden on a pig by {player}",
  "custom:minecraft:strider_one_cm": "{nth} ridden on a strider by {player}",
  "custom:minecraft:aviate_one_cm": "{nth} flown with elytra by {player}"
};

/** One of a type total's subjects, for a modded type's total sentence. */
const TOTAL_ONE: Record<string, string> = { block: "block", item: "item", entity: "mob" };

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
  return { label, title: `{subject} ${label.toLowerCase()}`, phrase: `{player} ${label.toLowerCase()} {subject} for the {nth} time` };
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

/** One piece of a milestone sentence: plain words, the player, the number or the stat's subject (pages link the last three). */
export type PhrasePart = { kind: "text" | "player" | "number" | "subject"; text: string };
/** A milestone sentence: its parts in order, the whole as plain text, and whether the player is in it. */
export type Phrase = { parts: PhrasePart[]; text: string; hasPlayer: boolean };

/** 1 → "1st", 12 → "12th", 1000 → "1 000th" (grouped with spaces, as the site's tables are). */
export function ordinal(n: number): string {
  const i = Math.trunc(Math.abs(n));
  const tens = i % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[i % 10] ?? "th";
  const grouped = String(i).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n < 0 ? "-" : ""}${grouped}${suffix}`;
}

/** A threshold as an ordinal in its unit: "10th"; distances (cm) "1st km", "500th m"; anything else the display as given. */
export function nthOf(threshold: number | undefined, unit: string | null | undefined, display: string): string {
  if (typeof threshold !== "number" || !Number.isFinite(threshold)) return display;
  if (!unit || unit === "count") return ordinal(threshold);
  if (unit === "distance_cm") {
    if (threshold >= 100_000 && threshold % 100_000 === 0) return `${ordinal(threshold / 100_000)} km`;
    if (threshold % 100 === 0) return `${ordinal(threshold / 100)} m`;
  }
  return display;
}

/** A distance stat without its own sentence: "Distance Walked" → "{nth} walked by {player}". */
function distancePhrase(subjectName: string): string {
  let rest = subjectName.replace(/^distance\s+/i, "").toLowerCase();
  if (rest === subjectName.toLowerCase()) return `{nth} of {subject} by {player}`;
  if (rest.startsWith("by ")) rest = `travelled ${rest}`;
  return `{nth} ${rest} by {player}`;
}

function phraseTemplate(r: StatRef): string {
  const key = metricKey({ kind: "stat", type: r.type, subject: r.subject });
  const own = overrides.stats?.[key]?.phrase || overrides.types?.[r.type]?.phrase || STAT_PHRASES[key];
  if (own) return own;
  if (r.subject === "*" && !VANILLA[r.type]) {
    const one = TOTAL_ONE[r.kind ?? ""];
    if (one) return `{player} ${typeWords(r.type, r.typeName).label.toLowerCase()} their {nth} ${one}`;
  }
  if (r.unit === "distance_cm" && r.subject !== "*") return distancePhrase(subjectLabel(r.subjectName, r.subject));
  return typeWords(r.type, r.typeName).phrase;
}

/**
 * A milestone as a sentence: "Sealily picked up Pufferfish for the 10th time!", "1st km swum by Sealily!",
 * "Someone mined their 10 000th block!" when the first player is unknown. `display` is the API's threshold
 * text ({n}); `threshold` and the stat's `unit` make {nth} and pick "time"/"times".
 */
export function milestonePhrase(r: StatRef, display: string, threshold?: number, player?: string | null): Phrase {
  const tpl = phraseTemplate(r);
  const values: Record<string, PhrasePart> = {
    player: { kind: "player", text: player || "Someone" },
    subject: { kind: "subject", text: subjectWords(r) },
    nth: { kind: "number", text: nthOf(threshold, r.unit, display) },
    n: { kind: "number", text: display },
    times: { kind: "text", text: threshold === 1 ? "time" : "times" }
  };
  const parts: PhrasePart[] = [];
  const push = (p: PhrasePart) => {
    const last = parts[parts.length - 1];
    if (p.kind === "text" && last?.kind === "text") last.text += p.text;
    else if (p.text) parts.push({ ...p });
  };
  // tokens are found in the template only: a name containing "{n}" is never expanded
  for (const piece of tpl.split(/(\{(?:player|subject|nth|n|times)\})/)) {
    const tok = /^\{(\w+)\}$/.exec(piece)?.[1];
    push(tok && values[tok] ? values[tok] : { kind: "text", text: piece });
  }
  // a template without {n} or {nth} still shows its number
  if (!parts.some((p) => p.kind === "number")) push({ kind: "text", text: " " }), push(values.n);
  // tidy spaces, capitalise the first word, end the sentence
  for (const p of parts) if (p.kind === "text") p.text = p.text.replace(/\s+/g, " ");
  if (parts[0]?.kind === "text") parts[0].text = parts[0].text.trimStart();
  const lastPart = parts[parts.length - 1];
  if (lastPart?.kind === "text") lastPart.text = lastPart.text.trimEnd();
  const first = parts.find((p) => p.text);
  if (first && first.kind !== "player") first.text = capFirst(first.text);
  if (/[\p{L}\p{N})]$/u.test(parts.map((p) => p.text).join(""))) push({ kind: "text", text: "!" });
  const out = parts.filter((p) => p.text);
  return { parts: out, text: out.map((p) => p.text).join(""), hasPlayer: out.some((p) => p.kind === "player") };
}
