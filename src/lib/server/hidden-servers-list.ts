// The server hide list itself, with no file or env access so it can be tested on its own. Entries
// are cakeutils server ids (velocity.toml keys, `[A-Za-z0-9._-]{1,64}`), matched exactly.
import type { Scope } from "#lib/api/scope.ts";

const ID = /^[A-Za-z0-9._-]{1,64}$/;

export class ServerList {
  readonly ids: readonly string[];
  readonly #set: Set<string>;
  constructor(ids: Iterable<string> = []) {
    this.#set = new Set(ids);
    this.ids = [...this.#set].sort();
  }
  get size(): number {
    return this.#set.size;
  }
  has(id: string | null | undefined): boolean {
    return !!id && this.#set.has(id);
  }
  /** A server scope of a hidden server, or a mini scope inside one. */
  hidesScope(scope: Scope | string | null | undefined): boolean {
    if (!scope || this.#set.size === 0) return false;
    const m = /^(?:server:([^/]+)|mini:([^/]+)\/.+)$/.exec(scope);
    return !!m && this.has(m[1] ?? m[2]);
  }
  /** A mini-server key `<server>/<mini>` on a hidden server. */
  hidesMiniKey(key: string): boolean {
    const i = key.indexOf("/");
    return i > 0 && this.has(key.slice(0, i));
  }
}

/**
 * Parses the file: one server id per line, `#` starts a comment, blank lines ignored. Lines that are
 * not a server id are skipped and returned in `bad`, so the caller can log them once.
 */
export function parseServerList(text: string): { list: ServerList; bad: string[] } {
  const ids: string[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    if (ID.test(line)) ids.push(line);
    else bad.push(line);
  }
  return { list: new ServerList(ids), bad };
}
