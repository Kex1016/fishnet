// Pictures for rows the API sends without one. cakeutils renders an icon for every stat subject it has
// seen (blocks, items, a mob's spawn egg) and the catalogue serves it; milestone, advancement and firsts
// rows only name things. So the loads look each row's thing up in the catalogue:
//  - a stat milestone: its subject;
//  - an advancement: the item the game shows as its icon (advancement-icons.ts, vanilla only);
//  - a criterion: the thing it names when that is a block, item or mob, else its advancement's item;
//  - a rare item: the item; a dimension: the block it is made of; playtime: a clock.
// A thing the catalogue has no icon for (nobody has a stat for it yet, a modded advancement, a biome)
// keeps `icon` unset and the row shows its glyph. One catalogue read per distinct key, the first `max` of
// a page; they are cached for 30 minutes (policy.ts "catalogue"), a miss for 5.
//
// Everything here takes the catalogue reader as its first argument, so it runs under `bun test` with a fake
// one; the loads use pictures.server.ts, which passes the site's own.
import type { Result } from "#lib/api/result.ts";
import type { AdvancementRow, MilestoneFeedRow, SubjectDetail } from "#lib/api/types.ts";
import type { First, FirstsFeed } from "#lib/network/types.ts";
import { ADVANCEMENT_ICONS } from "./advancement-icons.ts";
import { fullAdvId } from "./advancements.ts";

export type Picture = { icon: string | null; kind: string | null };
export type SubjectReader = { subject(key: string): Promise<Result<SubjectDetail>> };

/** Catalogue keys: `namespace:path`. Free-form criterion names ("has_compass") are not looked up. */
const KEY = /^[a-z0-9_.-]{1,64}:[a-z0-9_./-]{1,128}$/;
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** The item the game shows for an advancement, or null (a modded one, or one added after the table was made). */
export function advancementIconItem(id: string): string | null {
  return ADVANCEMENT_ICONS[fullAdvId(id)] ?? null;
}

/** The block a vanilla dimension is made of: its picture. Other dimensions have none. */
const DIMENSION_BLOCK: Record<string, string> = {
  "minecraft:overworld": "minecraft:grass_block",
  "minecraft:the_nether": "minecraft:netherrack",
  "minecraft:the_end": "minecraft:end_stone"
};

/**
 * The catalogue's picture of each key: the first name with an icon (a key can be an item and a mob, like
 * cod; `things` prefers the block or item over the mob's spawn egg). Keys without an answer or an icon
 * are left out.
 */
export async function subjectPictures(c: SubjectReader, keys: Iterable<string>, o: { max?: number; things?: boolean } = {}): Promise<Map<string, Picture>> {
  const wanted = [...new Set([...keys].filter((k) => KEY.test(k)))].slice(0, o.max ?? 48);
  const found = new Map<string, Picture>();
  await Promise.all(
    wanted.map(async (key) => {
      const d = await c.subject(key);
      if (!d.ok) return;
      const names = d.data.names;
      const pick = (o.things ? names.find((n) => n.icon && n.kind !== "entity") : undefined) ?? names.find((n) => n.icon) ?? names[0];
      if (pick) found.set(key, { icon: pick.icon ?? null, kind: pick.kind ?? null });
    })
  );
  return found;
}

/** Adds `icon` and `kind` to stat milestone rows from the catalogue (rows of a type total, subject "*", have none). */
export async function withIcons<T extends { milestones: MilestoneFeedRow[] }>(c: SubjectReader, r: Result<T>, max = 24): Promise<Result<T>> {
  if (!r.ok || r.data.milestones.length === 0) return r;
  const found = await subjectPictures(c, r.data.milestones.map((m) => m.subject).filter((s) => s && s !== "*"), { max });
  if (found.size === 0) return r;
  return { ...r, data: { ...r.data, milestones: r.data.milestones.map((m) => (found.has(m.subject) ? { ...m, ...found.get(m.subject) } : m)) } };
}

