// "Show on map" (FM-8, brief §5.1): what the button on a player's profile does, decided from plain facts so the
// profile's load, the button and the tests agree. Pure: no server code, safe in the browser.
import { mapHref } from "./links.ts";

export type ShowOnMapInput = {
  uuid: string;
  /** the player's display name (plain text) */
  name: string;
  online: boolean;
  /** the server they are on now, null between servers */
  server: string | null;
  /** servers with a map (cakeutils /v2/map, hidden and One Soul servers already left out); null when the map cannot be read */
  maps: readonly { server: string; display_name: string; live_players: boolean }[] | null;
  /** the map answered "off" (not implemented): the button is left out */
  mapOff?: boolean;
  /** server names for the reasons, by id */
  serverNames?: Readonly<Record<string, string>>;
};

export type ShowOnMap =
  | { kind: "link"; href: string; server: string }
  | { kind: "disabled"; reason: string }
  | null;

/** The link that centres the map on a player and follows them (the page reads `follow`; FM-4 writes it). */
export function showHref(server: string, uuid: string): string {
  return mapHref(server, { follow: uuid });
}

/** Link, disabled with a reason, or nothing (the map is off on this site; hidden players never get here). */
export function showOnMap(i: ShowOnMapInput): ShowOnMap {
  if (i.mapOff) return null;
  if (!i.online) return { kind: "disabled", reason: `${i.name} is offline.` };
  if (i.server === null) return { kind: "disabled", reason: `${i.name} is between servers right now.` };
  if (i.maps === null) return { kind: "disabled", reason: "The map cannot be reached right now." };
  const entry = i.maps.find((m) => m.server === i.server);
  const label = entry?.display_name ?? i.serverNames?.[i.server] ?? i.server;
  if (!entry) return { kind: "disabled", reason: `${label} has no map.` };
  if (!entry.live_players) return { kind: "disabled", reason: `Live positions are off on ${label}.` };
  return { kind: "link", href: showHref(entry.server, i.uuid), server: entry.server };
}

/** Why a followed player is not on the map the link opened (the page's Notice). */
export type FollowNote = {
  name: string;
  /** where they are instead, when that server has a live map */
  elsewhere: { server: string; name: string; href: string } | null;
  reason: "offline" | "positions_off" | "elsewhere" | "not_visible";
};

export function followText(n: FollowNote): string {
  switch (n.reason) {
    case "offline":
      return `${n.name} is offline, so there is no one to follow.`;
    case "positions_off":
      return `Live positions are off on this server, so ${n.name} cannot be followed.`;
    case "elsewhere":
      return `${n.name} is on ${n.elsewhere?.name ?? "another server"}, not on this map.`;
    default:
      return `${n.name} is not on this map right now.`;
  }
}
