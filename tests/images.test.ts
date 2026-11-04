import { expect, test } from "bun:test";
import sharp from "sharp";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFaces, headFromSkin, skinUrlFromProfile } from "../src/lib/server/images/faces.ts";
import { createIcons } from "../src/lib/server/images/icons.ts";

async function skin(size = 64, h = size): Promise<Buffer> {
  const s = size / 64;
  const base = { create: { width: size, height: h, channels: 4 as const, background: { r: 0, g: 0, b: 0, alpha: 0 } } };
  const head = await sharp({ create: { width: 8 * s, height: 8 * s, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
  const hat = await sharp({ create: { width: 2 * s, height: 2 * s, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } } }).png().toBuffer();
  return sharp(base).composite([{ input: head, left: 8 * s, top: 8 * s }, { input: hat, left: 40 * s, top: 8 * s }]).png().toBuffer();
}

const tex = (url: string) => ({ properties: [{ name: "textures", value: Buffer.from(JSON.stringify({ textures: { SKIN: { url } } })).toString("base64") }] });

test("head crop: 64x64 out, hat over head, legacy and HD skins", async () => {
  for (const [w, h] of [[64, 64], [64, 32], [128, 128]]) {
    const png = await headFromSkin(await skin(w, h));
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([64, 64]);
    expect([...data.subarray(0, 4)]).toEqual([0, 255, 0, 255]); // hat pixel at top-left wins
    const mid = (32 * 64 + 32) * 4;
    expect([...data.subarray(mid, mid + 4)]).toEqual([255, 0, 0, 255]);
  }
  await expect(headFromSkin(await sharp({ create: { width: 10, height: 10, channels: 4, background: "red" } }).png().toBuffer())).rejects.toThrow();
});

test("skin url must be https on textures.minecraft.net", () => {
  expect(skinUrlFromProfile(tex("https://textures.minecraft.net/texture/abc"))).toBe("https://textures.minecraft.net/texture/abc");
  expect(skinUrlFromProfile(tex("http://textures.minecraft.net/texture/abc"))).toBeNull();
  expect(skinUrlFromProfile(tex("https://evil.example/texture/abc"))).toBeNull();
  expect(skinUrlFromProfile({})).toBeNull();
  expect(skinUrlFromProfile(null)).toBeNull();
});

const UUID = "069a79f4-44e9-4726-a5be-fca90e38aaf5";

test("faces: fetched once, cached on disk, failures fall back, stale beats default", async () => {
  const dir = mkdtempSync(join(tmpdir(), "faces-"));
  let calls = 0;
  let up = true;
  const png = await skin();
  const fake = (async (url: string) => {
    calls++;
    if (!up) throw new Error("offline");
    if (url.includes("sessionserver")) {
      expect(url).toContain("069a79f444e94726a5befca90e38aaf5");
      return Response.json(tex("https://textures.minecraft.net/texture/abc"));
    }
    return new Response(png as unknown as BodyInit);
  }) as unknown as typeof fetch;
  const faces = createFaces({ dir, fetch: fake });
  const [a, b] = await Promise.all([faces.face(UUID), faces.face(UUID)]);
  expect(a.kind).toBe("face");
  expect(b.kind).toBe("face");
  expect(calls).toBe(2); // profile + skin, single-flight
  await faces.face(UUID);
  expect(calls).toBe(2); // disk hit

  up = false;
  const other = "11111111-1111-1111-1111-111111111111";
  expect((await faces.face(other)).kind).toBe("default");
  const before = calls;
  expect((await faces.face(other)).kind).toBe("default");
  expect(calls).toBe(before); // negative cache
});

test("faces: offline mode never fetches", async () => {
  let calls = 0;
  const faces = createFaces({ dir: mkdtempSync(join(tmpdir(), "faces-")), offline: true, fetch: (async () => { calls++; return new Response(); }) as unknown as typeof fetch });
  expect((await faces.face(UUID)).kind).toBe("default");
  expect(calls).toBe(0);
});

test("icons: disk cache after first fetch, missing vs unavailable", async () => {
  const dir = mkdtempSync(join(tmpdir(), "icons-"));
  const good = new Uint8Array(await sharp({ create: { width: 2, height: 2, channels: 4, background: "red" } }).png().toBuffer());
  let calls = 0;
  const sha = "a".repeat(64);
  const icons = createIcons({
    dir,
    source: async (s) => {
      calls++;
      return s === sha ? { ok: true, png: good } : s === "b".repeat(64) ? { ok: false, kind: "not_found" } : { ok: false, kind: "down" };
    }
  });
  expect((await icons.icon(sha)).kind).toBe("png");
  expect((await icons.icon(sha)).kind).toBe("png");
  expect(calls).toBe(1);
  expect((await icons.icon("b".repeat(64))).kind).toBe("missing");
  expect((await icons.icon("c".repeat(64))).kind).toBe("unavailable");
});
