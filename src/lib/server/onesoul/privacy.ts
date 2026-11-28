// The site's own copy of One Soul's privacy rules (WEBSITE-BRIEF §3.2, API-EXPANSION §7), applied to
// every answer before a page sees it, so a proxy bug cannot leak through the site:
// - nothing that looks like the queue order or a "next up" (any key named so, anywhere) survives;
// - the living soul carries no position (only realm and online);
// - a journal of a soul that is still playing is refused (the caller gets not_found). Their trail is not: the
//   living soul's trail and position are on the map since TH-31 (design §8.1 [David]).
import { fail, type Result } from "#lib/api/result.ts";
import type { EventList } from "#lib/onesoul/types.ts";

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

/** A journal answer for a soul that still plays: refused like an unknown turn. */
export function refuseLiving<T>(r: Result<T>, playing: boolean): Result<T> {
  return r.ok && playing ? fail("not_found", { status: 404 }) : r;
}

/** Event kinds whose data names where a portal is: a way to the soul (a stable Nether portal) or where the stronghold is (an open End portal). */
export const PORTAL_KINDS = new Set(["rift_stable", "end_opened"]);

/** Fields of an event's data that place something in the world. */
const PLACE_KEYS = ["dim", "x", "y", "z", "pos", "position", "coords", "coordinates", "location"];

/** True when any event in the list is a portal event that carries a place. */
export const hasPortalPlace = (l: EventList): boolean => l.events.some((e) => PORTAL_KINDS.has(e.kind) && PLACE_KEYS.some((k) => k in (e.data ?? {})));

/**
 * The proxy never serves a portal's position while a round runs (cakeutils CONTRACTS §11.2); this is the site's
 * own copy of that rule: portal events of a round that is not over lose every place field, whatever the answer says.
 */
export function withoutRunningPortalPlaces(l: EventList, over: (cycle: number | undefined) => boolean): EventList {
  return {
    ...l,
    events: l.events.map((e) => {
      if (!PORTAL_KINDS.has(e.kind) || over(e.cycle)) return e;
      const data = { ...(e.data ?? {}) };
      for (const k of PLACE_KEYS) delete data[k];
      return { ...e, data };
    })
  };
}
