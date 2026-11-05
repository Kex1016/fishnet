// One stat type (W6): its subjects (searchable, paged) and, unless it mixes units, the top of its type-total board.
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { fullType } from "#lib/api/metric.ts";
import { typeLabel } from "#lib/format/labels.ts";
import { withoutHidden } from "#lib/server/hidden.ts";

const LIMIT = 48;

export const load: PageServerLoad = async ({ params, url }) => {
  if (!/^[A-Za-z0-9_.-]+(:[A-Za-z0-9_.-]+)?$/.test(params.type)) error(404, "No such stat type");
  const key = fullType(params.type);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 64);
  const offset = Math.max(0, Math.floor(Number(url.searchParams.get("offset") ?? 0)) || 0);
  const c = api();
  const types = await c.statTypes();
  const type = types.ok ? types.data.types.find((t) => t.key === key) : undefined;
  // custom stats mix units: no type total (400 mixed_units), pick one subject
  const mixed = type?.kind === "custom";
  const [subjects, total] = await Promise.all([
    type || !types.ok ? c.subjects({ type: key, q, limit: LIMIT, offset }) : null,
    type && !mixed ? c.leaderboard({ kind: "stat", type: key, subject: "*" }, "network", { limit: 5 }) : null
  ]);
  const label = typeLabel(key, type?.name);
  if (total?.ok) total.data.entries = withoutHidden(total.data.entries);
  return {
    title: label,
    crumbs: [{ label: "Stats", href: "/stats" }, { label }],
    key,
    label,
    kind: type?.kind ?? null,
    /** the proxy answered and has no such type: nobody has recorded it (PLAN §3.5) */
    unknown: types.ok && !type,
    down: !types.ok,
    mixed,
    subjects,
    total,
    q,
    limit: LIMIT,
    offset
  };
};
