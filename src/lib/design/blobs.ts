// The haiiro blob backdrop (after haiiro.moe/~cakes): metaballs on a grid of 6px cells, dithered with the
// 4x4 Bayer matrix into three tones (base, overlay, highlight-med). Merging blobs keep their area. 30 frames
// a second at most, one still frame under reduced motion, paused while the tab is hidden. The tones are read
// from the tokens, so the One Soul realm gets its own.
import { BAYER4, hexTone } from "./dither.ts";

/** The size of one cell in CSS pixels. */
export const BLOB_CELL = 6;
const FPS = 30;
const MAX_RADIUS = 24;

type Blob = { x: number; y: number; r: number; vx: number; vy: number };
type Tone = readonly [number, number, number];

/** How many blobs a grid of `w` × `h` cells carries. */
export function blobTarget(w: number, h: number): number {
  return Math.max(6, Math.min(60, Math.round((w * h) / 700)));
}

/** Which tone a cell gets: 0 base, 1 halo (overlay), 2 core (highlight-med). `f` is the field, `t` the cell's threshold. */
export function blobTone(f: number, t: number): 0 | 1 | 2 {
  return (f - 0.9) / 0.5 > t ? 2 : (f - 0.3) / 0.75 > t ? 1 : 0;
}

/**
 * Starts the backdrop on a canvas; returns the function that stops it. The canvas takes its size from its
 * parent (CSS stretches it; `image-rendering: pixelated` keeps the cells square-edged).
 */
export function startBlobs(cv: HTMLCanvasElement): () => void {
  const box = cv.parentElement ?? cv;
  const ctx = cv.getContext("2d");
  if (!ctx) return () => undefined;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const radius = () => 2 + Math.pow(Math.random(), 2) * 7;

  let W = 0;
  let H = 0;
  let img: ImageData | null = null;
  let field = new Float32Array(0);
  let tones: [Tone, Tone, Tone] = [[0x19, 0x17, 0x24], [0x26, 0x23, 0x3a], [0x40, 0x3d, 0x52]];
  let blobs: Blob[] = [];
  let target = 6;
  let raf = 0;

  const add = (x: number, y: number, r: number, ang: number) => {
    const s = rnd(1.5, 6);
    blobs.push({ x, y, r, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s });
  };
  const spawn = () => {
    const r = radius();
    const side = Math.floor(Math.random() * 4);
    const m = 3 * r;
    const x = side === 0 ? -m : side === 1 ? W + m : rnd(0, W);
    const y = side === 2 ? -m : side === 3 ? H + m : rnd(0, H);
    add(x, y, r, Math.atan2(H / 2 - y, W / 2 - x) + rnd(-0.6, 0.6));
  };
  const step = (dt: number) => {
    for (const b of blobs) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    for (let i = 0; i < blobs.length; i++) {
      for (let j = i + 1; j < blobs.length; j++) {
        const a = blobs[i];
        const c = blobs[j];
        const d = Math.hypot(a.x - c.x, a.y - c.y);
        const nr = Math.sqrt(a.r * a.r + c.r * c.r);
        if (d <= Math.max(a.r, c.r) && nr <= MAX_RADIUS) {
          const wa = a.r * a.r;
          const wc = c.r * c.r;
          const w = wa + wc;
          a.x = (a.x * wa + c.x * wc) / w;
          a.y = (a.y * wa + c.y * wc) / w;
          a.vx = (a.vx * wa + c.vx * wc) / w;
          a.vy = (a.vy * wa + c.vy * wc) / w;
          let s = Math.hypot(a.vx, a.vy);
          if (s < 1e-3) {
            const ang = rnd(0, Math.PI * 2);
            a.vx = Math.cos(ang);
            a.vy = Math.sin(ang);
            s = 1;
          }
          if (s < 1.5) {
            a.vx *= 1.5 / s;
            a.vy *= 1.5 / s;
          }
          a.r = nr;
          blobs.splice(j, 1);
          j--;
        }
      }
    }
    for (let i = blobs.length - 1; i >= 0; i--) {
      const b = blobs[i];
      const m = 3 * b.r + 2;
      if ((b.x < -m && b.vx <= 0) || (b.x > W + m && b.vx >= 0) || (b.y < -m && b.vy <= 0) || (b.y > H + m && b.vy >= 0)) blobs.splice(i, 1);
    }
    while (blobs.length < target * 0.85) spawn();
  };
  const draw = () => {
    if (!img) return;
    const px = img.data;
    field.fill(0);
    for (const b of blobs) {
      const R = 3 * b.r;
      const r2 = b.r * b.r;
      const x0 = Math.max(0, Math.floor(b.x - R));
      const x1 = Math.min(W - 1, Math.ceil(b.x + R));
      const y0 = Math.max(0, Math.floor(b.y - R));
      const y1 = Math.min(H - 1, Math.ceil(b.y + R));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - b.x;
          const dy = y + 0.5 - b.y;
          field[y * W + x] += r2 / (dx * dx + dy * dy + 0.01);
        }
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const col = tones[blobTone(field[y * W + x], BAYER4[(y & 3) * 4 + (x & 3)])];
        const o = (y * W + x) * 4;
        px[o] = col[0];
        px[o + 1] = col[1];
        px[o + 2] = col[2];
        px[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  };
  const readTones = () => {
    const cs = getComputedStyle(cv);
    tones = [
      hexTone(cs.getPropertyValue("--color-base"), tones[0]),
      hexTone(cs.getPropertyValue("--color-overlay"), tones[1]),
      hexTone(cs.getPropertyValue("--color-highlight-med"), tones[2])
    ];
  };

  let last = 0;
  let acc = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (document.hidden) return;
    acc += dt;
    if (acc < 1 / FPS) return;
    step(acc);
    acc = 0;
    draw();
  };
  const run = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    draw();
    if (reduced.matches) return; // one still frame
    last = performance.now();
    acc = 0;
    raf = requestAnimationFrame(frame);
  };
  const fit = () => {
    const w = Math.max(8, Math.ceil(box.clientWidth / BLOB_CELL));
    const h = Math.max(8, Math.ceil(box.clientHeight / BLOB_CELL));
    if (w === W && h === H) return;
    // keep the blobs where they are on a resize (a phone's address bar hides and shows all the time)
    const first = W === 0;
    W = cv.width = w;
    H = cv.height = h;
    img = ctx.createImageData(W, H);
    field = new Float32Array(W * H);
    target = blobTarget(W, H);
    if (first) {
      blobs = [];
      for (let i = 0; i < target; i++) add(rnd(0, W), rnd(0, H), radius(), rnd(0, Math.PI * 2));
      for (let i = 0; i < 60; i++) step(0.1);
    }
    run();
  };

  readTones();
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(box);
  // the realm changes the tones: read them again when <html data-realm> or a .realm class changes
  const mo = new MutationObserver(() => {
    readTones();
    if (!raf) draw();
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-realm", "class"] });
  reduced.addEventListener("change", run);

  return () => {
    cancelAnimationFrame(raf);
    raf = 0;
    ro.disconnect();
    mo.disconnect();
    reduced.removeEventListener("change", run);
  };
}