/** Adds `icon` to advancement rows: the catalogue's icon of the item the game shows for the advancement. */
export async function withAdvancementIcons<T extends { milestones: AdvancementRow[] }>(c: SubjectReader, r: Result<T>, max = 48): Promise<Result<T>> {
  if (!r.ok || r.data.milestones.length === 0) return r;
  const item = (m: AdvancementRow) => advancementIconItem(m.advancement);
  const found = await subjectPictures(c, r.data.milestones.map(item).filter((k): k is string => k !== null), { max, things: true });
  if (found.size === 0) return r;
  return { ...r, data: { ...r.data, milestones: r.data.milestones.map((m) => ({ ...m, icon: found.get(item(m) ?? "")?.icon ?? null })) } };
}

/** One advancement's picture (the detail page's heading), or null. */
export async function advancementIcon(c: SubjectReader, id: string): Promise<string | null> {
  const item = advancementIconItem(id);
  return item ? ((await subjectPictures(c, [item], { things: true })).get(item)?.icon ?? null) : null;
}

type Candidate = { key: string; /** a block or an item is meant, never a mob of the same name */ thing: boolean };

/** The catalogue keys that could picture a first, best first (cakeutils `detail` by kind; see network/words.ts). */
export function firstSubjects(f: First): Candidate[] {
  const d = (f.detail ?? {}) as Record<string, unknown>;
  const adv = str(d.advancement);
  const things = (...keys: (string | null | undefined)[]): Candidate[] => keys.filter((k): k is string => !!k && KEY.test(k)).map((key) => ({ key, thing: true }));
  switch (f.kind) {
    case "stat": {
      // a stat's subject may be a mob (killed, killed by): its spawn egg is the picture
      const s = str(d.subject);
      return s && s !== "*" && KEY.test(s) ? [{ key: s, thing: false }] : [];
    }
    case "item":
      return things(str(d.item));
    case "advancement":
      return things(adv ? advancementIconItem(adv) : null);
    case "criterion": {
      // what the criterion names (a mob, a food; vanilla writes some without the namespace), then the
      // advancement's own item
      const c = str(d.criterion);
      const named = c && KEY.test(c) ? c : c && /^[a-z0-9_]{1,64}$/.test(c) ? `minecraft:${c}` : null;
      return [...(named ? [{ key: named, thing: false }] : []), ...things(adv ? advancementIconItem(adv) : null)];
    }
    case "dimension":
      return things(DIMENSION_BLOCK[str(d.dimension) ?? ""]);
    case "playtime":
      return things("minecraft:clock");
    default:
      return [];
  }
}

/**
 * Adds `icon` and `iconKind` to the rows of the firsts feed: every row's first choice is looked up before
 * any second choice, at most `max` catalogue reads for the page.
 */
export async function withFirstPictures(c: SubjectReader, r: Result<FirstsFeed>, max = 48): Promise<Result<FirstsFeed>> {
  if (!r.ok || r.data.firsts.length === 0) return r;
  const wanted = r.data.firsts.map(firstSubjects);
  const seen = new Set<string>();
  const all = [...wanted.map((w) => w[0]), ...wanted.map((w) => w[1])]
    .filter((x): x is Candidate => !!x && !seen.has(`${x.thing}|${x.key}`) && !!seen.add(`${x.thing}|${x.key}`))
    .slice(0, max);
  const [things, any] = await Promise.all([
    subjectPictures(c, all.filter((x) => x.thing).map((x) => x.key), { max, things: true }),
    subjectPictures(c, all.filter((x) => !x.thing).map((x) => x.key), { max })
  ]);
  if (things.size === 0 && any.size === 0) return r;
  const firsts = r.data.firsts.map((f, i) => {
    for (const x of wanted[i]) {
      const p = (x.thing ? things : any).get(x.key);
      if (p?.icon) return { ...f, icon: p.icon, iconKind: p.kind };
    }
    return f;
  });
  return { ...r, data: { ...r.data, firsts } };
}
