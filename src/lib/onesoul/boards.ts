// Board answers as BarList rows, linked to the player's One Soul page.
import type { Leaderboard } from "#lib/api/types.ts";
import { osHref } from "./links.ts";

export function barRows(b: Leaderboard | null | undefined) {
  return (b?.entries ?? []).map((e) => ({ rank: e.rank, key: e.uuid, label: e.name, v: e.value, display: e.display, uuid: e.uuid, href: osHref.player(e.uuid) }));
}
