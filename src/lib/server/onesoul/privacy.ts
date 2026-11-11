// The site's own copy of One Soul's privacy rules (WEBSITE-BRIEF §3.2, API-EXPANSION §7), applied to
// every answer before a page sees it, so a proxy bug cannot leak through the site:
// - nothing that looks like the queue order or a "next up" (any key named so, anywhere) survives;
// - the living soul carries no position (only realm and online);
// - a journal or trail of a soul that is still playing is refused (the caller gets not_found).
import { fail, type Result } from "#lib/api/result.ts";

const QUEUE_KEY = /^(queue|queue_.+|.+_queue|next|next_up|next_soul|up_next|position|queue_position|order_in_queue|rank_in_queue)$/i;
const POS_KEYS = ["x", "y", "z", "pos", "position", "coords", "coordinates", "location", "dim", "dimension"];

/** A copy without queue-like keys, at any depth. Arrays keep their order (sign-ups come by sign-up time). */
export function withoutQueue<T>(v: T): T {
  if (Array.isArray(v)) return v.map(withoutQueue) as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (!QUEUE_KEY.test(k)) out[k] = withoutQueue(x);
    return out as T;
  }
  return v;
}

/** The living soul without any position field. */
export function withoutPosition<T extends object | null>(soul: T): T {
  if (!soul) return soul;
  const out: Record<string, unknown> = { ...(soul as Record<string, unknown>) };
  for (const k of POS_KEYS) delete out[k];
  return out as T;
}

/** Applies `f` to an ok answer's data; failures pass unchanged. */
export function mapOk<T>(r: Result<T>, f: (d: T) => T): Result<T> {
  return r.ok ? { ...r, data: f(r.data) } : r;
}

/** A journal or trail answer for a soul that still plays: refused like an unknown turn. */
export function refuseLiving<T>(r: Result<T>, playing: boolean): Result<T> {
  return r.ok && playing ? fail("not_found", { status: 404 }) : r;
}
