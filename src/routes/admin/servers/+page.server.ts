// Hidden servers: edits HIDDEN_SERVERS_FILE line by line (the owner's comments stay) and drops the
// cached list, so the change shows on the next page view.
import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { config } from "#lib/server/env.ts";
import { hiddenServers, reloadHiddenServers } from "#lib/server/hidden-servers.ts";
import { adminStore, requireAdmin, sessionOrSignIn } from "#lib/server/admin/index.ts";
import { addEntry, readListFile, removeEntry, writeListFile } from "#lib/server/admin/list-file.ts";

const ID = /^[A-Za-z0-9._-]{1,64}$/;
const same = (a: string, b: string) => a === b;

export const load: PageServerLoad = async (event) => {
  sessionOrSignIn(event);
  const net = await api().network(); // already without the hidden ones
  return {
    title: "Hidden servers",
    crumbs: [{ label: "Admin", href: "/admin" }, { label: "Hidden servers", href: "/admin/servers" }],
    hidden: [...hiddenServers().ids],
    visible: net.ok ? net.data.servers.map((s) => ({ id: s.id, name: s.display_name })) : [],
    networkError: net.ok ? null : net.kind
  };
};

async function edit(event: Parameters<Actions[string]>[0], op: "add" | "remove") {
  const form = await event.request.formData();
  requireAdmin(event, form);
  const id = String(form.get("id") ?? "").trim();
  if (!ID.test(id)) return fail(400, { error: "A server id is letters, digits, dots, dashes and underscores, as in velocity.toml." });
  const path = config().hiddenServersFile;
  try {
    const text = readListFile(path);
    writeListFile(path, op === "add" ? addEntry(text, id, same) : removeEntry(text, id, same));
  } catch (e) {
    console.error(`fishnet: hidden servers file not written: ${(e as Error).message}`);
    return fail(500, { error: "The hidden servers file could not be written. The server log says why." });
  }
  reloadHiddenServers();
  adminStore()?.audit(`servers: ${op} ${id}`);
  return { done: op === "add" ? `${id} is hidden.` : `${id} is shown again.` };
}

export const actions: Actions = {
  add: (event) => edit(event, "add"),
  remove: (event) => edit(event, "remove")
};
