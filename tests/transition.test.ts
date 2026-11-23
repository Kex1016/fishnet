import { describe, expect, test } from "bun:test";
import { REALM_TRANSITION, REALM_TRANSITION_FRAMES } from "../src/lib/design/dither.ts";
import { SHEET_COLUMNS, frameProgress, litCells, maskFrames, maskGrid, sheetCell } from "../src/lib/onesoul/transition-mask.ts";

const count = (a: Uint8Array) => a.reduce((n, v) => n + v, 0);

describe("realm transition frames", () => {
  test("the grid is the viewport in 8px cells plus slack, the origin clamped", () => {
    const g = maskGrid(1440, 900, { x: 100, y: 200 });
    expect(g.cell).toBe(REALM_TRANSITION.cell);
    expect(g.cols).toBe(180 + 16);
    expect(g.rows).toBe(113 + 16);
    expect(g.far).toBeCloseTo(Math.hypot(1340, 700));
    const c = maskGrid(390, 844, { x: -50, y: 9999 });
    expect(c.origin).toEqual({ x: 0, y: 844 });
    expect(c.far).toBeCloseTo(Math.hypot(390, 844));
  });
  test("twelve frames: the first shows a seed, the last everything", () => {
    expect(REALM_TRANSITION_FRAMES).toBe(12);
    expect(frameProgress(0)).toBeCloseTo(1 / 12);
    expect(frameProgress(11)).toBe(1);
    const g = maskGrid(1440, 900, { x: 720, y: 450 });
    const f = maskFrames(g);
    expect(f.length).toBe(12);
    const first = count(f[0]);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(f[0].length / 20);
    expect(count(f[11])).toBe(f[11].length); // slack cells included
  });
  test("the circle only grows, from the origin", () => {
    const g = maskGrid(1440, 900, { x: 0, y: 0 });
    const f = maskFrames(g);
    for (let i = 1; i < f.length; i++) {
      let lost = 0;
      for (let c = 0; c < f[i].length; c++) if (f[i - 1][c] && !f[i][c]) lost++;
      expect(lost).toBe(0);
      expect(count(f[i])).toBeGreaterThan(count(f[i - 1]));
    }
    expect(f[0][0]).toBe(1); // the corner it grows from
    expect(f[5][g.cols * (g.rows - 1) - 1]).toBe(0); // the far corner waits
  });
  test("the edge is dithered: a ring of cells is partly lit in the middle frame", () => {
    const g = maskGrid(1440, 900, { x: 720, y: 450 });
    const lit = litCells(g, 0.5);
    let partly = 0;
    for (let y = 0; y < g.rows; y += 4)
      for (let x = 0; x < g.cols; x += 4) {
        let n = 0;
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) n += lit[(y + j) * g.cols + x + i] ?? 0;
        if (n > 0 && n < 16) partly++;
      }
    expect(partly).toBeGreaterThan(10);
  });
  test("the sprite sheet holds every frame once", () => {
    const seen = new Set<string>();
    for (let i = 0; i < REALM_TRANSITION_FRAMES; i++) {
      const c = sheetCell(i);
      expect(c.col).toBeLessThan(SHEET_COLUMNS);
      seen.add(`${c.col},${c.row}`);
    }
    expect(seen.size).toBe(REALM_TRANSITION_FRAMES);
    expect(sheetCell(0)).toEqual({ col: 0, row: 0 });
    expect(sheetCell(4)).toEqual({ col: 1, row: 1 });
  });
});
