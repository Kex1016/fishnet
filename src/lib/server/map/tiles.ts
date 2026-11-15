// The tile proxy and its disk cache (FM-1; brief §4.2). Visitors never reach cakeutils: a tile is served from
// FISHNET_DATA_DIR/map/<server>/<world>/<z>/<x>_<y>.png (+ a `.json` sidecar {etag, fetchedAt, ver}), filled and
// kept current from cakeutils' /v2/map tile route through the map bucket (mapApi().mapTile / roundMapTile).
//
// Rules (brief §4.2):
// - a copy younger than FRESH_MS is served as is; an older one is served at once and revalidated behind it
//   (If-None-Match: a 304 costs one request and no bytes);
// - a 404 is remembered MISS_MS (unrendered areas are common) and answers without asking again;
// - cakeutils down, throttled or refusing: the copy on disk is served whatever its age (terrain is fine stale);
// - `?v=<epoch>.<seq>` (from the change log) names a version: a copy fetched for that version, or a later one,
//   is served as immutable. Any other copy is checked with cakeutils first (a 304 usually), because an
//   immutable URL must never pin an older picture. If cakeutils cannot be asked, the old copy is served
//   without `immutable` so the browser asks again soon;
// - a finished One Soul round's tiles never change: served from disk whatever their age;
// - one upstream request per tile at a time (single-flight), at most MAX_PER_SERVER per server at once;
// - the cache is capped (MAP_CACHE_MAX_MB), evicted by last access, oldest first, by a sweep every 10 minutes
//   (and early when writes overshoot the cap).
//
// Hidden servers (and One Soul servers on the live map) are 404 before the disk is read. Every path part is
// validated before a disk path is built (links.ts); the server id additionally may not be `.` or `..`.
import { readdir, readFile, rm, stat, utimes } from "node:fs/promises";
import { join } from "node:path";
import type { Result } from "#lib/api/result.ts";
import { validCycle, validServerId, validTile, validWorldId, type TileKey } from "#lib/map/links.ts";
import type { MapTile, TileOptions } from "../cakeutils/map.ts";
import { isPng, writeAtomic } from "../images/disk.ts";

export const FRESH_MS = 60_000;
export const MISS_MS = 5 * 60_000;
export const SWEEP_MS = 10 * 60_000;
export const MAX_PER_SERVER = 16;
/** a hit refreshes the file's mtime (its "last access") at most this often */
const TOUCH_MS = 5 * 60_000;
/** after a failed revalidation, leave the tile alone this long */
const RETRY_MS = 60_000;
/** a sweep that has to delete stops at this share of the cap, so it does not run again at once */
const LOW_WATER = 0.9;
const MAX_MEMORY_KEYS = 20_000;

export type TileRef = { server: string; world: string; tile: TileKey; round?: number };
export type TileSource = (ref: TileRef, o: TileOptions) => Promise<Result<MapTile>>;

/** What the route needs to answer the browser. */
export type TileAnswer =
  | {
      kind: "tile";
      png: Uint8Array;
      etag: string | null;
      /** `immutable`: the browser may keep it for a year (a requested version is confirmed, or a finished round) */
      immutable: boolean;
      /** served from an old copy because cakeutils could not be asked */
      stale: boolean;
      /** where this answer came from, for the `x-map-cache` header and the tests */
      source: "fresh" | "revalidated" | "stale-revalidating" | "miss" | "stale";
    }
  | { kind: "missing" }
  | { kind: "unavailable"; retryAfter: number | null };

export type TileServiceOptions = {
  /** `<FISHNET_DATA_DIR>/map` */
  dir: string;
  /** the cap in bytes */
  maxBytes: number;
  source: TileSource;
  /** may this server's tiles be shown now (hidden / One Soul servers are not) */
  visible: (server: string, scope: "live" | "round") => boolean;
  now?: () => number;
  /** milliseconds between sweeps; 0 = none scheduled (tests call sweep()) */
  sweepMs?: number;
  freshMs?: number;
  missMs?: number;
  maxPerServer?: number;
  log?: (line: string) => void;
};

type Sidecar = { etag: string | null; fetchedAt: number; ver: string | null };
type Disk = { png: Uint8Array; meta: Sidecar | null };
type Fetched = { kind: "ok"; png: Uint8Array; etag: string | null } | { kind: "same" } | { kind: "missing" } | { kind: "failed"; retryAfter: number | null };

export type SweepResult = { files: number; bytes: number; removed: number; freed: number };

