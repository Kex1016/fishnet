// The picture peek (Peek.svelte): a small picture on the page (a player's head, an item or advancement icon)
// shown large while the pointer is on it or keyboard focus is on its link. It opens like the realm transition,
// a dithered circle that steps at 12 fps, only shorter and from the corner nearest the small picture. Pure.
import { REALM_TRANSITION, inCircle } from "./dither.ts";

export const PEEK = {
  /** frames a second, the realm transition's */
  fps: REALM_TRANSITION.fps,
  /** frames from nothing to the whole box: half a second */
  frames: 6,
  /** one dither cell, in CSS pixels */
  cell: 8,
  /** the dithered edge, as a share of the full radius */
  band: 0.35,
  /** the largest drawn size a picture may have and still get a peek, in CSS pixels */
  maxSource: 48,
  /** the gap between the small picture and the peek */
  gap: 12
} as const;

export type Corner = "tl" | "tr" | "bl" | "br";

/** The lit cells of every frame, row by row, for a box of `cols` x `rows` cells opening from `corner`. The
    last frame is the whole box. */
export function peekFrames(cols: number, rows: number, corner: Corner, frames: number = PEEK.frames): boolean[][] {
  const ox = corner === "tl" || corner === "bl" ? 0 : cols - 1;
  const oy = corner === "tl" || corner === "tr" ? 0 : rows - 1;
  const far = Math.hypot(cols - 1, rows - 1) || 1;
  const out: boolean[][] = [];
  for (let f = 1; f <= frames; f++) {
    const t = f / frames;
    const lit: boolean[] = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) lit.push(inCircle(t, Math.hypot(x - ox, y - oy) / far, x, y, PEEK.band));
    out.push(lit);
  }
  return out;
}

export type Rect = { left: number; top: number; width: number; height: number };

/** Where the peek goes: beside the small picture (right, else left), its top level with it, kept inside the
    viewport; and the corner it opens from, the one nearest the small picture. */
export function placePeek(src: Rect, w: number, h: number, vw: number, vh: number, gap: number = PEEK.gap): { left: number; top: number; corner: Corner } {
  const right = src.left + src.width + gap;
  const onRight = right + w <= vw - 8 || src.left - gap - w < 8;
  const left = Math.max(8, Math.min(onRight ? right : src.left - gap - w, vw - w - 8));
  const top = Math.max(8, Math.min(src.top + src.height / 2 - h / 2, vh - h - 8));
  const below = src.top + src.height / 2 > top + h / 2;
  const corner: Corner = `${below ? "b" : "t"}${onRight ? "l" : "r"}` as Corner;
  return { left, top, corner };
}

/** The face route's picture of a player → the full-body skin route's; anything else → null. */
export function skinFor(src: string): string | null {
  const m = /^\/img\/face\/([0-9a-f-]{32,36})\.png$/i.exec(src);
  return m ? `/img/skin/${m[1]}.png` : null;
}
