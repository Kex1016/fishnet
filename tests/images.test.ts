import { expect, test } from "bun:test";
import sharp from "sharp";
import { existsSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFaces, FACE_ERROR_TTL_MS, FACE_MISS_TTL_MS, headFromSkin, isOfflineUuid, missTtl, skinUrlFromProfile } from "../src/lib/server/images/faces.ts";
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

test("skin url must be on textures.minecraft.net, and is fetched over https", () => {
  expect(skinUrlFromProfile(tex("https://textures.minecraft.net/texture/abc"))).toBe("https://textures.minecraft.net/texture/abc");
  // what Mojang's session server actually answers: http, upgraded
  expect(skinUrlFromProfile(tex("http://textures.minecraft.net/texture/abc"))).toBe("https://textures.minecraft.net/texture/abc");
  expect(skinUrlFromProfile(tex("ftp://textures.minecraft.net/texture/abc"))).toBeNull();
  expect(skinUrlFromProfile(tex("http://textures.minecraft.net:8080/texture/abc"))).toBeNull();
  expect(skinUrlFromProfile(tex("http://textures.minecraft.net.evil.example/texture/abc"))).toBeNull();
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

test("faces: an old head is served at once and refreshed behind it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "faces-"));
  const png = await skin();
  let calls = 0;
  const fake = (async (url: string) => {
    calls++;
    return url.includes("sessionserver") ? Response.json(tex("https://textures.minecraft.net/texture/abc")) : new Response(png as unknown as BodyInit);
  }) as unknown as typeof fetch;
  const faces = createFaces({ dir, fetch: fake });
  await faces.face(UUID);
  expect(calls).toBe(2);
  const file = join(dir, "069a79f444e94726a5befca90e38aaf5.png");
  const old = new Date(Date.now() - 4 * 86_400_000);
  utimesSync(file, old, old);
  const r = await faces.face(UUID);
  expect(r.kind === "face" && r.stale).toBe(true);
  await Bun.sleep(50);
  expect(calls).toBe(4);
  const again = await faces.face(UUID);
  expect(again.kind === "face" && again.stale).toBe(false);
  expect(faces.stats().fetched).toBe(2);
});

test("faces: Mojang's 429 is counted, logged once, and not remembered as a miss", async () => {
  const dir = mkdtempSync(join(tmpdir(), "faces-"));
  const logs: string[] = [];
  const faces = createFaces({ dir, fetch: (async () => new Response("", { status: 429 })) as unknown as typeof fetch, log: (l) => logs.push(l) });
  expect((await faces.face(UUID)).kind).toBe("default");
  expect((await faces.face(UUID)).kind).toBe("default"); // backing off: not asked again
  const s = faces.stats();
  expect(s.mojang429).toBe(1);
  expect(s.backoffUntil).not.toBeNull();
  expect(logs.length).toBe(1);
  expect(existsSync(join(dir, "069a79f444e94726a5befca90e38aaf5.miss"))).toBe(false);
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

test("faces: Mojang's real http skin url gives a face", async () => {
  const dir = mkdtempSync(join(tmpdir(), "faces-"));
  const png = await skin();
  const seen: string[] = [];
  const fake = (async (url: string) => {
    seen.push(url);
    return url.includes("sessionserver") ? Response.json(tex("http://textures.minecraft.net/texture/abc")) : new Response(png as unknown as BodyInit);
  }) as unknown as typeof fetch;
  const faces = createFaces({ dir, fetch: fake });
  expect((await faces.face(UUID)).kind).toBe("face");
  expect(seen[1]).toBe("https://textures.minecraft.net/texture/abc");
});

test("faces: a failed lookup is remembered minutes, a player without a skin an hour", async () => {
  const dir = mkdtempSync(join(tmpdir(), "faces-"));
  const logs: string[] = [];
  let mode: "down" | "noskin" = "down";
  let calls = 0;
  const fake = (async () => {
    calls++;
    if (mode === "down") return new Response("", { status: 503 });
    return Response.json({ properties: [{ name: "textures", value: Buffer.from(JSON.stringify({ textures: {} })).toString("base64") }] });
  }) as unknown as typeof fetch;
  const faces = createFaces({ dir, fetch: fake, log: (l) => logs.push(l) });
  const miss = join(dir, "069a79f444e94726a5befca90e38aaf5.miss");
  const age = (ms: number) => { const t = new Date(Date.now() - ms); utimesSync(miss, t, t); };

  expect((await faces.face(UUID)).kind).toBe("default");
  expect(faces.stats().reasons.error).toBe(1);
  expect(faces.stats().lastError).toBe("profile: HTTP 503");
  expect(logs.length).toBe(1);
  age(FACE_ERROR_TTL_MS - 10_000);
  await faces.face(UUID);
  expect(calls).toBe(1); // still remembered
  age(FACE_ERROR_TTL_MS + 1_000);
  await faces.face(UUID);
  expect(calls).toBe(2); // asked again after minutes, not days
  expect(logs.length).toBe(1); // same failure, logged once

  mode = "noskin";
  age(FACE_ERROR_TTL_MS + 1_000);
  expect((await faces.face(UUID)).kind).toBe("default");
  expect(faces.stats().reasons.noSkin).toBe(1);
  age(FACE_ERROR_TTL_MS + 1_000);
  await faces.face(UUID);
  expect(calls).toBe(3); // a skinless player is not asked every few minutes
});

test("faces: an empty miss marker from an older build expires like an error", async () => {
  const dir = mkdtempSync(join(tmpdir(), "faces-"));
  const png = await skin();
  writeFileSync(join(dir, "069a79f444e94726a5befca90e38aaf5.miss"), "");
  const t = new Date(Date.now() - FACE_ERROR_TTL_MS - 1_000);
  utimesSync(join(dir, "069a79f444e94726a5befca90e38aaf5.miss"), t, t);
  const fake = (async (url: string) => (url.includes("sessionserver") ? Response.json(tex("http://textures.minecraft.net/texture/abc")) : new Response(png as unknown as BodyInit))) as unknown as typeof fetch;
  const faces = createFaces({ dir, fetch: fake });
  expect((await faces.face(UUID)).kind).toBe("face");
  expect(existsSync(join(dir, "069a79f444e94726a5befca90e38aaf5.miss"))).toBe(false);
});

test("faces: offline-mode UUIDs and unknown accounts", async () => {
  let calls = 0;
  const fake = (async () => { calls++; return new Response(null, { status: 204 }); }) as unknown as typeof fetch;
  const faces = createFaces({ dir: mkdtempSync(join(tmpdir(), "faces-")), fetch: fake });
  expect(isOfflineUuid("069a79f444e94726a5befca90e38aaf5")).toBe(false);
  expect(isOfflineUuid("5f2a3b1c9d8e3f00a1b2c3d4e5f60718")).toBe(true);
  expect((await faces.face("5f2a3b1c-9d8e-3f00-a1b2-c3d4e5f60718")).kind).toBe("default");
  expect(calls).toBe(0);
  expect(faces.stats().reasons.offlineUuid).toBe(1);
  expect((await faces.face(UUID)).kind).toBe("default");
  expect(faces.stats().reasons.noProfile).toBe(1);
  expect(missTtl("noProfile")).toBe(FACE_MISS_TTL_MS);
});
