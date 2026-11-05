// Player faces (PLAN §3.4): the skin comes from Mojang's session server by UUID, the 8x8 head and its hat
// layer are cropped with sharp and scaled up with nearest-neighbour to 64x64, cached on disk. Visitors never
// contact Mojang. Anything that goes wrong yields "default" and the route redirects to the default head.
import sharp from "sharp";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { isPng, readCached, writeAtomic } from "./disk.ts";

// Skins change rarely and a day-old head is fine: a head is fresh for 3 days, then served at once while
// one refresh runs behind it (never blocking a visitor on Mojang again once a head is on disk).
export const FACE_TTL_MS = 3 * 24 * 3600_000;
/** a player Mojang knows but who has no skin of their own (or no such account) is asked again after this long */
export const FACE_MISS_TTL_MS = 3600_000;
/** a failed lookup (network, Mojang 5xx, a bad answer) is only remembered this long, so a fallback never sticks */
export const FACE_ERROR_TTL_MS = 5 * 60_000;
const BACKOFF_MS = 60_000;
const MAX_SKIN_BYTES = 256 * 1024;
const FETCH_TIMEOUT_MS = 5_000;
const MAX_CONCURRENT = 4;

export type FaceResult = { kind: "face"; png: Buffer; stale: boolean } | { kind: "default" };

export type FaceOptions = {
  /** directory for cached heads, e.g. data/cache/faces */
  dir: string;
  fetch?: typeof fetch;
  /** mock mode and tests: never call Mojang */
  offline?: boolean;
  log?: (line: string) => void;
};

/** For /healthz: how often Mojang said no, so a rejection can be told apart from cakeutils' own. */
export type FaceStats = {
  fetched: number;
  failed: number;
  /** why heads fell back: `noSkin` (the default skin is right), `noProfile` (Mojang has no such account),
   *  `offlineUuid` (an offline-mode server's UUID: never asked), `error` (network, HTTP or a bad answer) */
  reasons: Record<MissReason, number>;
  /** the last failed lookup, e.g. "profile: HTTP 503" or "skin: fetch failed"; no UUIDs, no URLs */
  lastError: string | null;
  lastErrorAt: number | null;
  mojang429: number;
  last429At: number | null;
  backoffUntil: number | null;
};

export type MissReason = "noSkin" | "noProfile" | "offlineUuid" | "error";
type Miss = { miss: MissReason; detail?: string };

/** How long a miss is remembered on disk. A marker from before reasons existed (empty) counts as an error. */
export function missTtl(reason: string): number {
  return reason === "noSkin" || reason === "noProfile" ? FACE_MISS_TTL_MS : FACE_ERROR_TTL_MS;
}

/** Offline-mode servers hand out name-based (version 3) UUIDs that Mojang has never heard of. */
export function isOfflineUuid(id: string): boolean {
  return id.length === 32 && id[12] === "3";
}

/** Crop head + hat from a skin (64x64, legacy 64x32, or an HD multiple of 64) into a 64x64 PNG. */
export async function headFromSkin(skin: Uint8Array): Promise<Buffer> {
  const img = sharp(skin);
  const { width, height } = await img.metadata();
  if (!width || !height || width % 64 !== 0 || (height !== width && height * 2 !== width)) throw new Error("not a skin");
  const s = width / 64;
  const crop = (left: number) => sharp(skin).extract({ left: left * s, top: 8 * s, width: 8 * s, height: 8 * s });
  const hat = await crop(40).ensureAlpha().png().toBuffer();
  // Composite at native size first: sharp applies composite after resize within one pipeline.
  const merged = await crop(8).ensureAlpha().composite([{ input: hat }]).png().toBuffer();
  return sharp(merged).resize(64, 64, { kernel: "nearest" }).png().toBuffer();
}

/** The skin URL out of a session-server profile, only when it is on Mojang's texture host. Mojang writes
 *  these as `http://textures.minecraft.net/...`; the same path is served over https, so it is fetched that way. */
export function skinUrlFromProfile(profile: unknown): string | null {
  const props = (profile as { properties?: { name?: string; value?: string }[] } | null)?.properties;
  const tex = props?.find((p) => p?.name === "textures")?.value;
  if (typeof tex !== "string") return null;
  try {
    const url = JSON.parse(Buffer.from(tex, "base64").toString("utf8"))?.textures?.SKIN?.url;
    if (typeof url !== "string") return null;
    const u = new URL(url);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || u.hostname !== "textures.minecraft.net" || u.port || u.username || u.password) return null;
    u.protocol = "https:";
    return u.toString();
  } catch {
    return null;
  }
}

