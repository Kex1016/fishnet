// The guide's item pictures, looked up on the server: one catalogue read per distinct item id (cached
// 30 minutes, policy.ts), the site's own pictures for what the catalogue lacks (#lib/icons/fallback.ts) and the
// bundled textures of One Soul's own items. The reader is passed in (the route gives the site's client), so this runs under `bun test`. A page gets a plain `{ id: url }` and never a token or a sha path.
import type { Guide } from "#lib/onesoul/guide/types.ts";
import { ownIcon } from "#lib/onesoul/guide/icons.ts";
import { itemIds } from "#lib/onesoul/guide/text.ts";
import { iconHref } from "#lib/images.ts";
import { subjectPictures, type SubjectReader } from "#lib/milestones/pictures.ts";

export async function guideIcons(g: Guide, reader: SubjectReader): Promise<Record<string, string>> {
  const ids = itemIds(g);
  const out: Record<string, string> = {};
  const rest: string[] = [];
  for (const id of ids) {
    const own = ownIcon(id);
    if (own) out[id] = own;
    else if (!id.startsWith("onesoul:")) rest.push(id);
  }
  const found = await subjectPictures(reader, rest, { max: 96, things: true, kind: "item" });
  for (const [id, p] of found) {
    const src = iconHref(p.icon);
    if (src) out[id] = src;
  }
  return out;
}
