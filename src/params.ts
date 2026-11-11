// Route parameter matchers (SvelteKit 3 keeps them all in this one file).
import { defineParams } from "@sveltejs/kit/params";

export const params = defineParams({
  /** /img/icon/<sha256>.png */
  sha: (p: string) => (/^[0-9a-f]{64}$/.test(p) ? p : undefined),
  /** One Soul rounds and turns: a positive integer */
  int: (p: string) => (/^[1-9][0-9]{0,8}$/.test(p) ? Number(p) : undefined),
  /** /img/face/<dashed uuid>.png */
  uuid: (p: string) => (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p) ? p.toLowerCase() : undefined)
});
