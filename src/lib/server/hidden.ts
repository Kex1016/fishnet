// Opted-out players (PLAN §3.4, §8.5): one UUID or name per line in HIDDEN_PLAYERS_FILE
// (default data/hidden-players.txt, mounted at runtime; `#` comments, blank lines ignored). Every
// page and the recorder drop them before rendering or storing anything: a hidden player's profile
// is a 404, and their rows leave lists and boards. Re-read at most once a minute, so an edit to the
// file needs no restart. W5 owns this file; the pure parts live in hidden-list.ts for tests.
import { readFileSync } from "node:fs";
import { config } from "./env.ts";
import { HiddenList, parseHiddenList } from "./hidden-list.ts";

let loaded: { at: number; list: HiddenList } | null = null;

function load(): HiddenList {
  const now = Date.now();
  if (loaded && now - loaded.at < 60_000) return loaded.list;
  let text = "";
  try {
    text = readFileSync(config().hiddenPlayersFile, "utf8");
  } catch {
    // no file: nobody is hidden
  }
  const list = parseHiddenList(text);
  if (!loaded || loaded.list.size !== list.size) console.info(`fishnet: ${list.size} hidden player${list.size === 1 ? "" : "s"}`);
  loaded = { at: now, list };
  return list;
}

/** True when this uuid or name is on the opt-out list. */
export function isHidden(uuidOrName: string): boolean {
  return load().has(uuidOrName);
}

export function isHiddenPlayer(p: { uuid: string; name: string }): boolean {
  return load().hasPlayer(p);
}

/** Drops hidden players from any list of rows that carry `uuid` and `name`. */
export function withoutHidden<T extends { uuid: string; name: string }>(rows: T[]): T[] {
  const list = load();
  return list.size === 0 ? rows : rows.filter((r) => !list.hasPlayer(r));
}
