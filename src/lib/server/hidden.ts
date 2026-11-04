// Opted-out players (PLAN §3.4, §8.5): one UUID or name per line in HIDDEN_PLAYERS_FILE
// (default data/hidden-players.txt, mounted at runtime; `#` comments). Every page and the recorder
// drop them before rendering or storing anything. Re-read at most once a minute.
import { readFileSync } from "node:fs";
import { config } from "./env.ts";

let loaded: { at: number; set: Set<string> } | null = null;

function load(): Set<string> {
  const now = Date.now();
  if (loaded && now - loaded.at < 60_000) return loaded.set;
  const set = new Set<string>();
  try {
    for (const raw of readFileSync(config().hiddenPlayersFile, "utf8").split("\n")) {
      const line = raw.split("#")[0].trim();
      if (line) set.add(line.toLowerCase().replace(/-/g, ""));
    }
  } catch {
    // no file: nobody is hidden
  }
  loaded = { at: now, set };
  return set;
}

/** True when this uuid or name is on the opt-out list. */
export function isHidden(uuidOrName: string): boolean {
  return load().has(uuidOrName.toLowerCase().replace(/-/g, ""));
}

export function isHiddenPlayer(p: { uuid: string; name: string }): boolean {
  const s = load();
  return s.has(p.uuid.toLowerCase().replace(/-/g, "")) || s.has(p.name.toLowerCase());
}

/** Drops hidden players from any list of rows that carry `uuid` and `name`. */
export function withoutHidden<T extends { uuid: string; name: string }>(rows: T[]): T[] {
  return rows.filter((r) => !isHiddenPlayer(r));
}
