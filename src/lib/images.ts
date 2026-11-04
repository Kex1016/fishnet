// Image routes (PLAN §3.4, W8): the site never links a visitor to cakeutils or Mojang.
// Icons: the API's `icon` is "/v2/icons/<sha256>.png" (possibly absolute); the site serves it at
// /img/icon/<sha256>.png. Faces: /img/face/<uuid>.png.

const SHA = /([0-9a-f]{64})\.png$/;

/** The site's URL for a catalogue icon, or null when the API has none. */
export function iconHref(icon: string | null | undefined): string | null {
  if (!icon) return null;
  const m = SHA.exec(icon);
  return m ? `/img/icon/${m[1]}.png` : null;
}

export function faceHref(uuid: string): string {
  return `/img/face/${uuid}.png`;
}
