// FMK-1: the area title's tint (brief §5.3) and the Minecraft-font label's layout and measure (§5.2, §5.3).
// The pixel test (shadow offset, no smoothed edges at k 1..4 and DPR 1, 2) runs in Chromium:
// scripts/mc-label-check.ts against /design/map.
import { describe, expect, test } from "bun:test";
import { AREA_FILL_OPACITY, L_MAX, L_MIN, LABEL_CONTRAST, TERRAIN_STAND_IN, areaGround, contrast, fromOklch, labelTint, parseHex, toOklch } from "#lib/map/markers/labelColor.ts";
import { LINE, backingRatio, labelGeometry, labelLines, measureLabel, measureTitle, planLabel } from "#lib/map/markers/McLabel.ts";
import { textWidth } from "#lib/onesoul/book/layout.ts";

// [name, area colour, title colour]; the 16 dyes are Minecraft's dye diffuse colours (cakeutils MAPD-49)
const TABLE: [string, string, string][] = [
  ["pure_red", "#ff0000", "#ffbeb3"],
  ["navy", "#000080", "#9cbdff"],
  ["pure_yellow", "#ffff00", "#4f4f00"],
  ["pure_white", "#ffffff", "#4e4e4e"],
  ["pure_black", "#000000", "#bababa"],
  ["mid_grey", "#808080", "#e1e1e1"],
  ["white", "#f9fffe", "#4a4f4e"],
  ["orange", "#f9801d", "#ffe3d3"],
  ["magenta", "#c74ebd", "#ffcff8"],
  ["light_blue", "#3ab3da", "#cef1ff"],
  ["yellow", "#fed83d", "#554600"],
  ["lime", "#80c71f", "#cdffa1"],
  ["pink", "#f38baa", "#ffe6ec"],
  ["gray", "#474f52", "#cad3d7"],
  ["light_gray", "#9d9d97", "#eaeae3"],
  ["cyan", "#169c9c", "#83f4f3"],
  ["purple", "#8932b8", "#e7c7ff"],
  ["blue", "#3c44aa", "#c3cfff"],
  ["brown", "#835432", "#ffcba7"],
  ["green", "#5e7c16", "#c5e888"],
  ["red", "#b02e26", "#ffc2b9"],
  ["black", "#1d1d21", "#c2c2c7"],
];

