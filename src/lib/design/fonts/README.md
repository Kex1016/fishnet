# Fonts

Every font is served by the site. Visitors make no request to Google Fonts or any other host.

| Family | Files | Source | Licence |
| --- | --- | --- | --- |
| IBM (Web437 IBM VGA 8x16, and its 2x face as weight 700) | `Web437_IBM_VGA_8x16.woff`, `Web437_IBM_VGA_8x16-2x.woff` | The Ultimate Oldschool PC Font Pack by VileR, https://int10h.org/oldschool-pc-fonts/. The files are the pack's own web fonts, unchanged, as the haiiro design system carries them. | CC BY-SA 4.0 |
| Jacquard 24 | `@fontsource/jacquard-24` (npm) | The Soft Type Project, https://github.com/scfried/soft-type-jacquard | SIL OFL 1.1 |
| Unifont | `@fontsource/unifont` (npm), and `unifont-ui.woff2`, a slice of it built by `scripts/fonts-subset.py` | GNU Unifont, https://unifoundry.com/unifont/ | SIL OFL 1.1, or GPL 2+ with the font embedding exception |

`fonts.css` declares them. To rebuild the slice after changing its ranges: `pip install fonttools brotli`,
then `python3 -I scripts/fonts-subset.py`, and copy the same ranges into the `unicode-range` in `fonts.css`.
