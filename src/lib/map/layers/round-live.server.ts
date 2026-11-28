// The living soul's live position for the round maps (TH-31, design §8.1 [David]), behind /one-soul/map/live.json.
// One answer is shared by every visitor for 2 s, so the map bucket sees at most one request per 2 s however many
// people watch.
//
// Privacy (the site's own check behind cakeutils' MAPD-78): only the soul the status names as playing in the running
// cycle, never in prep; anybody else in the answer is dropped. Nobody when cakeutils is down, the soul is offline or
// `onesoul.api.live-map` is off. The section does not apply the hidden-players list (David, 17 Nov 2026).
import type { PlayerDot } from "../types.ts";
import type { MapClient } from "#lib/server/cakeutils/map.ts";
import type { OneSoulClient } from "#lib/server/onesoul/client.ts";
import type { StatusServer } from "#lib/onesoul/types.ts";

export type LiveSoul = { cycle: number | null; at: number; players: PlayerDot[] };

/** How often RoundMap asks, ms (also the glide of the dot). */
export const LIVE_POLL_MS = 3_000;
const SHARE_MS = 2_000;
let shared: { at: number; answer: Promise<LiveSoul | null> } | null = null;

/** The clients (the route passes the configured ones) and the owner's hidden servers. No singleton here: tests pass their own. */
export type LiveDeps = { os: OneSoulClient; map: MapClient; visible: (s: StatusServer[]) => StatusServer[] };

/** null: no One Soul map here at all (the route answers 404). */
export async function liveSoul(now: number, d: LiveDeps): Promise<LiveSoul | null> {
  const c = d.os;
  if (!(await c.enabled("status")) || !(await c.enabled("map"))) return null;
  const st = await c.status();
  if (!st.ok) return { cycle: null, at: now, players: [] };
  const s = d.visible(st.data.servers)[0];
  if (!s) return null;
  if (s.state === "prep" || s.state === "ended" || !s.soul) return { cycle: s.cycle, at: now, players: [] };
  const r = await d.map.roundMapPlayers(s.cycle, s.server, { priority: "background", waitMs: 500 });
  const soul = s.soul.uuid.toLowerCase();
  const players = r.ok && r.data.cycle === s.cycle ? r.data.players.filter((p) => p.uuid.toLowerCase() === soul).slice(0, 1) : [];
  return { cycle: s.cycle, at: now, players };
}

/** The answer every visitor shares for 2 s. */
export function sharedLiveSoul(deps: () => LiveDeps, t = Date.now()): Promise<LiveSoul | null> {
  if (!shared || t - shared.at >= SHARE_MS || t < shared.at) {
    shared = { at: t, answer: liveSoul(t, deps()).catch((): LiveSoul => ({ cycle: null, at: t, players: [] })) };
  }
  return shared.answer;
}

/** For tests: forget the shared answer. */
export function resetLiveSoul(): void {
  shared = null;
}
