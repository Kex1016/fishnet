// Names for keys the catalogue has no name for yet (PLAN §2.2). Stat words live in #lib/format/labels.ts;
// these stay as the names the pages already import.
import { subjectLabel, titleCase, typeLabel } from "#lib/format/labels.ts";

export { titleCase };

/** The name to show for a subject: the API's without template placeholders, else the key title-cased. */
export function subjectName(name: string | null | undefined, key: string): string {
  return subjectLabel(name, key);
}

/** A stat type's short name ("Killed", "Picked up"): never the API's raw "You killed %s %s" template. */
export function typeName(types: { key: string; name: string | null }[] | undefined, key: string): string {
  return typeLabel(key, types?.find((t) => t.key === key)?.name);
}

/** A player row created from a stat before login has the UUID as its name (PLAN §2.3). */
export function isUuidName(name: string): boolean {
  return /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(name);
}

/** What to print for a player's name: the name, or "Unnamed player" while it is still a UUID. */
export function playerLabel(name: string): string {
  return isUuidName(name) ? "Unnamed player" : name;
}

/**
 * A player's name in a row among other players (a board, a feed, a table): the name, or "Player 1a2b3c4d"
 * while it is still a UUID, so two unnamed players stay apart.
 */
export function playerRowLabel(p: { uuid: string; name: string }): string {
  return isUuidName(p.name) ? `Player ${shortUuid(p.uuid)}` : p.name;
}

/** The profile link: by name, or by UUID while the name is one. */
export function playerHref(p: { uuid: string; name: string }): string {
  return `/players/${encodeURIComponent(isUuidName(p.name) ? p.uuid : p.name)}`;
}

/** The first 8 hex digits of a UUID, for a mono hint beside an unnamed player. */
export function shortUuid(uuid: string): string {
  return uuid.replace(/-/g, "").slice(0, 8);
}

/** A mini-server key "<server>/<mini>" split in two; null when it is not one. */
export function splitMini(key: string): { server: string; mini: string } | null {
  const i = key.indexOf("/");
  if (i < 1 || i === key.length - 1) return null;
  return { server: key.slice(0, i), mini: key.slice(i + 1) };
}
