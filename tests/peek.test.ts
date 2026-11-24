import { describe, expect, test } from "bun:test";
import { PEEK, peekFrames, placePeek, skinFor } from "#lib/design/peek.ts";

describe("picture peek", () => {
  test("opens from its corner and ends on the whole box", () => {
    const f = peekFrames(10, 20, "tl");
    expect(f).toHaveLength(PEEK.frames);
    expect(f[0][0]).toBe(true);
    expect(f[0][f[0].length - 1]).toBe(false);
    expect(f.at(-1)!.every(Boolean)).toBe(true);
    const lit = f.map((x) => x.filter(Boolean).length);
    for (let i = 1; i < lit.length; i++) expect(lit[i]).toBeGreaterThanOrEqual(lit[i - 1]);
    const br = peekFrames(10, 20, "br");
    expect(br[0][br[0].length - 1]).toBe(true);
    expect(br[0][0]).toBe(false);
  });

  test("goes right of the picture, left when there is no room, always inside the window", () => {
    const right = placePeek({ left: 100, top: 300, width: 20, height: 20 }, 146, 146, 1440, 900);
    expect(right.left).toBe(100 + 20 + PEEK.gap);
    expect(right.corner.endsWith("l")).toBe(true);
    const left = placePeek({ left: 1380, top: 300, width: 20, height: 20 }, 146, 146, 1440, 900);
    expect(left.left).toBe(1380 - PEEK.gap - 146);
    expect(left.corner.endsWith("r")).toBe(true);
    const low = placePeek({ left: 100, top: 880, width: 20, height: 20 }, 146, 274, 1440, 900);
    expect(low.top).toBe(900 - 274 - 8);
    expect(low.corner.startsWith("b")).toBe(true);
    const narrow = placePeek({ left: 180, top: 10, width: 20, height: 20 }, 146, 146, 390, 844);
    expect(narrow.left).toBeGreaterThanOrEqual(8);
    expect(narrow.left + 146).toBeLessThanOrEqual(390 - 8);
  });

  test("a head peeks at the full skin, anything else at itself", () => {
    expect(skinFor("/img/face/069a79f4-44e9-4726-a5be-fca90e38aaf5.png")).toBe("/img/skin/069a79f4-44e9-4726-a5be-fca90e38aaf5.png");
    expect(skinFor("/img/icon/abc.png")).toBeNull();
    expect(skinFor("https://example.com/img/face/069a79f4-44e9-4726-a5be-fca90e38aaf5.png")).toBeNull();
  });
});
