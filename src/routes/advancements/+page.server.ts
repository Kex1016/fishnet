// Advancements (cakeutils D-111): who completed each advancement first, per server and for the network,
// newest first, with the players who were first most often and the advancements most players have.
// 404 when the proxy has no advancement milestones (the nav entry is hidden too). Scopes are network and
// server only: a mini: scope gets a line saying so, never a 500.
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { scopeParam } from "#lib/api/scope.ts";
import { fail, ok, type Result } from "#lib/api/result.ts";
import type { AdvancementRow } from "#lib/api/types.ts";
import { hideFromFeed } from "#lib/milestones/prepare.server.ts";
import { firstsByPlayer } from "#lib/milestones/helpers.ts";
import { mostCompleted } from "#lib/milestones/advancements.ts";

const PAGE = 50;
// The side boards count the newest COUNT_PAGES × 100 rows: every page is one more API read, and each board
// says how many it counted when that is not the whole history.
const COUNT_PAGES = 5;

export const load: PageServerLoad = async ({ url }) => {
  const scope = scopeParam(url);
  const miniScope = scope.startsWith("mini:");
  const offset = Math.max(0, Math.min(1_000_000, Number(url.searchParams.get("offset") ?? 0) || 0));
  const c = api();

  const [network, rawFeed, firstPage] = await Promise.all([
    c.network(),
    miniScope ? Promise.resolve(fail("bad_request")) : c.advancements({ scope, limit: PAGE, offset }),
    miniScope ? Promise.resolve(fail("bad_request")) : c.advancements({ scope, limit: 100, offset: 0 })
  ]);
  if (miniScope ? !(await c.advancementsEnabled()) : !rawFeed.ok && rawFeed.kind === "off") error(404, "This proxy has no advancement milestones");

  const feed = hideFromFeed(rawFeed);

  // the boards: the first page already read, then the rest up to the cap, in parallel
  let counted: Result<{ milestones: AdvancementRow[]; total: number }> = firstPage;
  if (firstPage.ok) {
    const pages = Math.min(COUNT_PAGES, Math.ceil(firstPage.data.total / 100));
    const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => c.advancements({ scope, limit: 100, offset: (i + 1) * 100 })));
    const rows = [...firstPage.data.milestones, ...rest.flatMap((r) => (r.ok ? r.data.milestones : []))];
    counted = ok({ milestones: rows, total: firstPage.data.total }, firstPage.asOf, { stale: firstPage.stale });
  }
  const visible = hideFromFeed(counted);
  const rows = visible.ok ? visible.data.milestones : [];
  const total = counted.ok ? counted.data.total : 0;

  const serverNames: Record<string, string> = {};
  if (network.ok) for (const s of network.data.servers) serverNames[s.id] = s.display_name;

  return {
    title: "Advancements",
    crumbs: [{ label: "Advancements", href: "/advancements" }],
    network,
    serverNames,
    scope,
    miniScope,
    feed,
    limit: PAGE,
    offset,
    firsts: firstsByPlayer(rows).slice(0, 10),
    completed: mostCompleted(rows, 10),
    countedFrom: { read: Math.min(total, COUNT_PAGES * 100), total, asOf: counted.ok ? counted.asOf : null, stale: counted.ok ? counted.stale : false, ok: counted.ok }
  };
};
