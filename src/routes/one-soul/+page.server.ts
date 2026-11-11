// One Soul overview (WEBSITE-BRIEF §3.5, §4): the landing dashboard from one call, GET /v2/onesoul/live.
// On a proxy without it, the same card is put together from GET /v2/onesoul, the round's souls and the
// last timeline rows. Never coordinates of the living soul, never a queue order (WEBSITE-BRIEF §3.2).
import type { PageServerLoad } from "./$types";
import { oneSoul } from "#lib/server/onesoul/index.ts";
import type { Live, LivePrevious, Longest, Soul } from "#lib/onesoul/types.ts";

export const load: PageServerLoad = async ({ parent, depends }) => {
  depends("onesoul:live");
  const { os } = await parent();
  const crumbs = [{ label: "One Soul", href: "/one-soul" }];
  if (!os) return { title: "One Soul", crumbs, card: null, asOf: null, stale: false, source: "none" as const };
  const c = oneSoul();

  const live = await c.live(os.server);
  if (live.ok) return { title: "One Soul", crumbs, card: live.data, asOf: live.asOf, stale: live.stale, source: "live" as const };

  // fallback: the built routes (three calls, all cached)
  const [status, souls, events] = await Promise.all([c.status(), c.souls({ server: os.server, cycle: os.cycle, limit: 100 }), c.events({ server: os.server, cycle: os.cycle, limit: 5 })]);
  const s = status.ok ? status.data.servers.find((x) => x.server === os.server) : undefined;
  if (!s || !status.ok) return { title: "One Soul", crumbs, card: null, asOf: null, stale: false, source: "none" as const };
  const rows: Soul[] = souls.ok ? souls.data.souls : [];
  const ended = rows.filter((x) => x.duration_ms !== null);
  const longest = ended.reduce<Soul | null>((a, x) => (!a || (x.duration_ms ?? 0) > (a.duration_ms ?? 0) ? x : a), null);
  const prev = ended.at(-1) ?? null;
  const now = status.asOf;
  const playing = rows.find((x) => x.outcome === "playing");
  const card: Live = {
    server: s.server,
    display_name: s.display_name,
    cycle: s.cycle,
    state: s.state,
    updated_at: now,
    soul: s.soul
      ? {
          uuid: s.soul.uuid,
          name: s.soul.name,
          turn: playing?.turn ?? s.played,
          since: s.soul.since,
          alive_ms: Math.max(0, now - s.soul.since),
          phase: s.soul.phase,
          second_chance:
            s.soul.phase === "second_chance" && typeof s.soul.remaining_ms === "number"
              ? { deadline: s.soul.deadline ?? now + s.soul.remaining_ms, remaining_ms: s.soul.remaining_ms, paused: s.soul.paused, offerings: s.soul.offerings, added_ms: s.soul.added_ms }
              : null
        }
      : null,
    round: {
      started_at: null,
      prep_ends_at: s.prep_ends_at,
      grace_ends_at: s.grace_ends_at,
      waiting: s.waiting,
      played: s.played,
      registered: s.registered,
      longest: longest ? ({ uuid: longest.uuid, name: longest.name, turn: longest.turn, duration_ms: longest.duration_ms! } satisfies Longest) : null
    },
    previous: prev
      ? ({ uuid: prev.uuid, name: prev.name, turn: prev.turn, duration_ms: prev.duration_ms, cause: prev.cause, grave_id: prev.grave_id, has_journal: prev.has_journal } satisfies LivePrevious)
      : null,
    recent: events.ok ? events.data.events : []
  };
  return { title: "One Soul", crumbs, card, asOf: status.asOf, stale: status.stale, source: "status" as const };
};