export function createFaces(opts: FaceOptions) {
  const f = opts.fetch ?? fetch;
  const log = opts.log ?? ((l: string) => console.warn(l));
  const stats = {
    fetched: 0,
    failed: 0,
    reasons: { noSkin: 0, noProfile: 0, offlineUuid: 0, error: 0 } as Record<MissReason, number>,
    lastError: null as string | null,
    lastErrorAt: null as number | null,
    mojang429: 0,
    last429At: null as number | null
  };
  const logged = new Set<string>();
  const inflight = new Map<string, Promise<Buffer | null>>();
  let backoffUntil = 0;
  let active = 0;
  const waiters: (() => void)[] = [];

  async function slot<T>(run: () => Promise<T>): Promise<T> {
    if (active >= MAX_CONCURRENT) await new Promise<void>((r) => waiters.push(r));
    active++;
    try {
      return await run();
    } finally {
      active--;
      waiters.shift()?.();
    }
  }

  async function get(url: string, accept: "json" | "bytes"): Promise<Response | "throttled"> {
    const res = await f(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: "error", headers: { accept: accept === "json" ? "application/json" : "image/png" } });
    if (res.status === 429) {
      const t = Date.now();
      stats.mojang429++;
      stats.last429At = t;
      if (t >= backoffUntil) log(`faces: Mojang rate-limited the skin lookup (429); serving cached or default heads for ${BACKOFF_MS / 1000} s`);
      backoffUntil = t + BACKOFF_MS;
      return "throttled";
    }
    return res;
  }

  /** A head, a miss with its reason (remembered on disk for `missTtl`), or "throttled" (Mojang said 429: not a miss). */
  async function fetchFace(id: string): Promise<Buffer | Miss | "throttled"> {
    let step = "profile";
    try {
      const profileRes = await get(`https://sessionserver.mojang.com/session/minecraft/profile/${id}`, "json");
      if (profileRes === "throttled") return profileRes;
      // 204 (or 404) is Mojang's "no such account"
      if (profileRes.status === 204 || profileRes.status === 404) return { miss: "noProfile" };
      if (!profileRes.ok) return { miss: "error", detail: `profile: HTTP ${profileRes.status}` };
      const profile = await profileRes.json();
      const skin = skinUrlFromProfile(profile);
      if (!skin) return hasTextures(profile) ? { miss: "noSkin" } : { miss: "error", detail: "profile: no textures" };
      step = "skin";
      const skinRes = await get(skin, "bytes");
      if (skinRes === "throttled") return skinRes;
      if (!skinRes.ok) return { miss: "error", detail: `skin: HTTP ${skinRes.status}` };
      const bytes = new Uint8Array(await skinRes.arrayBuffer());
      if (bytes.length > MAX_SKIN_BYTES || !isPng(bytes)) return { miss: "error", detail: "skin: not a png" };
      step = "crop";
      return await headFromSkin(bytes);
    } catch (e) {
      return { miss: "error", detail: `${step}: ${errText(e)}` };
    }
  }

  function noteMiss(m: Miss) {
    stats.failed++;
    stats.reasons[m.miss]++;
    if (m.miss !== "error") return;
    stats.lastError = m.detail ?? "unknown";
    stats.lastErrorAt = Date.now();
    // one line per kind of failure per process, so a broken route to Mojang shows in `docker logs` once
    if (!logged.has(stats.lastError)) {
      logged.add(stats.lastError);
      log(`faces: skin lookup failed (${stats.lastError}); serving default heads for ${FACE_ERROR_TTL_MS / 60_000} min, then asking again`);
    }
  }

  /** One fetch per player at a time; writes the head (or a miss marker) to disk. */
  function refresh(id: string, file: string): Promise<Buffer | null> {
    let p = inflight.get(id);
    if (!p) {
      p = slot(() => fetchFace(id))
        .then(async (png) => {
          if (png === "throttled") return null;
          if (Buffer.isBuffer(png)) {
            stats.fetched++;
            await writeAtomic(file, png);
            await rm(join(opts.dir, `${id}.miss`), { force: true }).catch(() => {});
            return png;
          }
          noteMiss(png);
          await writeAtomic(join(opts.dir, `${id}.miss`), png.miss);
          return null;
        })
        .finally(() => inflight.delete(id));
      inflight.set(id, p);
    }
    return p;
  }

  /** `uuid` is the dashed lower-case form the route matcher yields. Never throws. */
  async function face(uuid: string): Promise<FaceResult> {
    if (opts.offline) return { kind: "default" };
    const id = uuid.replace(/-/g, "");
    const file = join(opts.dir, `${id}.png`);
    const cached = await readCached(file);
    if (cached && cached.ageMs < FACE_TTL_MS) return { kind: "face", png: cached.bytes, stale: false };

    if (!cached && isOfflineUuid(id)) {
      stats.reasons.offlineUuid++;
      return { kind: "default" };
    }
    const miss = await readCached(join(opts.dir, `${id}.miss`));
    const missFresh = miss !== null && miss.ageMs < missTtl(miss.bytes.toString("utf8").trim());
    const mayAsk = !missFresh && Date.now() >= backoffUntil;
    if (cached) {
      // an old head now, a new one for the next visitor
      if (mayAsk) void refresh(id, file);
      return { kind: "face", png: cached.bytes, stale: true };
    }
    if (mayAsk) {
      const png = await refresh(id, file);
      if (png) return { kind: "face", png, stale: false };
    }
    // Mojang unreachable, throttling or no skin, and no head on disk yet
    return { kind: "default" };
  }

  function faceStats(): FaceStats {
    return { ...stats, backoffUntil: backoffUntil > Date.now() ? backoffUntil : null };
  }

  return { face, stats: faceStats };
}

function hasTextures(profile: unknown): boolean {
  return !!(profile as { properties?: { name?: string }[] } | null)?.properties?.some?.((p) => p?.name === "textures");
}

/** A short, URL-free reason: "timeout", "fetch failed", "ENOTFOUND" ... */
function errText(e: unknown): string {
  const err = e as { name?: string; message?: string; cause?: { code?: string } } | null;
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return "timeout";
  const code = err?.cause?.code;
  if (typeof code === "string") return code;
  const msg = typeof err?.message === "string" ? err.message.replace(/https?:\/\/\S+/g, "<url>") : "error";
  return msg.slice(0, 80);
}
