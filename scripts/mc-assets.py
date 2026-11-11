#!/usr/bin/env python3
"""Extract the journal book assets from a Minecraft client jar (run with python3 -I).

    python3 -I scripts/mc-assets.py <minecraft-client.jar>

Writes static/mc/ (book texture, page arrows, the bitmap font sheets recoloured black for book text) and
src/lib/onesoul/book/glyphs.json (glyph positions and advances, measured from the bitmaps the way the game
does: the glyph's ink width, scaled to its height, plus one). David allowed bundling the book texture and
the font on 11 Nov 2026 (cakeutils OSD-62). Needs Pillow.
"""
import io
import json
import os
import sys
import zipfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = "assets/minecraft/"


def read(z, path):
    return z.read(A + path)


def main(jar):
    z = zipfile.ZipFile(jar)
    out = os.path.join(ROOT, "static", "mc")
    os.makedirs(os.path.join(out, "font"), exist_ok=True)
    Image.open(io.BytesIO(read(z, "textures/gui/book.png"))).convert("RGBA").save(os.path.join(out, "book.png"), optimize=True)
    for n in ["page_backward", "page_backward_highlighted", "page_forward", "page_forward_highlighted"]:
        Image.open(io.BytesIO(read(z, f"textures/gui/sprites/widget/{n}.png"))).convert("RGBA").save(os.path.join(out, f"{n}.png"), optimize=True)

    font = json.loads(read(z, "font/include/default.json"))
    space = json.loads(read(z, "font/include/space.json"))
    sheets = []
    for p in font["providers"]:
        if p.get("type") != "bitmap":
            continue
        name = p["file"].split(":", 1)[1].split("/")[-1]
        im = Image.open(io.BytesIO(read(z, "textures/" + p["file"].split(":", 1)[1]))).convert("RGBA")
        rows = p["chars"]
        cols = len(rows[0])
        cw, ch = im.width // cols, im.height // len(rows)
        height = p.get("height", 8)
        scale = height / ch
        chars, adv = [], []
        for r, row in enumerate(rows):
            for c, char in enumerate(row):
                if char in ("\u0000", " "):
                    chars.append("\u0000")
                    adv.append(0)
                    continue
                ink = 0
                for x in range(cw - 1, -1, -1):
                    if any(im.getpixel((c * cw + x, r * ch + y))[3] for y in range(ch)):
                        ink = x + 1
                        break
                chars.append(char)
                adv.append(int(0.5 + ink * scale) + 1)
        # black glyphs: book text is drawn in #000
        black = Image.new("RGBA", im.size, (0, 0, 0, 0))
        black.putalpha(im.getchannel("A"))
        black.save(os.path.join(out, "font", name), optimize=True)
        sheets.append({"file": f"/mc/font/{name}", "w": im.width, "h": im.height, "cw": cw, "ch": ch, "height": height, "ascent": p["ascent"], "cols": cols, "chars": "".join(chars), "adv": adv})
    spaces = {}
    for p in space["providers"]:
        if p.get("type") == "space":
            spaces.update(p["advances"])
    dst = os.path.join(ROOT, "src", "lib", "onesoul", "book", "glyphs.json")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, "w", encoding="utf-8") as f:
        json.dump({"source": os.path.basename(jar), "spaces": spaces, "sheets": sheets}, f, ensure_ascii=False, separators=(",", ":"))
    print("wrote", dst, sum(len(s["chars"].replace("\u0000", "")) for s in sheets), "glyphs")


if __name__ == "__main__":
    main(sys.argv[1])
