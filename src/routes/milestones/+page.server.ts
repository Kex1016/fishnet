// Milestones (W7): the feed with scope and type filters, the "most firsts" board, the per-day heatmap.
// 404 when the proxy has no milestones (the nav entry is hidden too).
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { history } from "#lib/server/history.ts";
import { scopeParam } from "#lib/api/scope.ts";
import { ok, type Result } from "#lib/api/result.ts";
import type { MilestoneFeedRow } from "#lib/api/types.ts";
import { hideFromFeed, prepareFeed } from "#lib/milestones/prepare.server.ts";
import { firstsByPlayer } from "#lib/milestones/helpers.ts";
import { typeLabel } from "#lib/format/labels.ts";

const PAGE = 50;
// "Most firsts" counts the newest FIRSTS_PAGES × 100 milestones: every page is one more API read, and the
// board says how many it counted (never presented as the whole history when it is not).
const FIRSTS_PAGES = 5;

export const load: PageServerLoad = async ({ url }) => {
  const scope = scopeParam(url);
  const type = url.searchParams.get("type") || undefined;
  const offset = Math.max(0, Math.min(1_000_000, Number(url.searchParams.get("offset") ?? 0) || 0));
  const filter = { scope, type };

  const [network, types, rawFeed, firstPage, perDay] = await Promise.all([
    api().network(),
    api().statTypes(),
    api().milestones({ ...filter, limit: PAGE, offset }),
    api().milestones({ ...filter, limit: 100, offset: 0 }),
    history().milestonesPerDay(scope, "quarter")
  ]);
  if (!rawFeed.ok && rawFeed.kind === "off") error(404, "This proxy has no milestones");

  const feed = await prepareFeed(rawFeed);

  // the firsts board: the first page already read, then the rest up to the cap, in parallel
  let counted: Result<{ milestones: MilestoneFeedRow[]; total: number }> = firstPage;
  if (firstPage.ok) {
    const pages = Math.min(FIRSTS_PAGES, Math.ceil(firstPage.data.total / 100));
    const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => api().milestones({ ...filter, limit: 100, offset: (i + 1) * 100 })));
    const rows = [...firstPage.data.milestones, ...rest.flatMap((r) => (r.ok ? r.data.milestones : []))];
    counted = ok({ milestones: rows, total: firstPage.data.total }, firstPage.asOf, { stale: firstPage.stale });
  }
  const hiddenFree = hideFromFeed(counted);
  const firsts = hiddenFree.ok ? firstsByPlayer(hiddenFree.data.milestones).slice(0, 10) : [];
  const countedRows = hiddenFree.ok ? hiddenFree.data.milestones.length : 0;
  const total = counted.ok ? counted.data.total : 0;

  const typeOptions = types.ok ? types.data.types.map((t) => ({ key: t.key, label: typeLabel(t.key, t.name) })) : [];
  return {
    title: "Milestones",
    crumbs: [{ label: "Milestones", href: "/milestones" }],
    network,
    scope,
    type: type ?? "",
    typeOptions,
    feed,
    limit: PAGE,
    offset,
    firsts,
    firstsFrom: { read: Math.min(total, FIRSTS_PAGES * 100), total, asOf: counted.ok ? counted.asOf : null, stale: counted.ok ? counted.stale : false, ok: counted.ok, rows: countedRows },
    perDay
  };
};
