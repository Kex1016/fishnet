// The configured singletons the /img routes use: caches live under FISHNET_DATA_DIR/cache.
import { join } from "node:path";
import { api } from "../cakeutils/client.ts";
import { config } from "../env.ts";
import { createFaces } from "./faces.ts";
import { createIcons } from "./icons.ts";

let faces: ReturnType<typeof createFaces> | null = null;
let icons: ReturnType<typeof createIcons> | null = null;

export function faceService() {
  const c = config();
  return (faces ??= createFaces({ dir: join(c.dataDir, "cache", "faces"), offline: c.mock !== null }));
}

export function iconService() {
  return (icons ??= createIcons({
    dir: join(config().dataDir, "cache", "icons"),
    source: async (sha) => {
      const r = await api().icon(sha);
      return r.ok ? { ok: true, png: r.data.png } : { ok: false, kind: r.kind };
    }
  }));
}
