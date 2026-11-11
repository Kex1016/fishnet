import { describe, expect, test } from "bun:test";
import { BOOK, glyph, indicator, layoutPage, textWidth } from "#lib/onesoul/book/layout.ts";

const text = (t: string) => layoutPage(t).map((l) => l.glyphs.map((g) => g.ch).join(""));

describe("book layout (the game's font metrics)", () => {
  test("advances match the game's ascii font", () => {
    expect([..."AiIl. !"].map((c) => glyph(c)!.adv)).toEqual([6, 2, 4, 3, 2, 4, 2]);
    expect(textWidth("Page 1 of 4")).toBe(59);
  });
  test("wraps at 114 units on the last space, dropping that space", () => {
    const lines = layoutPage("The spawn is a birch forest. I built a dirt hut");
    expect(lines.map((l) => l.glyphs.map((g) => g.ch).join(""))).toEqual(["The spawn is a birch", "forest. I built a dirt", "hut"]);
    for (const l of lines) expect(l.width).toBeLessThanOrEqual(BOOK.text.width);
  });
  test("breaks inside a word only when it is wider than the line", () => {
    expect(text("A".repeat(40))).toEqual(["A".repeat(19), "A".repeat(19), "AA"]);
  });
  test("\\n breaks, \\n\\n leaves one empty line, a trailing \\n an empty last line", () => {
    expect(text("a\n\nb")).toEqual(["a", "", "b"]);
    expect(text("a\n")).toEqual(["a", ""]);
    expect(text("")).toEqual([""]);
    expect(text("a\r\nb")).toEqual(["a", "b"]);
  });
  test("spaces are kept, control characters dropped, § is a plain glyph", () => {
    expect(text("a  b")).toEqual(["a  b"]);
    expect(text("x\u0007\ty§a")).toEqual(["xy§a"]);
    expect(glyph("§")?.g).toBeDefined();
  });
  test("accented and Cyrillic come from the bitmap sheets; others fall back with a fixed advance", () => {
    expect(glyph("é")?.g).toBeDefined();
    expect(glyph("ж")?.g).toBeDefined();
    expect(glyph("日")).toEqual({ ch: "日", adv: 9 });
    expect(glyph("\u{10900}")?.adv).toBe(5);
  });
  test("more than 14 lines are all laid out; the reader decides what to show", () => {
    expect(layoutPage(Array.from({ length: 20 }, (_, i) => String(i)).join("\n")).length).toBe(20);
  });
  test("the page indicator", () => {
    expect(indicator(2, 7).glyphs.map((g) => g.ch).join("")).toBe("Page 2 of 7");
  });
});
