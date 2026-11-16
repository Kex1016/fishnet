// An area's title in the Minecraft font (brief §5.3), drawn into a <canvas> that is aria-hidden (the title is in
// the area's accessible name and in the Places list). The glyphs come from the journal's bundled sheets through
// #lib/onesoul/book/layout.ts (Unifont for what the sheets lack, control characters dropped), so the title is
// only ever glyphs: no HTML, no formatting codes, `§` and `<b>` are drawn as the characters they are.
//
// Drawing: the glyphs go into an offscreen mask at the final scale (s = k · dpr device pixels per font pixel,
// smoothing off), the mask is tinted with `source-in`, a black copy of it is drawn one font pixel right and one
// down (Minecraft's shadow offset, solid #000000 as David asked), the tinted text on top. Drawing each glyph at
// `s` directly is the same picture as drawing at 1x and scaling the result by `s` without smoothing, and it keeps
// Unifont's 16 px cells (drawn at half size) as sharp as the scale allows. Every pixel is either clear, the tint
// or black: there are no intermediate alpha edges at any scale.
import { SHEETS, layoutPage, type Glyph, type Line, type Uni } from "#lib/onesoul/book/layout.ts";
import type { LabelFit } from "./types.ts";

/** Font pixels per line: 8 rows of glyph and the shadow's row (brief §5.2). */
export const LINE = 9;
/** Screen pixels per font pixel the fit rule picks from (brief §5.2). */
export const SCALES = [4, 3, 2, 1] as const;
export type Scale = 1 | 2 | 3 | 4;

/** One glyph image to draw, in font pixels from the box's top-left (y can be negative: accents above row 0). */
export type Draw =
  | { kind: "sheet"; src: string; sx: number; sy: number; sw: number; sh: number; x: number; y: number; w: number; h: number }
  | { kind: "box"; x: number; y: number; w: number; h: number }; // a character no font here has: the game's empty box

export type LabelBox = {
  /** the fit rule's box in font pixels (brief §5.2): widest line (rounded up) + 1 by 9 per line */
  w: number;
  h: number;
  /** rows of ink above the box (accented capitals) and below it (a low accent's shadow); the canvas includes them */
  over: number;
  under: number;
};

/** The lines of a title: one line unless `wrap` (font pixels) is given, then `layoutPage`'s soft wrap. Line breaks
 * inside a title are spaces (an in-area title is one line, §5.2; the two-line form is the fit rule's own wrap). */
export function labelLines(title: string, wrap?: number, uni?: Uni): Line[] {
  const flat = title.replace(/\r\n?|\n/g, " ");
  return layoutPage(flat, wrap ?? Number.POSITIVE_INFINITY, uni);
}

/** The lines as plain strings (what `LabelFit.lines` holds). */
export function lineTexts(lines: readonly Line[]): string[] {
  return lines.map((l) => l.glyphs.map((g) => g.ch).join(""));
}

/** A fit's lines (FMK-2's `LabelFit`, one string per line) laid out for drawing, each kept on its own line. */
export function fitLines(fit: Pick<LabelFit, "lines">, uni?: Uni): Line[] {
  return fit.lines.map((s) => labelLines(s, undefined, uni)[0]);
}

/** Where each glyph of `lines` is drawn, each line centred in the widest one. */
export function planLabel(lines: readonly Line[]): Draw[] {
  const widest = Math.ceil(Math.max(0, ...lines.map((l) => l.width)));
  const out: Draw[] = [];
  lines.forEach((l, li) => {
    let x = Math.floor((widest - l.width) / 2);
    const y = li * LINE;
    for (const g of l.glyphs) {
      const d = draw(g, x, y);
      if (d) out.push(d);
      x += g.adv;
    }
  });
  return out;
}

function draw(g: Glyph, x: number, y: number): Draw | null {
  if (g.g) {
    const s = SHEETS[g.g.sheet];
    return { kind: "sheet", src: s.file, sx: g.g.sx, sy: g.g.sy, sw: s.cw, sh: s.ch, x, y: y + g.g.top, w: s.cw, h: s.ch };
  }
  if (g.u) return { kind: "sheet", src: `/mc/unifont/${g.u.page}.png`, sx: g.u.sx, sy: g.u.sy, sw: g.u.w, sh: 16, x, y, w: g.u.w / 2, h: 8 };
  if (g.ch === " " || g.adv <= 1) return null; // a space the game defines
  return { kind: "box", x, y, w: g.adv - 1, h: 8 };
}

/** The fit rule's measure (brief §5.2): the box of `lines` in font pixels, and the ink outside it. */
export function measureLabel(lines: readonly Line[]): LabelBox {
  const w = Math.ceil(Math.max(0, ...lines.map((l) => l.width))) + 1; // Unifont advances can be half pixels
  const h = LINE * Math.max(1, lines.length);
  let top = 0;
  let bottom = h;
  for (const d of planLabel(lines)) {
    top = Math.min(top, d.y);
    bottom = Math.max(bottom, d.y + d.h + 1); // + the shadow row
  }
  return { w, h, over: -top, under: bottom - h };
}

