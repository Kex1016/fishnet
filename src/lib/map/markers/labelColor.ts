// The colour of an area's title (brief §5.3): the area colour's hue and chroma in OKLCH, its lightness moved
// until the text reaches LABEL_CONTRAST against the area as the map draws it (the colour at AREA_FILL_OPACITY
// over a neutral grey that stands in for terrain). Pure: runs on the server, in the browser and in bun:test.

/** Fill opacity of an area on the map (brief §5.2); FMK-2 draws the polygon with it. */
export const AREA_FILL_OPACITY = 0.22;
/** Fill opacity on hover or focus (brief §5.2). The label is tinted against the resting fill only. */
export const AREA_FILL_OPACITY_HOVER = 0.35;
/** The terrain stand-in under an area when the tint is chosen. */
export const TERRAIN_STAND_IN = "#808080";
/** WCAG contrast the title aims for against the area as drawn. The brief started at 4.5 (§5.3, §8); FMK-1 tuned it
 * to 3 from the preview: at 4.5 no tint can lighten against a 22 % fill over grey, so every title went near black
 * and merged into its black shadow. */
export const LABEL_CONTRAST = 3;
/** The lightness range the search moves in. */
export const L_MAX = 0.97;
export const L_MIN = 0.15;
/** At or below this lightness the search lightens first, above it darkens first. */
export const L_SPLIT = 0.6;

export type Rgb = [r: number, g: number, b: number]; // 0..255
export type LabelTint = { color: string; contrast: number; l: number; ground: string };

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

export function toHex(c: Rgb): string {
  return "#" + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
}

const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const gam = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** WCAG 2 relative luminance. */
export function luminance(c: Rgb): number {
  return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
}

export function contrast(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export type Oklch = { l: number; c: number; h: number };

export function toOklch(rgb: Rgb): Oklch {
  const [r, g, b] = rgb.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: Math.atan2(B, A) };
}

/** OKLCH to linear sRGB, unclamped (a channel outside 0..1 means out of gamut). */
function linear({ l: L, c, h }: Oklch): [number, number, number] {
  const A = c * Math.cos(h);
  const B = c * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}

const inGamut = (v: [number, number, number]) => v.every((x) => x >= -1e-6 && x <= 1 + 1e-6);

/** The sRGB colour at this lightness and hue, chroma reduced (binary search) until it is in gamut. */
export function fromOklch(o: Oklch): Rgb {
  let v = linear(o);
  if (!inGamut(v)) {
    let lo = 0;
    let hi = o.c;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(linear({ ...o, c: mid }))) lo = mid;
      else hi = mid;
    }
    v = linear({ ...o, c: lo });
  }
  return v.map((x) => gam(Math.min(1, Math.max(0, x)))) as Rgb;
}

/** The area as the map draws it: the colour at `opacity` over the terrain stand-in (sRGB, like canvas and CSS). */
export function areaGround(color: Rgb, opacity = AREA_FILL_OPACITY): Rgb {
  const t = parseHex(TERRAIN_STAND_IN)!;
  return color.map((v, i) => Math.round(v * opacity + t[i] * (1 - opacity))) as Rgb;
}

const STEP = 0.005;

/** The title colour for an area of colour `hex` (`#rrggbb`; anything unparseable is treated as mid grey). */
export function labelTint(hex: string, target: number = LABEL_CONTRAST): LabelTint {
  const rgb = parseHex(hex) ?? [128, 128, 128];
  const ground = areaGround(rgb);
  const o = toOklch(rgb);
  const at = (l: number) => {
    const c = fromOklch({ ...o, l }).map(Math.round) as Rgb;
    return { c, k: contrast(c, ground), l };
  };
  const walk = (dir: 1 | -1) => {
    const end = dir > 0 ? L_MAX : L_MIN;
    for (let l = Math.min(L_MAX, Math.max(L_MIN, o.l)); dir > 0 ? l <= end + 1e-9 : l >= end - 1e-9; l += dir * STEP) {
      const r = at(l);
      if (r.k >= target) return r;
    }
    return null;
  };
  const first: 1 | -1 = o.l <= L_SPLIT ? 1 : -1;
  let hit = walk(first) ?? walk(first > 0 ? -1 : 1);
  if (!hit) {
    const up = at(L_MAX);
    const down = at(L_MIN);
    hit = up.k >= down.k ? up : down;
  }
  return { color: toHex(hit.c), contrast: Math.round(hit.k * 100) / 100, l: Math.round(hit.l * 1000) / 1000, ground: toHex(ground) };
}
