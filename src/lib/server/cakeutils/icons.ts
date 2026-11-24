// The site's own pictures (src/lib/icons/fallback.ts) put into every answer that carries a catalogue icon, where
// cakeutils has none: the catalogue (subjects, one subject) and a player's stats. Pages keep reading `icon`.
// The cached originals are never changed: an answer with a gap is copied.
import type { Result } from "#lib/api/result.ts";
import { fallbackIcon, kindOfType } from "#lib/icons/fallback.ts";
import type { Client } from "./client.ts";

type WithIcon = { icon: string | null };

function fill<T extends WithIcon>(rows: T[], pick: (r: T) => string | null): T[] {
  if (!rows.some((r) => !r.icon && pick(r))) return rows;
  return rows.map((r) => {
    if (r.icon) return r;
    const icon = pick(r);
    return icon ? { ...r, icon } : r;
  });
}

const map = <T>(r: Result<T>, f: (d: T) => T): Result<T> => (r.ok ? { ...r, data: f(r.data) } : r);

/** A stat row's picture: its subject in the kind its type counts (unknown types: as an item, a block, a mob). */
const statIcon = (r: { type: string; subject: string }) => fallbackIcon(r.subject, kindOfType(r.type));

export function withFallbackIcons<C extends Client>(inner: C): C {
  return {
    ...inner,
    subjects: async (q) => map(await inner.subjects(q), (d) => ({ ...d, subjects: fill(d.subjects, (s) => fallbackIcon(s.key, s.kind)) })),
    subject: async (key) => map(await inner.subject(key), (d) => ({ ...d, names: fill(d.names, (n) => fallbackIcon(n.key, n.kind)) })),
    playerStats: async (ref, q) => map(await inner.playerStats(ref, q), (d) => ({ ...d, stats: fill(d.stats, statIcon) })),
    playerStat: async (ref, type, subject, scope) =>
      map(await inner.playerStat(ref, type, subject, scope), (d) => (d.icon ? d : { ...d, icon: statIcon(d) }))
  };
}