/** Shortcut for the fit rule: the box of `title` on one line, or wrapped at `wrap` font pixels. */
export function measureTitle(title: string, wrap?: number, uni?: Uni): LabelBox & { lines: number } {
  const lines = labelLines(title, wrap, uni);
  return { ...measureLabel(lines), lines: lines.length };
}

/** Device pixels per CSS pixel the label is drawn at: a whole number, so a font pixel is a whole block of them. */
export function backingRatio(dpr: number): number {
  return Math.max(1, Math.round(Number.isFinite(dpr) ? dpr : 1));
}

/** The canvas's size and where the centre of the fit box sits on it, in CSS pixels. */
export function labelGeometry(box: LabelBox, k: Scale): { width: number; height: number; anchor: [x: number, y: number] } {
  return { width: box.w * k, height: (box.over + box.h + box.under) * k, anchor: [(box.w * k) / 2, (box.over + box.h / 2) * k] };
}

// ---- browser only below: images and canvas ----

const images = new Map<string, Promise<HTMLImageElement>>();

function image(src: string): Promise<HTMLImageElement> {
  let p = images.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => {
        images.delete(src); // a later label may try again
        reject(new Error(`font sheet did not load: ${src}`));
      };
      img.src = src;
    });
    images.set(src, p);
  }
  return p;
}

/** Loads every sheet the plan uses (cached across labels). A sheet that fails leaves its glyphs out. */
export async function loadSheets(plan: readonly Draw[]): Promise<Map<string, HTMLImageElement>> {
  const srcs = [...new Set(plan.flatMap((d) => (d.kind === "sheet" ? [d.src] : [])))];
  const got = await Promise.allSettled(srcs.map(image));
  const out = new Map<string, HTMLImageElement>();
  got.forEach((r, i) => r.status === "fulfilled" && out.set(srcs[i], r.value));
  return out;
}

export type LabelOptions = { k: Scale; dpr?: number; color: string };

/** Draws `lines` into `canvas` with loaded sheets (synchronous; see renderLabel). Sizes the canvas, marks it
 * aria-hidden and returns its CSS geometry. */
export function drawLabel(canvas: HTMLCanvasElement, lines: readonly Line[], o: LabelOptions, sheets: Map<string, HTMLImageElement>) {
  const box = measureLabel(lines);
  const geo = labelGeometry(box, o.k);
  const s = o.k * backingRatio(o.dpr ?? 1);
  const W = box.w * s;
  const H = (box.over + box.h + box.under) * s;
  canvas.setAttribute("aria-hidden", "true");
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${geo.width}px`;
  canvas.style.height = `${geo.height}px`;
  canvas.style.imageRendering = "pixelated";

  const mask = document.createElement("canvas");
  mask.width = W;
  mask.height = H;
  const m = mask.getContext("2d")!;
  m.imageSmoothingEnabled = false;
  for (const d of planLabel(lines)) {
    const x = d.x * s;
    const y = (d.y + box.over) * s;
    if (d.kind === "box") {
      // the game's missing-glyph box: a one font pixel outline
      m.fillStyle = "#000";
      m.fillRect(x, y, d.w * s, s);
      m.fillRect(x, y + (d.h - 1) * s, d.w * s, s);
      m.fillRect(x, y, s, d.h * s);
      m.fillRect(x + (d.w - 1) * s, y, s, d.h * s);
      continue;
    }
    const img = sheets.get(d.src);
    if (!img) continue;
    // whole device pixels on both edges, so a Unifont half-size glyph never lands between pixels
    const x0 = Math.round(x);
    const x1 = Math.round(x + d.w * s);
    m.drawImage(img, d.sx, d.sy, d.sw, d.sh, x0, Math.round(y), x1 - x0, Math.round(d.h * s));
  }
  // the sheets are opaque black on clear; tint and shadow keep that alpha and replace the colour
  const shadow = document.createElement("canvas");
  shadow.width = W;
  shadow.height = H;
  const sh = shadow.getContext("2d")!;
  sh.drawImage(mask, 0, 0);
  sh.globalCompositeOperation = "source-in";
  sh.fillStyle = "#000000";
  sh.fillRect(0, 0, W, H);
  m.globalCompositeOperation = "source-in";
  m.fillStyle = o.color;
  m.fillRect(0, 0, W, H);

  const c = canvas.getContext("2d")!;
  c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, W, H);
  c.drawImage(shadow, s, s);
  c.drawImage(mask, 0, 0);
  return { ...geo, box, scale: s };
}

/** Loads the sheets and draws. Resolves with the canvas's CSS geometry. */
export async function renderLabel(canvas: HTMLCanvasElement, lines: readonly Line[], o: LabelOptions) {
  const sheets = await loadSheets(planLabel(lines));
  return drawLabel(canvas, lines, o, sheets);
}


/** Draws a fit (FMK-2's `LabelFit`) in the area's title colour (labelColor.ts `labelTint(area).color`). */
export function renderFit(canvas: HTMLCanvasElement, fit: LabelFit, color: string, o: { dpr?: number; uni?: Uni } = {}) {
  return renderLabel(canvas, fitLines(fit, o.uni), { k: fit.k, dpr: o.dpr, color });
}
