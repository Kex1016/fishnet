// Server-side preparation of milestone answers before they reach the components (W4, W5, W6 and the
// /milestones page call these in their loads):
//  - opted-out players are dropped from feeds and blanked in ladders (PLAN §3.4), so the names never
//    reach the page; a ladder keeps the rung and says "First player unknown";
//  - feed rows get their icon (and kind) from the catalogue, because the API's rows carry none.
import type { Result } from "#lib/api/result.ts";
import type { AdvancementDetail, AdvancementHolder, MilestoneFeedRow, MilestoneLadder } from "#lib/api/types.ts";
import { api } from "#lib/server/cakeutils/client.ts";
import { isHiddenPlayer } from "#lib/server/hidden.ts";

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

/** Blanks the player of a rung whose first player opted out. */
export function hideFromLadder(r: Result<MilestoneLadder>): Result<MilestoneLadder> {
  if (!r.ok) return r;
  return { ...r, data: { ...r.data, milestones: r.data.milestones.map((m) => (hidden(m) ? { ...m, uuid: null, name: null } : m)) } };
}

/** Adds `icon` and `kind` to the rows from the catalogue (one `subject` read per distinct subject, at most `max`). */
export async function withIcons<T extends Rows>(r: Result<T>, max = 24): Promise<Result<T>> {
  if (!r.ok || r.data.milestones.length === 0) return r;
  const keys = [...new Set(r.data.milestones.map((m) => m.subject).filter((s) => s && s !== "*"))].slice(0, max);
  const found = new Map<string, Pick<MilestoneFeedRow, "icon" | "kind">>();
  await Promise.all(
    keys.map(async (key) => {
      const d = await api().subject(key);
      if (!d.ok) return;
      const names = d.data.names;
      const pick = names.find((n) => n.icon) ?? names[0];
      if (pick) found.set(key, { icon: pick.icon ?? null, kind: pick.kind ?? null });
    })
  );
  const milestones = r.data.milestones.map((m) => (found.has(m.subject) ? { ...m, ...found.get(m.subject) } : m));
  return { ...r, data: { ...r.data, milestones } };
}

/** The usual order for a feed: hide opted-out players, then fetch icons. */
export async function prepareFeed<T extends Rows>(r: Result<T>): Promise<Result<T>> {
  return withIcons(hideFromFeed(r));
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
