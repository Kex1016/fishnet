// Names for keys the catalogue has no name for yet (PLAN §2.2): "minecraft:diamond_ore" → "Diamond Ore".
export function titleCase(key: string): string {
  const path = key.includes(":") ? key.slice(key.indexOf(":") + 1) : key;
  return path
    .split(/[_/.]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** The name to show for a subject, with the fallback. */
export function subjectName(name: string | null | undefined, key: string): string {
  return name ?? titleCase(key);
}

/** A player row created from a stat before login has the UUID as its name (PLAN §2.3). */
export function isUuidName(name: string): boolean {
  return /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(name);
}
