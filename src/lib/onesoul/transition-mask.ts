// The frames of the realm transition (transition.ts), without the DOM: which 8px cells of the screen show the
// new realm in each of the 12 frames. Pure, so bun test covers it. The numbers and the dithered edge come
// from src/lib/design/dither.ts (REALM_TRANSITION, inCircle).
import { REALM_TRANSITION, REALM_TRANSITION_FRAMES, inCircle } from "#lib/design/dither.ts";

export type Point = { x: number; y: number };

/** The cell grid one transition draws on: the viewport in cells, plus slack cells to the right and below. */
export type MaskGrid = {
  cols: number;
  rows: number;
  /** one cell, in CSS pixels */
  cell: number;
  /** where the circle grows from, in CSS pixels from the top left of the viewport */
  origin: Point;
  /** the distance from the origin to the farthest corner of the viewport, in CSS pixels */
  far: number;
};

/**
 * The grid for a viewport of `width` × `height` CSS pixels. The slack covers what the snapshot holds beyond
 * the layout viewport (a phone's toolbars); cells there are lit by the last frame only, like the far corner.
 * The origin is clamped into the viewport.
 */
export function maskGrid(width: number, height: number, origin: Point, cell: number = REALM_TRANSITION.cell, slack = 16): MaskGrid {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const o = { x: Math.min(Math.max(origin.x, 0), w), y: Math.min(Math.max(origin.y, 0), h) };
  const far = Math.max(Math.hypot(o.x, o.y), Math.hypot(w - o.x, o.y), Math.hypot(o.x, h - o.y), Math.hypot(w - o.x, h - o.y), 1);
  return { cols: Math.ceil(w / cell) + slack, rows: Math.ceil(h / cell) + slack, cell, origin: o, far };
}

/** The progress frame `i` (0-based) shows. The first frame already shows the seed of the circle, the last
    one the whole new realm: the circle never waits a frame on an unchanged screen. */
export function frameProgress(i: number, frames: number = REALM_TRANSITION_FRAMES): number {
  return Math.min(1, Math.max(0, (i + 1) / frames));
}

/** The cells lit at progress `t`, row by row: 1 shows the new realm, 0 still the old one. */
export function litCells(grid: MaskGrid, t: number, band: number = REALM_TRANSITION.band): Uint8Array {
  const { cols, rows, cell, origin, far } = grid;
  const out = new Uint8Array(cols * rows);
  const half = cell / 2;
  for (let y = 0; y < rows; y++) {
    const dy = y * cell + half - origin.y;
    for (let x = 0; x < cols; x++) {
      const d = Math.hypot(x * cell + half - origin.x, dy) / far;
      if (inCircle(t, d, x, y, band)) out[y * cols + x] = 1;
    }
  }
  return out;
}

/** Every frame's lit cells, in order. */
export function maskFrames(grid: MaskGrid, frames: number = REALM_TRANSITION_FRAMES): Uint8Array[] {
  return Array.from({ length: frames }, (_, i) => litCells(grid, frameProgress(i, frames)));
}
