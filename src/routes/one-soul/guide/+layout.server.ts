// The One Soul guide (design §8): one entry per feature and per item, from the snapshot the mod publishes (GET
// /v2/onesoul/guide, TH-26). Every number in it is a `{key}` the snapshot fills with the running config's text;
// nothing on these pages is typed. The snapshot and the pictures of its items are read once here, for the contents
// page and for every section page. Pictures are looked up on the server (a catalogue read per item).
import type { LayoutServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { oneSoul } from "#lib/server/onesoul/index.ts";
import { guideIcons } from "#lib/server/onesoul/guide.ts";

export const load: LayoutServerLoad = async ({ parent }) => {
  const { os } = await parent();
  if (!os) return { guide: null, why: "none" as const };
  const r = await oneSoul().guide(os.server);
  if (!r.ok) return { guide: null, why: r.kind === "off" || r.kind === "not_found" ? ("none" as const) : ("down" as const) };
  return { guide: r.data, why: null, asOf: r.asOf, stale: r.stale, icons: await guideIcons(r.data, api()) };
};
