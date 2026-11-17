// Milestones per player: every player who was first to a milestone, with their total, in one scope and
// (optionally) one stat type. The counts are the recorder's copy of the milestone feed
// (History.milestoneHolders): the API has no "milestones per player" route, and reading every player's
// own list on each visit would cost a request per player. Until that copy has been read in full once the
// page says so instead of showing part of the totals. 404 when the proxy has no milestones.
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { history } from "#lib/server/history.ts";
import { parseScope, scopeParam } from "#lib/api/scope.ts";
import { typeLabel } from "#lib/format/labels.ts";
import { offsetParam } from "#lib/url.ts";
import { arrange, ranked, sortParam } from "../holders.ts";

const PAGE = 50;

export const load: PageServerLoad = async ({ url }) => {
  const scope = scopeParam(url);
  const type = url.searchParams.get("type") || undefined;
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 64);
  const sort = sortParam(url.searchParams.get("sort"));
  const offset = offsetParam(url);

  const [enabled, network, types, holders, recordingSince] = await Promise.all([
    api().milestonesEnabled(),
    api().network(),
    api().statTypes(),
    history().milestoneHolders(scope, type),
    history().recordingSince()
  ]);
  if (!enabled) error(404, "This proxy has no milestones");

  const everyone = ranked(holders.holders);
  const rows = arrange(everyone, q, sort);
  return {
    title: "Milestones per player",
    crumbs: [
      { label: "Milestones", href: "/milestones" },
      { label: "Players", href: "/milestones/players" }
    ],
    network,
    scope,
    /** milestones are kept per server and for the network: a mini scope has none */
    mini: parseScope(scope)?.kind === "mini",
    type: type ?? "",
    typeOptions: types.ok ? types.data.types.map((t) => ({ key: t.key, label: typeLabel(t.key, t.name) })) : [],
    q,
    sort,
    /** false until the recorder has read the whole feed of this scope once */
    complete: holders.complete !== null,
    recording: recordingSince !== null,
    asOf: holders.asOf,
    /** milestones counted, and the players who hold them (before the name filter) */
    counted: holders.counted,
    players: everyone.length,
    matching: rows.length,
    rows: rows.slice(offset, offset + PAGE),
    limit: PAGE,
    offset
  };
};
