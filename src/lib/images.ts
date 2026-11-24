// Image routes (PLAN §3.4, W8): the site never links a visitor to cakeutils or Mojang.
// Icons: the API's `icon` is "/v2/icons/<sha256>.png" (possibly absolute); the site serves it at
// /img/icon/<sha256>.png. Faces: /img/face/<uuid>.png. The site's own pictures for things cakeutils has no
// icon for (src/lib/icons/fallback.ts) are static files, /mc/icons/<name>.png, and pass as they are.

const SHA = /([0-9a-f]{64})\.png$/;
const BUNDLED = /^\/mc\/icons\/[a-z0-9_]{1,64}\.png$/;

/** The site's URL for a catalogue icon, or null when the API has none. */
export function iconHref(icon: string | null | undefined): string | null {
  if (!icon) return null;
  if (BUNDLED.test(icon)) return icon;
  const m = SHA.exec(icon);
  return m ? `/img/icon/${m[1]}.png` : null;
}

export function faceHref(uuid: string): string {
  return `/img/face/${uuid}.png`;
}
