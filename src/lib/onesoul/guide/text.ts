// What the guide page does with the snapshot, as pure functions (so `bun test` covers them):
// - placeholders: `{key}` in a text becomes the `text` of the value of that key; an unknown one stays as it is
//   (CONTRACTS §11.3), so a number is never invented here and a missing one shows its own key;
// - the names of items and of recipe slots (hover text);
// - entries grouped by section, in the snapshot's order; entries of an unknown section are kept in a section
//   of their own, never dropped.
import type { Guide, GuideEntry, GuideRecipe, GuideSection, GuideSlot } from "./types.ts";

const PLACEHOLDER = /\{([a-z0-9_.:/-]{1,160})\}/g;

export function valueTexts(g: Pick<Guide, "values">): Map<string, string> {
  return new Map(g.values.map((v) => [v.key, v.text]));
}

/** `text` with every `{key}` of a known value replaced; an unknown placeholder stays. Never parses anything else. */
export function resolve(text: string, values: Map<string, string>): string {
  return text.replace(PLACEHOLDER, (all, key: string) => values.get(key) ?? all);
}

/** The keys a text asks for that the snapshot has no value for (a broken guide: the page tells nobody, tests do). */
export function missingKeys(text: string, values: Map<string, string>): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1]).filter((k) => !values.has(k));
}

/** "minecraft:ender_eye" → "Ender eye": the id's last part, for an item the snapshot names nowhere. */
export function titleOfId(id: string): string {
  const path = id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
  const last = path.split("/").pop() ?? path;
  const s = last.replace(/_/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : id;
}

export function itemNames(g: Pick<Guide, "items">): Map<string, string> {
  return new Map(g.items.map((i) => [i.id, i.name]));
}

export const itemName = (names: Map<string, string>, id: string): string => names.get(id) ?? titleOfId(id);

/** Hover text of a recipe slot: its own `name` when the snapshot gives one, else the item's name. */
export function slotName(names: Map<string, string>, s: { item: string; name: string | null }): string {
  return s.name && s.name.trim() ? s.name : itemName(names, s.item);
}

export type SectionGroup = { section: GuideSection; entries: GuideEntry[] };

export function groupBySection(g: Pick<Guide, "sections" | "entries">): SectionGroup[] {
  const known = new Set(g.sections.map((s) => s.id));
  const out: SectionGroup[] = g.sections.map((section) => ({ section, entries: g.entries.filter((e) => e.section === section.id) }));
  const stray = g.entries.filter((e) => !known.has(e.section));
  if (stray.length) out.push({ section: { id: "more", title: "More" }, entries: stray });
  return out.filter((x) => x.entries.length > 0);
}

export function recipeMap(g: Pick<Guide, "recipes">): Map<string, GuideRecipe> {
  return new Map(g.recipes.map((r) => [r.id, r]));
}

/** Every item id an entry or a recipe names: what the page needs pictures for. */
export function itemIds(g: Guide): string[] {
  const ids = new Set<string>();
  for (const e of g.entries) if (e.item) ids.add(e.item);
  for (const r of g.recipes) {
    ids.add(r.result.item);
    for (const s of r.slots) ids.add(s.item);
  }
  return [...ids];
}

/** Slots in the order the recipe is read (by slot number), at most one per slot. */
export function orderedSlots(r: GuideRecipe): GuideSlot[] {
  const seen = new Set<number>();
  return [...r.slots]
    .sort((a, b) => a.slot - b.slot)
    .filter((s) => (seen.has(s.slot) ? false : (seen.add(s.slot), true)));
}

/** "4 × Void shard, 4 × Obsidian, Eye of ender": the recipe in words, for the caption and for a type the page cannot draw. */
export function recipeInWords(r: GuideRecipe, names: Map<string, string>): string {
  const total = new Map<string, number>();
  for (const s of orderedSlots(r)) {
    const label = slotName(names, s);
    total.set(label, (total.get(label) ?? 0) + Math.max(1, s.count || 1));
  }
  return [...total].map(([n, c]) => (c > 1 ? `${c} × ${n}` : n)).join(", ");
}

// ---- reading an answer defensively

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const int = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : d);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown): string[] => arr(v).filter((x): x is string => typeof x === "string");

/**
 * The snapshot as the page uses it: every optional field present with its default, rows without their
 * required text dropped, unknown fields ignored. Null when it is not a guide at all.
 */
export function normalizeGuide(raw: unknown): Guide | null {
  if (!isObj(raw)) return null;
  const sections = arr(raw.sections).flatMap((s) => (isObj(s) && str(s.id) && str(s.title) !== null ? [{ id: str(s.id)!, title: str(s.title)! }] : []));
  const entries = arr(raw.entries).flatMap((e): GuideEntry[] => {
    if (!isObj(e) || !str(e.id) || !str(e.section) || str(e.title) === null) return [];
    return [
      {
        id: str(e.id)!,
        section: str(e.section)!,
        title: str(e.title)!,
        body: strs(e.body),
        facts: arr(e.facts).flatMap((f) => (isObj(f) && str(f.label) !== null && str(f.text) !== null ? [{ label: str(f.label)!, text: str(f.text)! }] : [])),
        item: str(e.item) || null,
        recipes: strs(e.recipes)
      }
    ];
  });
  const items = arr(raw.items).flatMap((i) => (isObj(i) && str(i.id) && str(i.name) !== null ? [{ id: str(i.id)!, name: str(i.name)! }] : []));
  const recipes = arr(raw.recipes).flatMap((r): GuideRecipe[] => {
    if (!isObj(r) || !str(r.id) || !str(r.type) || !isObj(r.result) || !str(r.result.item)) return [];
    return [
      {
        id: str(r.id)!,
        type: str(r.type)!,
        shapeless: r.shapeless === true,
        slots: arr(r.slots).flatMap((s) => (isObj(s) && typeof s.slot === "number" && str(s.item) ? [{ slot: int(s.slot, 0), item: str(s.item)!, count: Math.max(1, int(s.count, 1)), name: str(s.name) }] : [])),
        result: { item: str(r.result.item)!, count: Math.max(1, int(r.result.count, 1)), name: str(r.result.name) },
        note: str(r.note)
      }
    ];
  });
  const values = arr(raw.values).flatMap((v) => (isObj(v) && str(v.key) && str(v.text) !== null ? [{ key: str(v.key)!, text: str(v.text)!, raw: str(v.raw) }] : []));
  return {
    server: str(raw.server) ?? "",
    received_at: int(raw.received_at, 0),
    schema: int(raw.schema, 1),
    mod_version: str(raw.mod_version) ?? "",
    sections,
    entries,
    items,
    recipes,
    values
  };
}
