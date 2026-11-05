// Stat and milestone names: the owner's overrides on top of the site's own labels
// (src/lib/format/labels.ts). Per stat type a label, a title template and a milestone phrase; per
// single stat (criterion form) a title and a phrase. Stored in admin.db, applied on the next page view.
import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { adminStore, requireAdmin, sessionOrSignIn } from "#lib/server/admin/index.ts";
import { setLabelOverrides, typeWords, type TypeWords } from "#lib/format/labels.ts";
import { cleanStatKey, cleanText, cleanTypeKey, STAT_FIELDS, TYPE_FIELDS } from "#lib/server/admin/overrides.ts";

export const load: PageServerLoad = async (event) => {
  sessionOrSignIn(event);
  const store = adminStore();
  const types = await api().statTypes();
  const list = types.ok ? types.data.types : [];
  // the site's own words for each type, shown as placeholders: worked out with the overrides off for
  // a moment (synchronous, so no other request sees that)
  const own: Record<string, TypeWords> = {};
  const current = store?.overrides() ?? { types: {}, stats: {} };
  setLabelOverrides({});
  try {
    for (const t of list) own[t.key] = typeWords(t.key, t.name);
  } finally {
    setLabelOverrides(current);
  }
  return {
    title: "Names",
    crumbs: [{ label: "Admin", href: "/admin" }, { label: "Names", href: "/admin/names" }],
    storeOk: !!store,
    types: list,
    own,
    typesError: types.ok ? null : types.kind,
    overrides: store?.overrides() ?? { types: {}, stats: {} }
  };
};

function fields(form: FormData, names: readonly string[]): { ok: true; values: Record<string, string> } | { ok: false; error: string } {
  const values: Record<string, string> = {};
  for (const n of names) {
    const r = cleanText(form.get(n) ?? "");
    if (!r.ok) return { ok: false, error: `${n}: ${r.error}` };
    values[n] = r.value;
  }
  return { ok: true, values };
}

export const actions: Actions = {
  type: async (event) => {
    const form = await event.request.formData();
    requireAdmin(event, form);
    const store = adminStore();
    if (!store) return fail(500, { error: "The admin database could not be opened." });
    const key = cleanTypeKey(form.get("key"));
    if (!key) return fail(400, { error: "Not a stat type key." });
    const f = fields(form, TYPE_FIELDS);
    if (!f.ok) return fail(400, { error: `${key}: ${f.error}` });
    store.set("type", key, f.values);
    store.audit(`names: type ${key} = ${JSON.stringify(f.values)}`);
    return { saved: key };
  },
  stat: async (event) => {
    const form = await event.request.formData();
    requireAdmin(event, form);
    const store = adminStore();
    if (!store) return fail(500, { error: "The admin database could not be opened." });
    const key = cleanStatKey(form.get("key"));
    if (!key) return fail(400, { error: "Write the stat as type:namespace:id, like killed:minecraft:pufferfish, or killed:* for the type total." });
    const f = fields(form, STAT_FIELDS);
    if (!f.ok) return fail(400, { error: `${key}: ${f.error}` });
    store.set("stat", key, f.values);
    store.audit(`names: stat ${key} = ${JSON.stringify(f.values)}`);
    return { saved: key };
  }
};
