// Server-side preparation of milestone answers before they reach the components (W4, W5, W6 and the
// /milestones page call these in their loads):
//  - opted-out players are dropped from feeds and blanked in ladders (PLAN §3.4), so the names never
//    reach the page; a ladder keeps the rung and says "First player unknown";
//  - feed rows get their icon (and kind) from the catalogue, because the API's rows carry none
//    (pictures.server.ts).
import type { Result } from "#lib/api/result.ts";
import type { AdvancementDetail, AdvancementHolder, AdvancementRow, MilestoneFeedRow, MilestoneLadder } from "#lib/api/types.ts";
import { isHiddenPlayer } from "#lib/server/hidden.ts";
import { withAdvancementIcons, withIcons } from "./pictures.server.ts";

export { withIcons };

type Rows = { milestones: MilestoneFeedRow[]; total: number };
/** any feed whose rows name a player: the stat milestones and the advancement milestones alike */
type AnyRows = { milestones: { uuid?: string | null; name?: string | null }[]; total: number };

function hidden(m: { uuid?: string | null; name?: string | null }): boolean {
  return !!m.uuid && !!m.name && isHiddenPlayer({ uuid: m.uuid, name: m.name });
}

/** Drops rows whose first player opted out. `total` stays the API's (paging is by the API's offsets). */
export function hideFromFeed<T extends AnyRows>(r: Result<T>): Result<T> {
  if (!r.ok) return r;
  return { ...r, data: { ...r.data, milestones: r.data.milestones.filter((m) => !hidden(m)) } };
}

/** Blanks the first player of rows whose first player opted out, keeping the row (a search finds the advancement, not the player). */
export function blankHidden<T extends AnyRows>(r: Result<T>): Result<T> {
  if (!r.ok) return r;
  return { ...r, data: { ...r.data, milestones: r.data.milestones.map((m) => (hidden(m) ? { ...m, uuid: null, name: null } : m)) } };
}

/** Blanks the player of a rung whose first player opted out. */
export function hideFromLadder(r: Result<MilestoneLadder>): Result<MilestoneLadder> {
  if (!r.ok) return r;
  return { ...r, data: { ...r.data, milestones: r.data.milestones.map((m) => (hidden(m) ? { ...m, uuid: null, name: null } : m)) } };
}

/** The usual order for a feed: hide opted-out players, then fetch icons. */
export async function prepareFeed<T extends Rows>(r: Result<T>): Promise<Result<T>> {
  return withIcons(hideFromFeed(r));
}

/** The same for an advancement feed: hide opted-out players, then the advancements' pictures. */
export async function prepareAdvancements<T extends { milestones: AdvancementRow[]; total: number }>(r: Result<T>): Promise<Result<T>> {
  return withAdvancementIcons(hideFromFeed(r));
}

/**
 * An advancement's detail with opted-out first earners blanked (D-111): the row stays, with its server, time and
 * count, so the page says "First player unknown" rather than pretending nobody has it. Hidden rows keep their
 * `earners`, which is a count, not a name.
 */
export function hideFromAdvancement(r: Result<AdvancementDetail>): Result<AdvancementDetail> {
  if (!r.ok) return r;
  const blank = (h: AdvancementHolder): HiddenHolder => (hidden(h) ? { ...h, uuid: null, name: null } : h);
  return { ...r, data: { ...r.data, network: r.data.network ? blank(r.data.network) : null, servers: r.data.servers.map(blank) } as AdvancementDetail };
}

type HiddenHolder = Omit<AdvancementHolder, "uuid" | "name"> & { uuid: string | null; name: string | null };