export function createTileService(o: TileServiceOptions) {
  const now = o.now ?? Date.now;
  const freshMs = o.freshMs ?? FRESH_MS;
  const missMs = o.missMs ?? MISS_MS;
  const perServer = o.maxPerServer ?? MAX_PER_SERVER;
  const log = o.log ?? ((l: string) => console.log(l));
  const misses = new Map<string, number>();
  const retryAt = new Map<string, number>();
  const flights = new Map<string, Promise<Fetched>>();
  const active = new Map<string, { n: number; queue: (() => void)[] }>();
  let approxBytes = 0;
  let sweeping: Promise<SweepResult> | null = null;
  const stats = { upstream: 0, hits: 0, misses: 0, maxActive: 0 };

  // --- keys and paths ---------------------------------------------------------------------------------

  /** a valid reference, or null (and then nothing is read, written or asked) */
  function check(ref: TileRef): boolean {
    const round = ref.round !== undefined;
    return (
      validServerId(ref.server) &&
      ref.server !== "." &&
      ref.server !== ".." &&
      validWorldId(ref.world) &&
      validTile(ref.tile) &&
      (!round || validCycle(ref.round!)) &&
      o.visible(ref.server, round ? "round" : "live")
    );
  }
  // "@" is not allowed in a world id, so a round's directory cannot collide with a world's
  const base = (r: TileRef) => join(o.dir, r.server, ...(r.round !== undefined ? ["@round", String(r.round)] : []), r.world, String(r.tile.z));
  const pngPath = (r: TileRef) => join(base(r), `${r.tile.x}_${r.tile.y}.png`);
  const metaPath = (r: TileRef) => join(base(r), `${r.tile.x}_${r.tile.y}.json`);
  const keyOf = (r: TileRef) => `${r.server}\0${r.round ?? ""}\0${r.world}\0${r.tile.z}\0${r.tile.x}\0${r.tile.y}`;

  // --- disk -------------------------------------------------------------------------------------------

  async function readDisk(r: TileRef): Promise<Disk | null> {
    let png: Uint8Array;
    let mtime: number;
    try {
      const p = pngPath(r);
      [png, mtime] = await Promise.all([readFile(p), stat(p).then((s) => s.mtimeMs)]);
    } catch {
      return null;
    }
    if (!isPng(png)) return null;
    let meta: Sidecar | null = null;
    try {
      const m = JSON.parse(await readFile(metaPath(r), "utf8"));
      if (m && typeof m.fetchedAt === "number") meta = { etag: typeof m.etag === "string" ? m.etag : null, fetchedAt: m.fetchedAt, ver: typeof m.ver === "string" ? m.ver : null };
    } catch {
      // a missing or torn sidecar: the picture is kept, treated as old and without an ETag
    }
    if (now() - mtime > TOUCH_MS) void utimes(pngPath(r), new Date(), new Date()).catch(() => {});
    return { png, meta };
  }

  async function writeDisk(r: TileRef, png: Uint8Array, meta: Sidecar): Promise<void> {
    // picture first, sidecar second: a reader between the two sees the new picture with the old ETag, which
    // only costs one 200 instead of a 304
    await writeAtomic(pngPath(r), png);
    await writeAtomic(metaPath(r), JSON.stringify(meta));
    approxBytes += png.length + 120;
    if (o.maxBytes > 0 && approxBytes > o.maxBytes * 1.1) void sweep().catch(() => {});
  }

  async function writeMeta(r: TileRef, meta: Sidecar): Promise<void> {
    await writeAtomic(metaPath(r), JSON.stringify(meta));
  }

  async function dropDisk(r: TileRef): Promise<void> {
    await Promise.all([rm(pngPath(r), { force: true }), rm(metaPath(r), { force: true })]).catch(() => {});
  }

  // --- memory -----------------------------------------------------------------------------------------

  function remember(map: Map<string, number>, key: string, until: number): void {
    if (map.size >= MAX_MEMORY_KEYS) {
      const t = now();
      for (const [k, v] of map) if (v <= t) map.delete(k);
      if (map.size >= MAX_MEMORY_KEYS) for (const k of [...map.keys()].slice(0, MAX_MEMORY_KEYS / 2)) map.delete(k);
    }
    map.set(key, until);
  }
  function isRemembered(map: Map<string, number>, key: string): boolean {
    const until = map.get(key);
    if (until === undefined) return false;
    if (until > now()) return true;
    map.delete(key);
    return false;
  }

  // --- upstream ---------------------------------------------------------------------------------------

  async function slot<T>(server: string, run: () => Promise<T>): Promise<T> {
    let s = active.get(server);
    if (!s) active.set(server, (s = { n: 0, queue: [] }));
    if (s.n >= perServer) await new Promise<void>((res) => s!.queue.push(res));
    else s.n++;
    stats.maxActive = Math.max(stats.maxActive, s.n);
    try {
      return await run();
    } finally {
      const next = s.queue.shift();
      if (next) next();
      else if (--s.n === 0) active.delete(server);
    }
  }

  /** One upstream request for a tile, shared by everyone asking for it right now. `background`: a revalidation behind a served copy. */
  function fetchTile(r: TileRef, etag: string | null, ver: string | null, background: boolean): Promise<Fetched> {
    const key = `${keyOf(r)}\0${ver ?? ""}\0${background ? "b" : "p"}`;
    const hit = flights.get(key);
    if (hit) return hit;
    const p = slot(r.server, async (): Promise<Fetched> => {
      stats.upstream++;
      const opt: TileOptions = { etag, priority: background ? "background" : "page" };
      const res = await o.source(r, opt);
      if (!res.ok) {
        if (res.kind === "not_found" || res.kind === "off" || res.kind === "bad_request") return { kind: "missing" };
        return { kind: "failed", retryAfter: res.retryAfter ?? null };
      }
      if (res.data.notModified) {
        // still the copy we hold: remember when we checked, and for which version
        return { kind: "same" };
      }
      if (!isPng(res.data.png)) return { kind: "failed", retryAfter: null };
      return { kind: "ok", png: res.data.png, etag: res.data.etag };
    })
      .catch((): Fetched => ({ kind: "failed", retryAfter: null }))
      .finally(() => flights.delete(key));
    flights.set(key, p);
    return p;
  }

  /** Apply an upstream answer to the disk and the memory; returns the picture to serve, if any. */
  async function settle(r: TileRef, f: Fetched, held: Disk | null, ver: string | null): Promise<Disk | "missing" | "failed"> {
    const t = now();
    if (f.kind === "ok") {
      const meta = { etag: f.etag, fetchedAt: t, ver };
      await writeDisk(r, f.png, meta);
      return { png: f.png, meta };
    }
    if (f.kind === "same" && held) {
      const meta = { etag: held.meta?.etag ?? null, fetchedAt: t, ver: ver ?? held.meta?.ver ?? null };
      await writeMeta(r, meta);
      return { png: held.png, meta };
    }
    if (f.kind === "missing") {
      remember(misses, keyOf(r), t + missMs);
      if (held) await dropDisk(r);
      return "missing";
    }
    remember(retryAt, keyOf(r), t + RETRY_MS);
    return "failed";
  }

  // --- the answer -------------------------------------------------------------------------------------

  /** `a.b.c`'s epoch is everything before the last dot, its seq the integer after it */
  function splitVer(v: string | null): { epoch: string; seq: number } | null {
    if (!v) return null;
    const i = v.lastIndexOf(".");
    if (i <= 0) return null;
    const seq = Number(v.slice(i + 1));
    return Number.isInteger(seq) && seq >= 0 ? { epoch: v.slice(0, i), seq } : null;
  }
  /** a copy fetched for `stored` is at least as new as the version asked for */
  function verSatisfied(stored: string | null, want: string): boolean {
    if (stored === want) return true;
    const a = splitVer(stored);
    const b = splitVer(want);
    return !!a && !!b && a.epoch === b.epoch && a.seq >= b.seq;
  }

  async function get(ref: TileRef, version?: string | null): Promise<TileAnswer> {
    if (!check(ref)) return { kind: "missing" };
    const key = keyOf(ref);
    if (isRemembered(misses, key)) return { kind: "missing" };
    const round = ref.round !== undefined;
    const want = !round && version ? version : null;
    const held = await readDisk(ref);
    const age = held?.meta ? now() - held.meta.fetchedAt : Infinity;
    const serve = (d: Disk, source: Extract<TileAnswer, { kind: "tile" }>["source"], immutable: boolean, stale = false): TileAnswer => ({
      kind: "tile",
      png: d.png,
      etag: d.meta?.etag ?? null,
      immutable,
      stale,
      source
    });

    if (held) {
      stats.hits++;
      // a finished round never changes
      if (round) return serve(held, "fresh", true);
      // the copy was fetched for this version or a later one
      if (want && verSatisfied(held.meta?.ver ?? null, want) && age < Infinity) {
        if (age >= freshMs) revalidateBehind(ref, held);
        return serve(held, age < freshMs ? "fresh" : "stale-revalidating", true);
      }
      if (!want) {
        if (age < freshMs) return serve(held, "fresh", false);
        revalidateBehind(ref, held);
        return serve(held, "stale-revalidating", false);
      }
      // a version we do not hold: ask cakeutils now, then decide (below)
    } else {
      stats.misses++;
    }

    const f = await fetchTile(ref, held?.meta?.etag ?? null, want, false);
    const s = await settle(ref, f, held, want);
    if (s === "missing") return { kind: "missing" };
    if (s === "failed") {
      if (held) return serve(held, "stale", false, true);
      return { kind: "unavailable", retryAfter: f.kind === "failed" ? f.retryAfter : null };
    }
    return serve(s, held ? "revalidated" : "miss", round || !!want);
  }

  /** the picture is already on its way to the visitor: check it with cakeutils behind it (never twice at once, not again soon after a failure) */
  function revalidateBehind(ref: TileRef, held: Disk): void {
    const key = keyOf(ref);
    if (isRemembered(retryAt, key)) return;
    remember(retryAt, key, now() + RETRY_MS);
    void fetchTile(ref, held.meta?.etag ?? null, null, true)
      .then((f) => settle(ref, f, held, null))
      .catch(() => {});
  }

  // --- eviction ---------------------------------------------------------------------------------------

  type Entry = { path: string; size: number; mtime: number };

  async function walk(dir: string, out: Entry[], depth = 0): Promise<void> {
    let names: import("node:fs").Dirent[];
    try {
      names = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of names) {
      const p = join(dir, d.name);
      if (d.isDirectory()) {
        if (depth < 8) await walk(p, out, depth + 1);
      } else if (d.isFile()) {
        try {
          const s = await stat(p);
          out.push({ path: p, size: s.size, mtime: s.mtimeMs });
        } catch {
          // gone while walking
        }
      }
    }
  }

  /** Delete the least recently used tiles until the cache is under the cap; also clears stray temp files and orphan sidecars. */
  function sweep(): Promise<SweepResult> {
    if (sweeping) return sweeping;
    sweeping = (async () => {
      const files: Entry[] = [];
      await walk(o.dir, files);
      const t = now();
      let removed = 0;
      let freed = 0;
      const kill = async (e: Entry) => {
        await rm(e.path, { force: true }).catch(() => {});
        removed++;
        freed += e.size;
      };
      const live: Entry[] = [];
      const pngs = new Set(files.filter((f) => f.path.endsWith(".png")).map((f) => f.path.slice(0, -4)));
      for (const f of files) {
        if (f.path.endsWith(".tmp")) {
          if (t - f.mtime > 3600_000) await kill(f);
        } else if (f.path.endsWith(".json") && !pngs.has(f.path.slice(0, -5))) {
          await kill(f);
        } else live.push(f);
      }
      // a picture and its sidecar go together, ranked by the picture's last access
      const units = new Map<string, { png: Entry | null; meta: Entry | null }>();
      for (const f of live) {
        const stem = f.path.replace(/\.(png|json)$/, "");
        const u = units.get(stem) ?? { png: null, meta: null };
        if (f.path.endsWith(".png")) u.png = f;
        else u.meta = f;
        units.set(stem, u);
      }
      let total = live.reduce((n, f) => n + f.size, 0);
      if (o.maxBytes > 0 && total > o.maxBytes) {
        const order = [...units.values()].filter((u) => u.png).sort((a, b) => a.png!.mtime - b.png!.mtime);
        const target = o.maxBytes * LOW_WATER;
        for (const u of order) {
          if (total <= target) break;
          for (const e of [u.png, u.meta]) if (e) {
            await kill(e);
            total -= e.size;
          }
        }
        if (removed > 0) log(`map tile cache: over its cap, removed ${removed} files (${Math.round(freed / 1024 / 1024)} MiB)`);
      }
      approxBytes = total;
      return { files: live.length, bytes: total, removed, freed };
    })().finally(() => {
      sweeping = null;
    });
    return sweeping;
  }

  let timer: ReturnType<typeof setInterval> | null = null;
  if ((o.sweepMs ?? SWEEP_MS) > 0) {
    timer = setInterval(() => void sweep().catch(() => {}), o.sweepMs ?? SWEEP_MS);
    timer.unref?.();
    setTimeout(() => void sweep().catch(() => {}), 30_000).unref?.();
  }

  return {
    get,
    sweep,
    stop: () => timer && clearInterval(timer),
    /** for /healthz-style numbers and the tests: no paths, no ids */
    stats: () => ({ ...stats, inFlight: flights.size, rememberedMisses: misses.size, approxBytes })
  };
}

export type TileService = ReturnType<typeof createTileService>;

/** The headers of a tile answer (route and tests share them). */
export function tileHeaders(a: Extract<TileAnswer, { kind: "tile" }>): Record<string, string> {
  return {
    "content-type": "image/png",
    "cache-control": a.immutable ? "public, max-age=31536000, immutable" : "public, max-age=60, stale-while-revalidate=86400",
    "x-content-type-options": "nosniff",
    "x-map-cache": a.source,
    ...(a.etag ? { etag: a.etag } : {})
  };
}

/** Does an If-None-Match header name this ETag (strong or weak, one or a list)? */
export function etagMatches(header: string | null, etag: string | null): boolean {
  if (!header || !etag) return false;
  const norm = (s: string) => s.trim().replace(/^W\//, "");
  const want = norm(etag);
  return header.split(",").some((v) => norm(v) === "*" || norm(v) === want);
}
