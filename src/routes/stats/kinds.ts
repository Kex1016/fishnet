// The subject kinds the catalogue documents (API §stats/subjects `kind`), in the order the filter shows them.
export const KINDS = ["block", "item", "entity", "custom", "other"] as const;
export type KindFilter = (typeof KINDS)[number];

const LABELS: Record<KindFilter, string> = { block: "Blocks", item: "Items", entity: "Entities", custom: "Custom", other: "Other" };
export const kindLabel = (k: string): string => LABELS[k as KindFilter] ?? k;
