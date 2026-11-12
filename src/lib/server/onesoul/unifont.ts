// Unifont metrics for the journal book (scripts/unifont.py): the game draws every character its bitmap fonts
// lack from Unifont, so the book needs that glyph's ink box to wrap and draw it. The whole table stays on the
// server; a journal page gets only the characters its text uses.
import { inBitmap, type Uni } from "#lib/onesoul/book/layout.ts";
import data from "./unifont-data.ts";

let pages: Map<number, string> | null = null;
function table(): Map<number, string> {
  if (pages) return pages;
  pages = new Map();
  for (const line of data.split("\n")) {
    const [hex, meta] = line.split(" ");
    if (hex && meta?.length === 512) pages.set(parseInt(hex, 16), meta);
  }
  return pages;
}

const W = "0123456789abcdefg";

/** Metrics for every character in `texts` that the bitmap fonts lack and Unifont has. */
export function unifontFor(texts: readonly string[]): Uni {
  const out: Uni = {};
  for (const t of texts)
    for (const ch of t) {
      if (ch in out || inBitmap(ch)) continue;
      const cp = ch.codePointAt(0)!;
      const meta = table().get(cp >> 8);
      const m = meta?.slice((cp & 0xff) * 2, (cp & 0xff) * 2 + 2);
      if (!m || m === "--") continue;
      out[ch] = [parseInt(m[0], 16), W.indexOf(m[1])];
    }
  return out;
}
