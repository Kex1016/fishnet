// The opt-out list itself, with no file or env access so it can be tested on its own. Entries are
// UUIDs (dashed or not) or names; matching ignores case and dashes.
export class HiddenList {
  readonly #keys: Set<string>;
  constructor(keys: Iterable<string> = []) {
    this.#keys = new Set(keys);
  }
  get size(): number {
    return this.#keys.size;
  }
  /** A UUID or a name. */
  has(uuidOrName: string): boolean {
    return this.#keys.size > 0 && this.#keys.has(normalize(uuidOrName));
  }
  hasPlayer(p: { uuid: string; name: string }): boolean {
    return this.has(p.uuid) || this.has(p.name);
  }
}

export function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/-/g, "");
}

/** Parses the file: one entry per line, `#` starts a comment, blank lines ignored. */
export function parseHiddenList(text: string): HiddenList {
  const keys: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0];
    const key = normalize(line);
    if (key) keys.push(key);
  }
  return new HiddenList(keys);
}