describe("labelTint (§5.3)", () => {
  test("constants", () => {
    expect(AREA_FILL_OPACITY).toBe(0.22);
    expect(TERRAIN_STAND_IN).toBe("#808080");
    expect(LABEL_CONTRAST).toBe(3);
  });
  test.each(TABLE)("%s %s → %s", (_n, area, want) => {
    const t = labelTint(area);
    expect(t.color).toBe(want);
    const ground = areaGround(parseHex(area)!);
    const k = contrast(parseHex(t.color)!, ground);
    // reaches the target, or is one of the ends when nothing does
    if (k < LABEL_CONTRAST) expect([L_MAX, L_MIN]).toContain(t.l);
    else expect(k).toBeGreaterThanOrEqual(LABEL_CONTRAST);
  });
  test("keeps the hue", () => {
    for (const [, area, want] of TABLE) {
      const a = toOklch(parseHex(area)!);
      const b = toOklch(parseHex(want)!);
      if (a.c < 0.03 || b.c < 0.03) continue; // greys have no hue to keep
      const d = Math.abs(((a.h - b.h + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      expect(d).toBeLessThan(0.12);
    }
  });
  test("lighter first for every colour, lighter than the area as drawn; darker only when that cannot reach the target", () => {
    for (const area of ["#000080", "#fed83d", "#f38baa", "#1d1d21", "#80c71f", "#3ab3da"]) {
      const t = labelTint(area);
      const lighter = toOklch(parseHex(t.color)!).l > toOklch(parseHex(t.ground)!).l;
      // darker only for yellow, whose ground no lighter title can reach 3 : 1 on
      expect(lighter).toBe(area !== "#fed83d");
    }
    const y = parseHex("#fed83d")!;
    const top = fromOklch({ ...toOklch(y), l: L_MAX }).map(Math.round) as [number, number, number];
    expect(contrast(top, areaGround(y))).toBeLessThan(LABEL_CONTRAST);
  });
  test("the area as drawn is the colour at 22 % over grey", () => {
    expect(areaGround([255, 0, 0])).toEqual([156, 100, 100]);
    expect(labelTint("#ff0000").ground).toBe("#9c6464");
  });
  test("out-of-gamut lightness keeps the colour in sRGB by lowering chroma", () => {
    const c = fromOklch({ l: 0.97, c: 0.3, h: 0.5 });
    for (const v of c) expect(v >= 0 && v <= 255).toBe(true);
  });
  test("unparseable colour is treated as mid grey", () => {
    expect(labelTint("nonsense").color).toBe(labelTint("#808080").color);
    expect(labelTint("#abc").color).toBe(labelTint("#aabbcc").color);
  });
});

describe("label layout and measure (§5.2)", () => {
  test("one line: box is (textWidth + 1) by 9", () => {
    const m = measureTitle("Spawn Town");
    expect(m).toMatchObject({ w: textWidth("Spawn Town") + 1, h: LINE, lines: 1 });
  });
  test("line breaks in a title are spaces; control characters dropped; markup is literal", () => {
    expect(labelLines("a\nb").map((l) => l.glyphs.map((g) => g.ch).join(""))).toEqual(["a b"]);
    expect(labelLines("x\u0007y").map((l) => l.glyphs.map((g) => g.ch).join(""))).toEqual(["xy"]);
    const lit = "<b>Shop</b> & §cRed";
    expect(labelLines(lit)[0].glyphs.map((g) => g.ch).join("")).toBe(lit);
  });
  test("two lines through layoutPage's wrap, each centred in the widest", () => {
    const lines = labelLines("The Great Northern Fishing Harbour", 80);
    expect(lines.length).toBeGreaterThan(1);
    const m = measureLabel(lines);
    expect(m.h).toBe(LINE * lines.length);
    expect(m.w).toBe(Math.ceil(Math.max(...lines.map((l) => l.width))) + 1);
    const plan = planLabel(lines);
    const first = plan.find((d) => d.y >= LINE * (lines.length - 1) - 3);
    const widest = Math.max(...lines.map((l) => l.width));
    expect(first!.x).toBe(Math.floor((widest - lines[lines.length - 1].width) / 2));
  });
  test("non-Latin: Cyrillic from the sheets, CJK from Unifont at half size", () => {
    const uni = { 東: [1, 15] as [number, number] };
    const plan = planLabel(labelLines("東Я", undefined, uni));
    expect(plan[0]).toMatchObject({ kind: "sheet", src: "/mc/unifont/67.png", sw: 15, sh: 16, w: 7.5, h: 8, x: 0, y: 0 });
    expect(plan[1]).toMatchObject({ kind: "sheet", src: "/mc/font/nonlatin_european.png", x: 8.5 });
  });
  test("a character no font has is the game's empty box", () => {
    const plan = planLabel(labelLines("東"));
    expect(plan).toEqual([{ kind: "box", x: 0, y: 0, w: 8, h: 8 }]);
  });
  test("accented capitals reach above the box; the canvas includes them", () => {
    const m = measureTitle("Éa");
    expect(m.over).toBeGreaterThan(0);
    expect(m.h).toBe(LINE);
    const g = labelGeometry(m, 2);
    expect(g.height).toBe((m.over + m.h + m.under) * 2);
    expect(g.anchor).toEqual([m.w, (m.over + LINE / 2) * 2]);
  });
  test("backing store ratio is a whole number", () => {
    expect([0.5, 1, 1.25, 1.5, 2, 3, Number.NaN].map(backingRatio)).toEqual([1, 1, 1, 2, 2, 3, 1]);
  });
});

test("half-pixel Unifont advances round the box up to whole font pixels", () => {
  const uni = { 東: [1, 15] as [number, number] };
  const m = measureLabel(labelLines("東", undefined, uni));
  expect(m.w).toBe(Math.ceil(8.5) + 1);
});

test("LabelFit lines round-trip: wrapped lines as strings, drawn one per line", async () => {
  const { fitLines, lineTexts } = await import("#lib/map/markers/McLabel.ts");
  const strs = lineTexts(labelLines("The Great Northern Fishing Harbour", 80));
  const lines = fitLines({ lines: strs });
  expect(lineTexts(lines)).toEqual(strs);
  expect(measureLabel(lines)).toEqual(measureLabel(labelLines("The Great Northern Fishing Harbour", 80)));
});
