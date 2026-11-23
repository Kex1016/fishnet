# Builds src/lib/design/fonts/unifont-ui.woff2: the slice of GNU Unifont the interface itself uses (accents,
# punctuation, arrows, box drawing, stars and check marks), so a page never downloads the whole font for a
# "★" or an en dash. IBM VGA has only the 256 CP437 glyphs; everything else falls to Unifont (tokens.css).
#   pip install fonttools brotli
#   python3 -I scripts/fonts-subset.py
# Source: node_modules/@fontsource/unifont (OFL 1.1). Keep RANGES in step with the unicode-range in fonts.css.
import os
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "node_modules/@fontsource/unifont/files/unifont-latin-400-normal.woff2")
OUT = os.path.join(ROOT, "src/lib/design/fonts/unifont-ui.woff2")
RANGES = "U+00A0-024F,U+02B0-02FF,U+0370-03FF,U+0400-045F,U+2000-206F,U+20A0-20BF,U+2100-214F,U+2190-21FF,U+2200-222F,U+2260-2265,U+2500-25FF,U+2600-26FF,U+2700-27BF"

opts = subset.Options()
opts.flavor = "woff2"
opts.layout_features = []
opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
opts.notdef_outline = True
font = subset.load_font(SRC, opts)
s = subset.Subsetter(opts)
s.populate(unicodes=subset.parse_unicodes(RANGES))
s.subset(font)
subset.save_font(font, OUT, opts)
print(OUT, os.path.getsize(OUT), "bytes", len(font.getBestCmap()), "characters")
