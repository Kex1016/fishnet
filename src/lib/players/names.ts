// Names for keys the catalogue has no name for yet (PLAN §2.2): "minecraft:diamond_ore" → "Diamond Ore".
export function titleCase(key: string): string {
  const path = key.includes(":") ? key.slice(key.indexOf(":") + 1) : key;
  return path
    .split(/[_/.-]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** The name to show for a subject, with the fallback. */
export function subjectName(name: string | null | undefined, key: string): string {
  return name ?? titleCase(key);
}

/** A stat type's name from the catalogue, or a title-cased key ("create:pressed" → "Pressed"). */
export function typeName(types: { key: string; name: string | null }[] | undefined, key: string): string {
  return types?.find((t) => t.key === key)?.name ?? titleCase(key);
}

/** A player row created from a stat before login has the UUID as its name (PLAN §2.3). */
export function isUuidName(name: string): boolean {
  return /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(name);
}

/** What to print for a player's name: the name, or "Unnamed player" while it is still a UUID. */
export function playerLabel(name: string): string {
  return isUuidName(name) ? "Unnamed player" : name;
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
