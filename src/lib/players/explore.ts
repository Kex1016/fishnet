// The stats explorer's pure parts (PLAN §3.4): a player's stats come from the API ordered by type
// then subject, never by value, and in pages of at most 100. The page collects the pages, then this
// module orders them for reading: by type (catalogue order), and inside a type biggest first. A type
// with several units (custom) keeps each unit together so values are only ever compared in one unit.
import type { StatTypes, StatValue, Unit } from "#lib/api/types.ts";
import { typeName } from "./names.ts";

export type StatGroup = {
  type: string;
  name: string;
  kind: string | null;
  /** ordered biggest first inside each unit */
  stats: StatValue[];
  /** how many rows this type has in total (the group may hold fewer when the page cut it) */
  total: number;
};

/** Units in reading order: counts, then time, distance and damage. Unknown units go last, by name. */
const UNIT_ORDER: Record<string, number> = { count: 0, ticks: 1, distance_cm: 2, damage_tenths: 3, ms: 1 };

export function unitRank(u: Unit): number {
  return UNIT_ORDER[u] ?? 10;
}

/** Biggest first inside one unit; units in reading order; ties by subject key so the order is stable. */
export function compareStats(a: StatValue, b: StatValue): number {
  const ua = unitRank(a.unit);
  const ub = unitRank(b.unit);
  if (ua !== ub) return ua - ub;
  if (ua === 10 && a.unit !== b.unit) return a.unit < b.unit ? -1 : 1;
  if (a.value !== b.value) return b.value - a.value;
  return a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0;
}

/**
 * Groups rows by type in the catalogue's order (types the catalogue does not list yet come after,
 * in the order they were first seen), each group sorted biggest first. `perType` keeps only that
 * many rows per group (the "All" view), with `total` saying how many there were.
 */
export function groupByType(rows: StatValue[], types: StatTypes["types"] | undefined, perType?: number): StatGroup[] {
  const byType = new Map<string, StatValue[]>();
  for (const r of rows) {
    let g = byType.get(r.type);
    if (!g) byType.set(r.type, (g = []));
    g.push(r);
  }
  const order = new Map<string, number>();
  types?.forEach((t, i) => order.set(t.key, i));
  const keys = [...byType.keys()].sort((a, b) => {
    const ia = order.get(a);
    const ib = order.get(b);
    if (ia !== undefined && ib !== undefined) return ia - ib;
    if (ia !== undefined) return -1;
    if (ib !== undefined) return 1;
    return 0; // both unknown: insertion order
  });
  return keys.map((type) => {
    const all = byType.get(type)!.sort(compareStats);
    return {
      type,
      name: typeName(types, type),
      kind: types?.find((t) => t.key === type)?.kind ?? null,
      stats: perType ? all.slice(0, perType) : all,
      total: all.length
    };
  });
}

/** The kind the Slot glyph should use for a row: from the catalogue's type, else null. */
export function kindOf(types: StatTypes["types"] | undefined, type: string): string | null {
  return types?.find((t) => t.key === type)?.kind ?? null;
}
