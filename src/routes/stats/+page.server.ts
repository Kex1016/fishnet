// The catalogue (W6): every stat type, and every subject with its icon. Searchable by name or key,
// filterable by kind, paged. Nothing here is a fixed list: it is whatever the proxy has recorded.
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { KINDS } from "./kinds.ts";

const LIMIT = 48;

export const load: PageServerLoad = async ({ url }) => {
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 64);
  const kindParam = url.searchParams.get("kind");
  const kind = KINDS.find((k) => k === kindParam);
  const offset = Math.max(0, Math.floor(Number(url.searchParams.get("offset") ?? 0)) || 0);
  const c = api();
  const [types, subjects] = await Promise.all([c.statTypes(), c.subjects({ q, kind, limit: LIMIT, offset })]);
  // how many subjects each type has (one cheap call per type; the catalogue is cached for minutes)
  const counts = new Map<string, number>();
  if (types.ok) {
    const per = await Promise.all(types.data.types.map((t) => c.subjects({ type: t.key, limit: 1 })));
    types.data.types.forEach((t, i) => {
      const r = per[i];
      if (r.ok) counts.set(t.key, r.data.total);
    });
  }
  return {
    title: "Stats",
    crumbs: [{ label: "Stats", href: "/stats" }],
    types,
    typeCounts: Object.fromEntries(counts),
    subjects,
    q,
    kind: kind ?? null,
    limit: LIMIT,
    offset
  };
};
