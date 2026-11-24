// Advancements (cakeutils D-111): who completed each advancement first, per server and for the network,
// newest first, with the players who were first most often, the advancements most players have, and the
// recorder's firsts-per-day heatmap. `?q=` searches the scope's advancements by title or id (the API has
// no search: the site reads the list, up to SEARCH_PAGES × 100, and matches it here).
// 404 when the proxy has no advancement milestones (the nav entry is hidden too). Scopes are network and
// server only: a mini: scope gets a line saying so, never a 500.
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { history } from "#lib/server/history.ts";
import { scopeParam } from "#lib/api/scope.ts";
import { fail, ok, type Result } from "#lib/api/result.ts";
import type { AdvancementRow } from "#lib/api/types.ts";
import { blankHidden, hideFromFeed, prepareAdvancements } from "#lib/milestones/prepare.server.ts";
import { withAdvancementIcons } from "#lib/milestones/pictures.server.ts";
import { firstsByPlayer } from "#lib/milestones/helpers.ts";
import { matchAdvancements, mostCompleted } from "#lib/milestones/advancements.ts";
import { serverNameMap } from "#lib/servers.ts";
import { offsetParam } from "#lib/url.ts";

const PAGE = 50;
// The side boards count the newest COUNT_PAGES × 100 rows: every page is one more API read, and each board
// says how many it counted when that is not the whole history.
const COUNT_PAGES = 5;
// A search reads further, so it finds every advancement on any network we expect (vanilla has about 120).
const SEARCH_PAGES = 10;

/** The search words: trimmed, at most 64 characters. */
function queryParam(url: URL): string {
  return (url.searchParams.get("q") ?? "").trim().slice(0, 64);
}

export const load: PageServerLoad = async ({ url }) => {
  const scope = scopeParam(url);
  const miniScope = scope.startsWith("mini:");
  const offset = offsetParam(url);
  const q = queryParam(url);
  const c = api();

  const [network, rawFeed, firstPage, perDay] = await Promise.all([
    c.network(),
    miniScope ? Promise.resolve(fail("bad_request")) : c.advancements({ scope, limit: PAGE, offset }),
    miniScope ? Promise.resolve(fail("bad_request")) : c.advancements({ scope, limit: 100, offset: 0 }),
    miniScope ? Promise.resolve({ since: null, days: [] }) : history().advancementsPerDay(scope, "quarter")
  ]);
  if (miniScope ? !(await c.advancementsEnabled()) : !rawFeed.ok && rawFeed.kind === "off") error(404, "This proxy has no advancement milestones");

  const feed = await prepareAdvancements(rawFeed);

  // the boards: the first page already read, then the rest up to the cap, in parallel
  let counted: Result<{ milestones: AdvancementRow[]; total: number }> = firstPage;
  if (firstPage.ok) {
    const pages = Math.min(q ? SEARCH_PAGES : COUNT_PAGES, Math.ceil(firstPage.data.total / 100));
    const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => c.advancements({ scope, limit: 100, offset: (i + 1) * 100 })));
    const rows = [...firstPage.data.milestones, ...rest.flatMap((r) => (r.ok ? r.data.milestones : []))];
    counted = ok({ milestones: rows, total: firstPage.data.total }, firstPage.asOf, { stale: firstPage.stale });
  }
  const visible = hideFromFeed(counted);
  const rows = visible.ok ? visible.data.milestones : [];
  const total = counted.ok ? counted.data.total : 0;

  const serverNames = serverNameMap(network);

  // the search: every advancement read, matched on title or id; an opted-out first player is blanked, not dropped
  let search: { q: string; result: Result<{ milestones: AdvancementRow[]; total: number }>; searched: number } | null = null;
  if (q && !miniScope) {
    if (!counted.ok) search = { q, result: counted, searched: 0 };
    else {
      const all = blankHidden(counted);
      const matches = all.ok ? matchAdvancements(all.data.milestones, q) : [];
      const pageRows = ok({ milestones: matches.slice(offset, offset + PAGE), total: matches.length }, counted.asOf, { stale: counted.stale });
      search = { q, result: await withAdvancementIcons(pageRows), searched: counted.data.milestones.length };
    }
  }

  return {
    title: "Advancements",
    crumbs: [{ label: "Advancements", href: "/advancements" }],
    network,
    serverNames,
    scope,
    miniScope,
    feed,
    q,
    search,
    limit: PAGE,
    offset,
    firsts: firstsByPlayer(rows).slice(0, 10),
    completed: mostCompleted(rows, 10),
    perDay,
    countedFrom: { read: Math.min(total, COUNT_PAGES * 100), total, asOf: counted.ok ? counted.asOf : null, stale: counted.ok ? counted.stale : false, ok: counted.ok }
  };
};
