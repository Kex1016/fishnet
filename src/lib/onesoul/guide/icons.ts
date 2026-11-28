// Pictures of the guide's items. One Soul's own items (the mod's textures, static/mc/onesoul/) are bundled;
// every other id is looked up in the catalogue on the server (src/lib/server/onesoul/guide.ts) and arrives here
// as a ready URL. An id with neither has no picture: the slot is drawn empty, the name is still there.
const OWN = new Set(["void_anchor", "void_shard", "gravestone"]);

/** The bundled picture of a One Soul item id (`onesoul:void_anchor`), or null. */
export function ownIcon(id: string): string | null {
  const m = /^onesoul:([a-z0-9_]{1,64})$/.exec(id);
  return m && OWN.has(m[1]) ? `/mc/onesoul/${m[1]}.png` : null;
}
