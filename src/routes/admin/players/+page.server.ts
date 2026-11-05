// Hidden (opted-out) players: edits HIDDEN_PLAYERS_FILE line by line (the owner's comments stay)
// and drops the cached list, so the change shows on the next page view.
import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { config } from "#lib/server/env.ts";
import { reloadHiddenPlayers } from "#lib/server/hidden.ts";
import { normalize } from "#lib/server/hidden-list.ts";
import { adminStore, requireAdmin, sessionOrSignIn } from "#lib/server/admin/index.ts";
import { addEntry, entries, readListFile, removeEntry, writeListFile } from "#lib/server/admin/list-file.ts";

/** A Minecraft name (3–16 of letters, digits, _; older accounts may be shorter) or a UUID, dashed or not. */
const ENTRY = /^(?:[A-Za-z0-9_]{1,16}|[0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
const same = (a: string, b: string) => normalize(a) === normalize(b);

export const load: PageServerLoad = async (event) => {
  sessionOrSignIn(event);
  return {
    title: "Hidden players",
    crumbs: [{ label: "Admin", href: "/admin" }, { label: "Hidden players", href: "/admin/players" }],
    hidden: entries(readListFile(config().hiddenPlayersFile))
  };
};

async function edit(event: Parameters<Actions[string]>[0], op: "add" | "remove") {
  const form = await event.request.formData();
  requireAdmin(event, form);
  const entry = String(form.get("entry") ?? "").trim();
  if (!ENTRY.test(entry)) return fail(400, { error: "Write a player name or a UUID." });
  const path = config().hiddenPlayersFile;
  try {
    const text = readListFile(path);
    writeListFile(path, op === "add" ? addEntry(text, entry, same) : removeEntry(text, entry, same));
  } catch (e) {
    console.error(`fishnet: hidden players file not written: ${(e as Error).message}`);
    return fail(500, { error: "The hidden players file could not be written. The server log says why." });
  }
  reloadHiddenPlayers();
  adminStore()?.audit(`players: ${op} ${entry}`);
  return { done: op === "add" ? `${entry} is hidden.` : `${entry} is shown again.` };
}

export const actions: Actions = {
  add: (event) => edit(event, "add"),
  remove: (event) => edit(event, "remove")
};
