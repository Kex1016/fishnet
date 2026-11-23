// The subject kinds the catalogue documents (API §stats/subjects `kind`), in the order the filter shows them.
export const KINDS = ["block", "item", "entity", "custom", "other"] as const;
export type KindFilter = (typeof KINDS)[number];

const LABELS: Record<KindFilter, string> = { block: "Blocks", item: "Items", entity: "Entities", custom: "Custom", other: "Other" };
export const kindLabel = (k: string): string => LABELS[k as KindFilter] ?? k;

/**
 * Subjects as Catalogue items. The API lists a key once per kind (stone as a block and as an item), but both
 * rows open the same page, and a Catalogue is keyed by link: rows with one key become one item, its kinds
 * joined in the quiet word on the right.
 */
export function subjectItems(
  subjects: { key: string; name: string | null; kind: string | null; icon?: string | null }[],
  name: (n: string | null, key: string) => string,
  href: (key: string) => string,
  withKind = true
) {
  const out = new Map<string, { href: string; label: string; meta?: string; icon?: string | null; kinds: string[] }>();
  for (const s of subjects) {
    const h = href(s.key);
    const it = out.get(h);
    if (!it) out.set(h, { href: h, label: name(s.name, s.key), icon: s.icon, kinds: [s.kind ?? "?"] });
    else {
      if (!it.kinds.includes(s.kind ?? "?")) it.kinds.push(s.kind ?? "?");
      it.icon ??= s.icon;
    }
  }
  return [...out.values()].map(({ kinds, ...it }) => ({ ...it, meta: withKind ? kinds.join(", ") : undefined }));
}
