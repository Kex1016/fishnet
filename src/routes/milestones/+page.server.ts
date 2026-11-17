// Milestones (W7): the feed with scope, stat type and player filters, the players with the most milestones
// and the per-day heatmap. 404 when the proxy has no milestones (the nav entry is hidden too).
//
// "Most milestones" is every player's total, counted from the recorder's copy of the feed
// (History.milestoneHolders): the API has no "milestones per player" route. Until the recorder has read the
// whole feed once (a new install, or the recorder is off) the board counts the newest SAMPLE_PAGES × 100
// milestones through the API and says so, never presenting a part as the whole.
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { history } from "#lib/server/history.ts";
import { isHidden, isHiddenPlayer, withoutHidden } from "#lib/server/hidden.ts";
import { scopeParam, type Scope } from "#lib/api/scope.ts";
import { fail, type Result } from "#lib/api/result.ts";
import type { MilestoneFeedRow } from "#lib/api/types.ts";
import { hideFromFeed, prepareFeed } from "#lib/milestones/prepare.server.ts";
import { firstsByPlayer } from "#lib/milestones/helpers.ts";
import { typeLabel } from "#lib/format/labels.ts";
import { offsetParam } from "#lib/url.ts";

const PAGE = 50;
const SAMPLE_PAGES = 5;
const TOP = 10;
const SUGGEST = 6;

type Feed = Result<{ milestones: MilestoneFeedRow[]; total: number }>;
type Filter = { scope: Scope; type?: string };

/** One player's milestones as feed rows (the player endpoint's rows carry no player: it is on the envelope). */
async function playerFeed(ref: string, filter: Filter, offset: number): Promise<{ feed: Feed; player: { uuid: string; name: string } | null }> {
  if (isHidden(ref)) return { feed: fail("not_found", { status: 404 }), player: null };
  const r = await api().playerMilestones(ref, { ...filter, limit: PAGE, offset });
  if (!r.ok) return { feed: r, player: null };
  const player = { uuid: r.data.uuid, name: r.data.name };
  if (isHiddenPlayer(player)) return { feed: fail("not_found", { status: 404 }), player: null };
  return { feed: { ...r, data: { total: r.data.total, milestones: r.data.milestones.map((m) => ({ ...m, ...player })) } }, player };
}

/** The newest SAMPLE_PAGES × 100 milestones counted per player, for the time before the recorder's copy is complete. */
async function sampled(filter: Filter) {
  const c = api();
  const first = await c.milestones({ ...filter, limit: 100, offset: 0 });
  if (!first.ok) return { ok: false as const, rows: [], read: 0, total: 0, asOf: null, stale: false };
  const pages = Math.min(SAMPLE_PAGES, Math.ceil(first.data.total / 100));
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => c.milestones({ ...filter, limit: 100, offset: (i + 1) * 100 })));
  const all = [...first.data.milestones, ...rest.flatMap((r) => (r.ok ? r.data.milestones : []))];
  const visible = hideFromFeed({ ...first, data: { milestones: all, total: first.data.total } });
  const rows = visible.ok ? firstsByPlayer(visible.data.milestones).map((p) => ({ uuid: p.uuid, name: p.name, count: p.count })) : [];
  return { ok: true as const, rows, read: Math.min(first.data.total, SAMPLE_PAGES * 100), total: first.data.total, asOf: first.asOf, stale: first.stale };
}

export const load: PageServerLoad = async ({ url }) => {
  const scope = scopeParam(url);
  const type = url.searchParams.get("type") || undefined;
  const offset = offsetParam(url);
  const wanted = (url.searchParams.get("player") ?? "").trim().slice(0, 64) || null;
  const filter = { scope, type };

  const [network, types, shown, perDay, holders] = await Promise.all([
    api().network(),
    api().statTypes(),
    wanted ? playerFeed(wanted, filter, offset) : api().milestones({ ...filter, limit: PAGE, offset }).then((feed) => ({ feed: hideFromFeed(feed as Feed), player: null })),
    history().milestonesPerDay(scope, "quarter"),
    history().milestoneHolders(scope, type)
  ]);
  if (!shown.feed.ok && shown.feed.kind === "off") error(404, "This proxy has no milestones");

  const feed = await prepareFeed(shown.feed);

  // the player filter takes an exact name or UUID (the API's player reference); a miss offers the names that contain it
  let suggestions: { uuid: string; name: string }[] = [];
  if (wanted && !shown.feed.ok && shown.feed.kind === "not_found") {
    const near = await api().players({ q: wanted, limit: SUGGEST });
    if (near.ok) suggestions = withoutHidden(near.data.players).map((p) => ({ uuid: p.uuid, name: p.name }));
  }

  // every player's total from the recorder's copy, or the sample until that copy is complete
  const exact = holders.complete !== null;
  const sample = exact ? null : await sampled(filter);
  const board = exact
    ? { exact: true as const, ok: true, rows: holders.holders.slice(0, TOP), players: holders.holders.length, read: holders.counted, total: holders.counted, asOf: holders.asOf, stale: false }
    : { exact: false as const, ok: sample!.ok, rows: sample!.rows.slice(0, TOP), players: sample!.rows.length, read: sample!.read, total: sample!.total, asOf: sample!.asOf, stale: sample!.stale };

  const typeOptions = types.ok ? types.data.types.map((t) => ({ key: t.key, label: typeLabel(t.key, t.name) })) : [];
  return {
    title: shown.player ? `Milestones of ${shown.player.name}` : "Milestones",
    crumbs: [{ label: "Milestones", href: "/milestones" }],
    network,
    scope,
    type: type ?? "",
    typeOptions,
    feed,
    limit: PAGE,
    offset,
    /** the player filter as typed, and the player it found (null: nobody by that name, or the feed failed) */
    wanted,
    player: shown.player,
    suggestions,
    board,
    perDay
  };
};
