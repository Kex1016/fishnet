// The dither haiiro draws with: the 4x4 Bayer matrix, and the numbers of the realm transition. Pure, shared
// by the blob backdrop (blobs.ts) and the realm transition (src/lib/onesoul/transition.ts).

/** The 4x4 Bayer matrix, row by row, as thresholds in (0, 1): a cell is lit when its value is above. */
export const BAYER4: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** The threshold of the cell at column `x`, row `y`. */
export function bayer(x: number, y: number): number {
  return BAYER4[(y & 3) * 4 + (x & 3)];
}

/** The realm transition (David, 23 Nov 2026): a dithered circle, 12 frames a second, about one second.
    The same numbers as the --realm-transition-* tokens in tokens.css. */
export const REALM_TRANSITION = {
  /** frames a second: the circle steps, it never glides */
  fps: 12,
  durationMs: 1000,
  /** the size of one dither cell, in CSS pixels */
  cell: 8,
  /** the width of the dithered edge, as a share of the full radius */
  band: 0.22
} as const;

/** How many frames the transition has. */
export const REALM_TRANSITION_FRAMES = Math.round((REALM_TRANSITION.fps * REALM_TRANSITION.durationMs) / 1000);

/**
 * Is the cell at (`x`, `y`) inside the dithered circle? `t` is the progress in 0..1, `d` the cell's distance
 * from the centre as a share of the full radius (0 at the centre, 1 at the farthest corner). Nothing is
 * lit at t = 0 and every cell is at t = 1; in between the edge is `band` wide and dithered.
 */
export function inCircle(t: number, d: number, x: number, y: number, band: number = REALM_TRANSITION.band): boolean {
  if (t <= 0) return false;
  if (t >= 1) return true;
  return (t * (1 + band) - d) / band > bayer(x, y);
}

/** "#191724" → [25, 23, 36]; anything else → the fallback. */
export function hexTone(value: string, fallback: readonly [number, number, number]): readonly [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
