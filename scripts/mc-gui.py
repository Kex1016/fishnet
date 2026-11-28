#!/usr/bin/env python3
"""Extract the container screens the One Soul guide draws recipes on (run with python3 -I).

    python3 -I scripts/mc-gui.py <minecraft-client.jar>

Writes static/mc/gui/{crafting_table,anvil,smithing}.png, the three 256x256 sheets of the game's own
screens, and anvil_text_field.png, the sprite the game lays over the anvil sheet's name field. The guide (src/lib/onesoul/guide/) draws a recipe on the top of one sheet at a whole-number scale,
pixelated, with the items on its slots. Same precedent as the journal book (scripts/mc-assets.py): David
allowed bundling game textures for the site's in-game looks on 11 Nov 2026 (cakeutils OSD-62). Needs Pillow.
"""
import io
import os
import sys
import zipfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main(jar):
    z = zipfile.ZipFile(jar)
    out = os.path.join(ROOT, "static", "mc", "gui")
    os.makedirs(out, exist_ok=True)
    for n in ["crafting_table", "anvil", "smithing"]:
        data = z.read(f"assets/minecraft/textures/gui/container/{n}.png")
        Image.open(io.BytesIO(data)).convert("RGBA").save(os.path.join(out, f"{n}.png"), optimize=True)
        print("wrote", n)
    # the anvil sheet paints its name field red: the game draws this sprite over it (110x16 at 59,20)
    data = z.read("assets/minecraft/textures/gui/sprites/container/anvil/text_field.png")
    Image.open(io.BytesIO(data)).convert("RGBA").save(os.path.join(out, "anvil_text_field.png"), optimize=True)
    print("wrote anvil_text_field")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
