// Lays out journal text the way the game's book screen does (WEBSITE-BRIEF §5): the Minecraft bitmap font's
// advances, soft wrap at 114 units breaking at the last space (the space is consumed) and mid-word only when
// one word is wider than the line, `\n` as a hard break, 9 units per line. Runs on the server and in the
// browser alike. Player text is never interpreted: control characters are dropped, `§` is a plain glyph.
import data from "./glyphs.json";

export const BOOK = {
  /** the visible book inside the game's 192 x 192 box: x 20..166, y 1..181 */
  crop: { x: 20, y: 1, w: 146, h: 180 },
  text: { x: 36, y: 32, width: 114, line: 9, lines: 14 },
  indicator: { right: 148, y: 18 },
  back: { x: 43, y: 157 },
  forward: { x: 116, y: 157 },
  arrow: { w: 23, h: 13 }
} as const;

export type Sheet = { file: string; w: number; h: number; cw: number; ch: number; height: number; ascent: number; cols: number };
/** One drawn character. `g` is its cell in a font sheet; without `g` it is a space or a fallback glyph. */
export type Glyph = { ch: string; adv: number; g?: { sheet: number; sx: number; sy: number; top: number } };
export type Line = { glyphs: Glyph[]; width: number };

type Raw = { spaces: Record<string, number>; sheets: (Sheet & { chars: string; adv: number[] })[] };
const raw = data as Raw;
export const SHEETS: Sheet[] = raw.sheets.map(({ chars: _c, adv: _a, ...s }) => s);

const table = new Map<string, Glyph>();
raw.sheets.forEach((s, si) => {
  [...s.chars].forEach((ch, i) => {
    if (ch === "\u0000") return;
    const col = i % s.cols;
    const row = Math.floor(i / s.cols);
    table.set(ch, { ch, adv: s.adv[i], g: { sheet: si, sx: col * s.cw, sy: row * s.ch, top: 7 - s.ascent } });
  });
});
for (const [ch, adv] of Object.entries(raw.spaces)) table.set(ch, { ch, adv });

// East Asian wide and fullwidth ranges: drawn twice as wide by the game's Unifont fallback
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u{20000}-\u{3fffd}]|[\u{1f300}-\u{1faff}]/u;

/** The glyph for one character; null for a dropped control character. */
export function glyph(ch: string): Glyph | null {
  const hit = table.get(ch);
  if (hit) return hit;
  const cp = ch.codePointAt(0) ?? 0;
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0) || (cp >= 0x200b && cp <= 0x200f) || (cp >= 0x2028 && cp <= 0x202e) || (cp >= 0x2060 && cp <= 0x2064) || cp === 0xfeff) return null;
  // not in the bitmap fonts: the game draws it from Unifont (8 or 16 pixels at half size, plus one)
  return { ch, adv: WIDE.test(ch) ? 9 : 5 };
}

export function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += glyph(ch)?.adv ?? 0;
  return w;
}

function line(glyphs: Glyph[]): Line {
  return { glyphs, width: glyphs.reduce((a, g) => a + g.adv, 0) };
}

/** One book page as lines, every line the game would draw (the caller cuts at 14). */
export function layoutPage(text: string, width: number = BOOK.text.width): Line[] {
  const chars: Glyph[] = [];
  const hard: number[] = []; // one entry per `\n`, so `\n\n` leaves an empty line
  for (const ch of text.replace(/\r\n?/g, "\n")) {
    if (ch === "\n") {
      hard.push(chars.length);
      continue;
    }
    const g = glyph(ch);
    if (g) chars.push(g);
  }
  const out: Line[] = [];
  let start = 0;
  let hi = 0;
  while (true) {
    const end = hi < hard.length ? hard[hi] : chars.length;
    // wrap chars[start, end) into lines
    let i = start;
    let w = 0;
    let space = -1;
    let from = start;
    while (i < end) {
      const g = chars[i];
      if (g.ch === " ") space = i;
      w += g.adv;
      if (w > width) {
        if (space >= from) {
          out.push(line(chars.slice(from, space)));
          from = space + 1;
        } else {
          const cut = i > from ? i : i + 1; // at least one glyph per line
          out.push(line(chars.slice(from, cut)));
          from = cut;
        }
        i = from;
        w = 0;
        space = -1;
        continue;
      }
      i++;
    }
    out.push(line(chars.slice(from, end)));
    if (hi >= hard.length) break;
    start = end;
    hi++;
  }
  return out;
}

/** "Page 2 of 7" as one line. */
export function indicator(n: number, of: number): Line {
  return line([...`Page ${n} of ${of}`].map((c) => glyph(c)).filter((g): g is Glyph => g !== null));
}
