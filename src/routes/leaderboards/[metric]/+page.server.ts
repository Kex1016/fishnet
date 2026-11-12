// One board (W6): playtime, a featured or composite board by id, or any stat in criterion form
// (`mined:minecraft:stone`, `mined:*`). Featured ids redirect to the criterion form so every board has
// one URL. The page gets only what it draws (top 10, one table page, the numbers), never the whole board.
import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api, extras } from "#lib/server/cakeutils/client.ts";
import { boardHref, fullType, metricKey, parseMetric, type Metric } from "#lib/api/metric.ts";
import { scopeParam } from "#lib/api/scope.ts";
import { findComposite, findFeatured } from "#lib/boards.ts";
import { statTitle, typeLabel } from "#lib/format/labels.ts";
import type { LeaderboardEntry, StatType, Subject } from "#lib/api/types.ts";
import type { Failure } from "#lib/api/result.ts";
import { formatStat } from "#lib/format/stat-display.ts";
import { withoutHidden } from "#lib/server/hidden.ts";
import { compositeBoard } from "../composite.server.ts";
import { loadBoard } from "../load.server.ts";
import { distribution, median, scopeLabel, scopeMinis, sum } from "../board.ts";

const PAGE = 50;

export const load: PageServerLoad = async ({ params, url }) => {
  const scope = scopeParam(url);
  const c = api();

  const composite = findComposite(params.metric);
  const featured = composite ? undefined : findFeatured(params.metric);
  if (featured && metricKey(featured.metric) !== params.metric) redirect(308, `${boardHref(featured.metric)}${url.search}`);
  const metric: Metric | null = composite ? null : (featured?.metric ?? parseMetric(params.metric));
  if (!composite && !metric) error(404, "No such board");
  if (metric && metricKey(metric) !== params.metric) redirect(308, `${boardHref(metric)}${url.search}`);

  const offset = Math.max(0, Math.floor(Number(url.searchParams.get("offset") ?? 0)) || 0);
  const stat = metric?.kind === "stat" ? metric : null;
  // the leader per day (cakeutils history route); feature-detected, never for composite boards or mini scopes
  const wantHistory = metric !== null && !scope.startsWith("mini:");
  const [network, minis, types, subject, full, hist] = await Promise.all([
    c.network(),
    c.miniServers(),
    stat ? c.statTypes() : null,
    stat && stat.subject !== "*" ? c.subject(stat.subject) : null,
    composite ? compositeBoard(c, composite, scope) : loadBoard(c, metric!, scope),
    wantHistory ? extras().history(metric!, { scope, limit: 5 }) : null
  ]);

  // names: the catalogue's, with the title-cased key as the fallback (PLAN §2.2)
  let type: StatType | undefined;
  let subjectRow: Subject | undefined;
  let title = composite?.label ?? "Playtime";
  let kicker = composite ? "Combined board" : "Leaderboard";
  let about: string | null = composite ? `The ${composite.parts.length} distance stats added together, per player.` : null;
  if (stat) {
    type = types?.ok ? types.data.types.find((t) => t.key === stat.type) : undefined;
    const typeName = typeLabel(stat.type, type?.name);
    if (stat.subject === "*") {
      title = statTitle({ type: stat.type, subject: "*", typeName: type?.name, kind: type?.kind });
      about = `Every stat under ${typeName.toLowerCase()} added together, per player.`;
    } else {
      const names = subject?.ok ? subject.data.names : [];
      subjectRow = names.find((n) => n.kind === type?.kind) ?? names.find((n) => n.kind === null) ?? names[0];
      title = statTitle({ type: stat.type, subject: stat.subject, typeName: type?.name, subjectName: subjectRow?.name });
    }
    kicker = typeName;
  }

  const servers = network.ok ? network.data.servers : [];
  const miniList = scopeMinis(scope, minis.ok ? minis.data.mini_servers.map((m) => ({ server: m.server, id: m.id, display_name: m.display_name })) : []);
  const head = {
    title,
    crumbs: [{ label: "Leaderboards", href: "/leaderboards" }, { label: title }],
    kicker,
    about,
    composite: composite ? { id: composite.id, label: composite.label } : null,
    typeKey: stat ? fullType(stat.type) : null,
    subjectKey: stat && stat.subject !== "*" ? stat.subject : null,
    subjectIcon: subjectRow?.icon ?? null,
    subjectKind: subjectRow?.kind ?? type?.kind ?? null,
    scope,
    scopeName: scopeLabel(scope, servers, miniList),
    network,
    minis: miniList,
    limit: PAGE,
    offset
  };

  const history = leaderSeries(hist);
  if (!full.ok) return { ...head, history, board: full as Failure };

  // numbers for the tiles come from the loaded players; a capped board says so instead of guessing
  const d = full.data;
  const values = d.entries.map((e) => e.value);
  const top: LeaderboardEntry[] = d.entries.slice(0, 10);
  let rows = d.entries.slice(offset, offset + PAGE);
  let tableFailed = false;
  if (rows.length === 0 && offset < d.total && d.capped && metric) {
    // a table page past the loaded part of a very large board asks the API for that page directly
    const r = await c.leaderboard(metric, scope, { limit: PAGE, offset });
    if (r.ok) rows = withoutHidden(r.data.entries);
    else tableFailed = true;
  }
  return {
    ...head,
    history,
    board: {
      ok: true as const,
      asOf: full.asOf,
      stale: full.stale,
      empty: full.empty,
      unit: d.unit,
      total: d.total,
      capped: d.capped,
      top,
      rows,
      tableFailed,
      ranked: d.capped ? d.total : d.entries.length,
      topDisplay: d.entries[0]?.display ?? null,
      medianDisplay: !d.capped && values.length ? formatStat(d.unit, median(values)!) : null,
      totalDisplay: !d.capped && values.length ? formatStat(d.unit, sum(values)) : null,
      histogram: distribution(values, d.unit)
    }
  };
};

/** The leader's value each day, or null when the route is off, the stat is not tracked or nothing is recorded. */
function leaderSeries(r: Awaited<ReturnType<ReturnType<typeof extras>["history"]>> | null) {
  if (!r?.ok || r.data.tracked === false) return null;
  const points: { t: number; v: number; label?: string }[] = [];
  for (const d of r.data.days) {
    const t = typeof d.day === "number" ? d.day : Date.parse(`${d.day}T00:00:00Z`);
    // players who opted out never show, so the leader is the best-ranked visible player that day
    const top = withoutHidden(d.entries).sort((a, b) => a.rank - b.rank)[0];
    if (!Number.isFinite(t) || !top || !Number.isFinite(top.value)) continue;
    points.push({ t, v: top.value });
  }
  points.sort((a, b) => a.t - b.t);
  return points.length ? { points, unit: r.data.unit ?? null, asOf: r.asOf, stale: r.stale } : null;
}
