// Icon proxy (PLAN §3.4): cakeutils' rendered icons are content-addressed by sha256, so a copy on disk is
// good forever. The token never leaves the server; visitors get the bytes from /img/icon/<sha>.png.
import { join } from "node:path";
import { isPng, readCached, writeAtomic } from "./disk.ts";

export type IconSource = (sha: string) => Promise<{ ok: true; png: Uint8Array } | { ok: false; kind: string }>;
export type IconResult = { kind: "png"; png: Uint8Array } | { kind: "missing" } | { kind: "unavailable" };

export function createIcons(opts: { dir: string; source: IconSource }) {
  const inflight = new Map<string, Promise<IconResult>>();

  async function load(sha: string): Promise<IconResult> {
    const file = join(opts.dir, `${sha}.png`);
    const hit = await readCached(file);
    if (hit && isPng(hit.bytes)) return { kind: "png", png: hit.bytes };
    const r = await opts.source(sha);
    if (!r.ok) return r.kind === "not_found" ? { kind: "missing" } : { kind: "unavailable" };
    if (!isPng(r.png)) return { kind: "unavailable" };
    await writeAtomic(file, r.png);
    return { kind: "png", png: r.png };
  }

  /** `sha` must already be 64 lower-case hex (the route matcher). Single-flight per icon. */
  function icon(sha: string): Promise<IconResult> {
    let p = inflight.get(sha);
    if (!p) {
      p = load(sha).finally(() => inflight.delete(sha));
      inflight.set(sha, p);
    }
    return p;
  }
  return { icon };
}
