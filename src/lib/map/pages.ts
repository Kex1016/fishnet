// Pure helpers of the map pages (FM-4): which world opens, how worlds are ordered, how a server's players are
// grouped for the Players popout. No Leaflet, no server code: safe in the browser and in tests.
// World order and labels are worlds.ts (sortWorlds, worldLabel).
import type { PlayerDot } from "./types.ts";

/** The world a link asks for when the server has it, else the first in order (a share link to a gone world still opens). */
export function pickWorld<T extends { id: string }>(ordered: readonly T[], wanted: string | undefined): T | undefined {
  return ordered.find((w) => w.id === wanted) ?? ordered[0];
}

export type PlayerGroups = { here: PlayerDot[]; elsewhere: PlayerDot[] };

/** Players of a server split into the shown world and the others, each sorted by name (case-insensitive). */
export function groupPlayers(players: readonly PlayerDot[], world: string): PlayerGroups {
  const byName = (a: PlayerDot, b: PlayerDot) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || (a.uuid < b.uuid ? -1 : 1);
  return { here: players.filter((p) => p.world === world).sort(byName), elsewhere: players.filter((p) => p.world !== world).sort(byName) };
}

/** Merge a live `players` event into the list: entries replace by uuid, `gone` drops; `replace` starts from nothing. */
export function mergePlayers(current: readonly PlayerDot[], ev: { players: readonly PlayerDot[]; gone: readonly string[] }, replace: boolean): PlayerDot[] {
  const map = new Map<string, PlayerDot>(replace ? [] : current.map((p) => [p.uuid, p]));
  for (const u of ev.gone) map.delete(u);
  for (const p of ev.players) map.set(p.uuid, p);
  return [...map.values()];
}
