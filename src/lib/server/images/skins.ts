// Full-body skins (FDC-1): the same Mojang lookup, host check, disk cache and fallbacks as player faces, but
// the skin is drawn as a front view, 16x32 skin pixels scaled with nearest-neighbour to 128x256, transparent
// background, both layers, slim arms when the profile says so. The Discord cards use these as big images.
import sharp from "sharp";
import { createFaces, type FaceOptions } from "./faces.ts";

export const SKIN_W = 128;
export const SKIN_H = 256;

type Part = { x: number; y: number; w: number; h: number; mirror?: boolean };

/** Where a skin's part sits on the 16x32 front view, and which texture region (in 64x64 pixels) feeds it. */
function parts(slim: boolean, legacy: boolean): { dx: number; dy: number; base: Part; over?: Part }[] {
  const aw = slim ? 3 : 4;
  // the viewer's left is the character's right arm and leg; legacy 64x32 skins have no left limbs and mirror the right ones
  const lArm = legacy ? { x: 44, y: 20, w: aw, h: 12, mirror: true } : { x: 36, y: 52, w: aw, h: 12 };
  const lArmO = legacy ? undefined : { x: 52, y: 52, w: aw, h: 12 };
  const lLeg = legacy ? { x: 4, y: 20, w: 4, h: 12, mirror: true } : { x: 20, y: 52, w: 4, h: 12 };
  const lLegO = legacy ? undefined : { x: 4, y: 52, w: 4, h: 12 };
  return [
    { dx: 4, dy: 0, base: { x: 8, y: 8, w: 8, h: 8 }, over: { x: 40, y: 8, w: 8, h: 8 } },
    { dx: 4, dy: 8, base: { x: 20, y: 20, w: 8, h: 12 }, over: legacy ? undefined : { x: 20, y: 36, w: 8, h: 12 } },
    { dx: 4 - aw, dy: 8, base: { x: 44, y: 20, w: aw, h: 12 }, over: legacy ? undefined : { x: 44, y: 36, w: aw, h: 12 } },
    { dx: 12, dy: 8, base: lArm, over: lArmO },
    { dx: 4, dy: 20, base: { x: 4, y: 20, w: 4, h: 12 }, over: legacy ? undefined : { x: 4, y: 36, w: 4, h: 12 } },
    { dx: 8, dy: 20, base: lLeg, over: lLegO }
  ];
}

/** Draw a skin (64x64, legacy 64x32, or an HD multiple of 64) as a 128x256 front view with a transparent background. */
export async function bodyFromSkin(skin: Uint8Array, info: { slim: boolean }): Promise<Buffer> {
  const { width, height } = await sharp(skin).metadata();
  if (!width || !height || width % 64 !== 0 || (height !== width && height * 2 !== width)) throw new Error("not a skin");
  const s = width / 64;
  const legacy = height !== width;
  const cut = async (p: Part) => {
    let img = sharp(skin).extract({ left: p.x * s, top: p.y * s, width: p.w * s, height: p.h * s }).ensureAlpha();
    if (p.mirror) img = img.flop();
    return img.png().toBuffer();
  };
  const layers: sharp.OverlayOptions[] = [];
  const list = parts(info.slim, legacy);
  // every base layer first, then every overlay, so a sleeve is never hidden by the body next to it
  for (const p of list) layers.push({ input: await cut(p.base), left: p.dx * s, top: p.dy * s });
  for (const p of list) if (p.over) layers.push({ input: await cut(p.over), left: p.dx * s, top: p.dy * s });
  const canvas = await sharp({ create: { width: 16 * s, height: 32 * s, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers)
    .png()
    .toBuffer();
  return sharp(canvas).resize(SKIN_W, SKIN_H, { kernel: "nearest" }).png().toBuffer();
}

/** Floodgate (Bedrock) UUIDs start with 16 zero hex digits; their skins are not on Mojang. */
export function isFloodgateUuid(id: string): boolean {
  return id.replace(/-/g, "").startsWith("0000000000000000");
}

/** Vanilla's choice for a player without a skin of their own: the UUID's hash decides, odd is Alex. */
export function defaultSkinFor(uuid: string): "steve" | "alex" {
  const h = BigInt("0x" + uuid.replace(/-/g, ""));
  const hilo = (h >> 64n) ^ (h & 0xffffffffffffffffn);
  const hash = Number(((hilo >> 32n) ^ hilo) & 0xffffffffn);
  return hash & 1 ? "alex" : "steve";
}

export type SkinResult = { kind: "skin"; png: Buffer; stale: boolean } | { kind: "default"; model: "steve" | "alex" };

export function createSkins(opts: Omit<FaceOptions, "render" | "label">) {
  const inner = createFaces({ ...opts, render: bodyFromSkin, label: "skins" });
  async function skin(uuid: string): Promise<SkinResult> {
    const model = defaultSkinFor(uuid);
    if (isFloodgateUuid(uuid)) return { kind: "default", model };
    const r = await inner.face(uuid);
    return r.kind === "face" ? { kind: "skin", png: r.png, stale: r.stale } : { kind: "default", model };
  }
  return { skin, stats: inner.stats };
}

// Same timings as faces: a day fresh, a week stale-while-revalidate, an old render an hour, a fallback five minutes.
const FRESH = "public, max-age=86400, stale-while-revalidate=604800";
const SHORT = "public, max-age=3600";
const FALLBACK = "public, max-age=300";

/** The route's answer: the render, or a short-lived redirect to the default Steve or Alex (hidden player, any failure). */
export async function skinResponse(uuid: string, deps: { hidden: (uuid: string) => boolean; skin: (uuid: string) => Promise<SkinResult> }): Promise<Response> {
  const toDefault = (model: "steve" | "alex") => new Response(null, { status: 302, headers: { location: `/img/skin-default-${model}.png`, "cache-control": FALLBACK } });
  if (deps.hidden(uuid)) return toDefault(defaultSkinFor(uuid));
  const r = await deps.skin(uuid);
  if (r.kind === "default") return toDefault(r.model);
  return new Response(r.png as BodyInit, { headers: { "content-type": "image/png", "cache-control": r.stale ? SHORT : FRESH } });
}
