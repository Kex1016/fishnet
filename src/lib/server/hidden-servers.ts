// Hidden servers: one server id per line in HIDDEN_SERVERS_FILE (default data/hidden-servers.txt,
// mounted at runtime; `#` comments, blank lines ignored), like the player opt-out list (hidden.ts).
// A hidden server leaves every page, scope switch, feed, board and the recorder, and the network
// figures are asked of cakeutils without it (`exclude=`, cakeutils D-113): see cakeutils/hide.ts.
// Re-read at most once a minute, so an edit needs no restart.
import { readFileSync } from "node:fs";
import { config } from "./env.ts";
import { parseServerList, ServerList } from "./hidden-servers-list.ts";

let loaded: { at: number; list: ServerList } | null = null;

/** The current list (cached for a minute). */
export function hiddenServers(): ServerList {
  const now = Date.now();
  if (loaded && now - loaded.at < 60_000) return loaded.list;
  let text = "";
  try {
    text = readFileSync(config().hiddenServersFile, "utf8");
  } catch {
    // no file: no server is hidden
  }
  const { list, bad } = parseServerList(text);
  if (!loaded || loaded.list.ids.join(",") !== list.ids.join(",")) {
    console.info(`fishnet: ${list.size} hidden server${list.size === 1 ? "" : "s"}`);
    if (bad.length) console.warn(`fishnet: ${bad.length} line${bad.length === 1 ? "" : "s"} in the hidden servers file ${bad.length === 1 ? "is" : "are"} not a server id`);
  }
  loaded = { at: now, list };
  return list;
}

/** Drops the cached list, so the next call re-reads the file (after an admin edit). */
export function reloadHiddenServers(): void {
  loaded = null;
}

export function isHiddenServer(id: string | null | undefined): boolean {
  return hiddenServers().has(id);
}
