// Player faces (PLAN §3.4): the skin comes from Mojang's session server by UUID, the 8x8 head and its hat
// layer are cropped with sharp and scaled up with nearest-neighbour to 64x64, cached on disk. Visitors never
// contact Mojang. Anything that goes wrong yields "default" and the route redirects to the default head.
import sharp from "sharp";
import { join } from "node:path";
import { ageOf, isPng, readCached, writeAtomic } from "./disk.ts";

// Skins change rarely and a day-old head is fine: a head is fresh for 3 days, then served at once while
// one refresh runs behind it (never blocking a visitor on Mojang again once a head is on disk).
export const FACE_TTL_MS = 3 * 24 * 3600_000;
/** a player without a skin (or a failed fetch) is asked again after this long */
export const FACE_MISS_TTL_MS = 3600_000;
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
export type FaceStats = { fetched: number; failed: number; mojang429: number; last429At: number | null; backoffUntil: number | null };

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

/** The skin URL out of a session-server profile, only when it is on Mojang's texture host over https. */
export function skinUrlFromProfile(profile: unknown): string | null {
  const props = (profile as { properties?: { name?: string; value?: string }[] } | null)?.properties;
  const tex = props?.find((p) => p?.name === "textures")?.value;
  if (typeof tex !== "string") return null;
  try {
    const url = JSON.parse(Buffer.from(tex, "base64").toString("utf8"))?.textures?.SKIN?.url;
    if (typeof url !== "string") return null;
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "textures.minecraft.net" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function createFaces(opts: FaceOptions) {
  const f = opts.fetch ?? fetch;
  const log = opts.log ?? ((l: string) => console.warn(l));
  const stats = { fetched: 0, failed: 0, mojang429: 0, last429At: null as number | null };
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

  async function get(url: string, accept: "json" | "bytes"): Promise<Response | null | "throttled"> {
    const res = await f(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: "error", headers: { accept: accept === "json" ? "application/json" : "image/png" } });
    if (res.status === 429) {
      const t = Date.now();
      stats.mojang429++;
      stats.last429At = t;
      if (t >= backoffUntil) log(`faces: Mojang rate-limited the skin lookup (429); serving cached or default heads for ${BACKOFF_MS / 1000} s`);
      backoffUntil = t + BACKOFF_MS;
      return "throttled";
    }
    return res.ok ? res : null;
  }

  /** A head, null (no skin or a failure: remembered as a miss), or "throttled" (Mojang said 429: not a miss). */
  async function fetchFace(id: string): Promise<Buffer | null | "throttled"> {
    try {
      const profileRes = await get(`https://sessionserver.mojang.com/session/minecraft/profile/${id}`, "json");
      if (!profileRes || profileRes === "throttled") return profileRes;
      const skin = skinUrlFromProfile(await profileRes.json());
      if (!skin) return null;
      const skinRes = await get(skin, "bytes");
      if (!skinRes || skinRes === "throttled") return skinRes;
      const bytes = new Uint8Array(await skinRes.arrayBuffer());
      if (bytes.length > MAX_SKIN_BYTES || !isPng(bytes)) return null;
      return await headFromSkin(bytes);
    } catch {
      return null;
    }
  }

  /** One fetch per player at a time; writes the head (or a miss marker) to disk. */
  function refresh(id: string, file: string): Promise<Buffer | null> {
    let p = inflight.get(id);
    if (!p) {
      p = slot(() => fetchFace(id))
        .then(async (png) => {
          if (png === "throttled") return null;
          if (png) {
            stats.fetched++;
            await writeAtomic(file, png);
          } else {
            stats.failed++;
            await writeAtomic(join(opts.dir, `${id}.miss`), "");
          }
          return png;
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

    const missAge = await ageOf(join(opts.dir, `${id}.miss`));
    const missFresh = missAge !== null && missAge < FACE_MISS_TTL_MS;
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
