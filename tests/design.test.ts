import { describe, expect, test } from "bun:test";
import { BAYER4, REALM_TRANSITION, REALM_TRANSITION_FRAMES, bayer, hexTone, inCircle } from "../src/lib/design/dither.ts";
import { blobTarget, blobTone } from "../src/lib/design/blobs.ts";
import { pagerSteps, promptPath, sectionPath, titleEm } from "../src/lib/design/shell.ts";

describe("dither", () => {
  test("the Bayer matrix holds every threshold once, in (0, 1)", () => {
    expect(BAYER4.length).toBe(16);
    expect(new Set(BAYER4).size).toBe(16);
    expect(BAYER4.every((v) => v > 0 && v < 1)).toBe(true);
    expect(bayer(0, 0)).toBe(0.5 / 16);
    expect(bayer(4, 4)).toBe(bayer(0, 0));
  });
  test("the realm transition is 12 frames a second for one second", () => {
    expect(REALM_TRANSITION.fps).toBe(12);
    expect(REALM_TRANSITION_FRAMES).toBe(12);
  });
  test("the circle is empty at the start, full at the end, dithered in between", () => {
    expect(inCircle(0, 0, 0, 0)).toBe(false);
    expect(inCircle(1, 1, 3, 3)).toBe(true);
    expect(inCircle(0.5, 0, 0, 0)).toBe(true); // the centre is in early
    expect(inCircle(0.5, 1, 0, 0)).toBe(false); // the far corner is not
  });
  test("hex tones", () => {
    expect(hexTone(" #191724 ", [0, 0, 0])).toEqual([25, 23, 36]);
    expect(hexTone("var(--x)", [1, 2, 3])).toEqual([1, 2, 3]);
  });
  test("blobs: a count in 6..60, three tones by the field", () => {
    expect(blobTarget(10, 10)).toBe(6);
    expect(blobTarget(1000, 1000)).toBe(60);
    expect(blobTone(0, 0.5)).toBe(0);
    expect(blobTone(1, 0.5)).toBe(1);
    expect(blobTone(5, 0.5)).toBe(2);
  });
});

describe("shell", () => {
  test("prompt paths", () => {
    expect(promptPath("/")).toBe("~");
    expect(promptPath("/players/Pebblewick")).toBe("~/players/Pebblewick");
    expect(promptPath("/players/%E9%AD%9A")).toBe("~/players/魚");
    expect(promptPath("/x/%E0%A4%A")).toBe("~/x/%E0%A4%A");
    expect(sectionPath("/leaderboards/mined:stone")).toBe("~/leaderboards");
    expect(sectionPath("/")).toBe("~");
  });
  test("title widths grow with the words and never go under 3", () => {
    expect(titleEm("stats")).toBe(3);
    expect(titleEm("advancements")).toBeGreaterThan(4.5);
    expect(titleEm("Pebblewick_the_Second")).toBeGreaterThan(titleEm("Pebblewick"));
    expect(titleEm("魚魚魚魚")).toBeGreaterThan(4);
  });
  test("pager steps", () => {
    expect(pagerSteps(10, 15, 0)).toEqual([]);
    const s = pagerSteps(148, 15, 0);
    expect(s.map((x) => ("gap" in x ? "…" : x.current ? `[${x.page}]` : String(x.page)))).toEqual(["[1]", "2", "3", "…", "10"]);
    const m = pagerSteps(148, 15, 75);
    expect(m.map((x) => ("gap" in x ? "…" : x.current ? `[${x.page}]` : String(x.page)))).toEqual(["1", "…", "5", "[6]", "7", "…", "10"]);
    const e = pagerSteps(148, 15, 135);
    expect(e.at(-1)).toEqual({ page: 10, offset: 135, current: true });
  });
});
