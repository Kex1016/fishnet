// The mock of cakeutils' One Soul routes (built and planned), answering from OneSoulWorld the way the
// contract says (API-EXPANSION.md §2, §3, §7; FISHNET-HANDOFF.md): one 404 for a living soul's journal or
// trail, no queue order anywhere, pranks folded per ghost and day (kinds only for finished rounds), the
// round seed only once the round is over, a non-final death's position masked while that soul plays.
// A feature switched off in `features` answers 404 like an older proxy.
import type {
  EventList, Feature, FeatureCollection, Grave, GraveList, Journal, Live, MapIndex, OsEvent, PlayerOneSoul, Pranks, Registrations, Round,
  RoundDetail, RoundList, Soul, SoulDetail, SoulList, SoulStats, Status, Trail, Waystone, Waystones
} from "#lib/onesoul/types.ts";
import type { OneSoulWorld, OsMockGrave, OsMockSoul } from "./world.ts";
import { DAY } from "./world.ts";

export type Kit = {
  json(req: Request, data: unknown): Response;
  problem(status: number, code: string, detail: string): Response;
  paging(url: URL): { limit: number; offset: number } | Response;
  /** a stat row the way /v2/players/{ref}/stats shapes it */
  statRow(type: string, subject: string, value: number): SoulStats["stats"][number];
  findPlayer(ref: string): { uuid: string; name: string } | undefined;
};

const CRS = { type: "minecraft" as const, axes: ["x", "z", "y"], unit: "block" };

export function handleOneSoul(os: OneSoulWorld | undefined, req: Request, url: URL, seg: string[], kit: Kit): Response | null {
  const { json, problem } = kit;
  const now = Date.now();
  const at = (ago: number) => now - ago;

  // /v2/players/{ref}/onesoul
  if (seg[0] === "players" && seg.length === 3 && seg[2] === "onesoul") {
    if (!os?.features.tracking) return problem(404, "not_found", "no such route");
    const p = kit.findPlayer(seg[1]);
    if (!p) return problem(404, "not_found", "no such player");
    const turns = os.souls.filter((s) => s.uuid === p.uuid).map((s) => soulRow(os, s));
    const finished = new Set(os.rounds.filter((r) => r.ended_ago !== null).map((r) => r.cycle));
    // finished rounds only, like the total (API-EXPANSION §7.4)
    const per = new Map<number, number>();
    for (const pr of os.pranks.filter((x) => x.uuid === p.uuid && finished.has(x.cycle))) per.set(pr.cycle, (per.get(pr.cycle) ?? 0) + pr.count);
    const by_round = [...per].map(([cycle, count]) => ({ server: os.server, cycle, count }));
    const total = by_round.reduce((a, r) => a + r.count, 0);
    const ended = turns.filter((t) => t.duration_ms !== null);
    const best = ended.reduce<Soul | null>((a, s) => (!a || (s.duration_ms ?? 0) > (a.duration_ms ?? 0) ? s : a), null);
    const data: PlayerOneSoul = {
      uuid: p.uuid,
      name: p.name,
      turns,
      graves_claimed: os.graves.filter((g) => g.claimed_by?.uuid === p.uuid).length,
      graves_left_open: os.graves.filter((g) => !g.claimed_by && soulOf(os, g)?.uuid === p.uuid).length,
      journals: turns.filter((t) => t.has_journal).length,
      registrations: os.registrations.filter((r) => r.uuid === p.uuid).map((r) => ({ round: r.round, registered_at: at(r.registered_ago), played: r.played })),
      pranks: { total, by_round },
      best: best ? { duration_ms: best.duration_ms!, server: os.server, cycle: best.cycle, turn: best.turn } : null
    };
    return json(req, data);
  }

  if (seg[0] !== "onesoul") return null;
  if (!os) return problem(404, "not_found", "no such route");
  const sp = url.searchParams;
  const serverQ = sp.get("server");
  if (serverQ !== null && serverQ !== os.server) {
    // list routes: an unknown server is just empty; single-object routes: 404
    if (["souls", "graves", "events"].includes(seg[1] ?? "") && seg.length === 2) return json(req, { total: 0, [seg[1]]: [] });
    return problem(404, "not_found", "no such One Soul server");
  }
  const cycleQ = sp.get("cycle");
  const cycleParam = cycleQ === null ? null : Number(cycleQ);
  if (cycleParam !== null && !Number.isInteger(cycleParam)) return problem(400, "bad_request", "cycle must be an integer");
  const current = os.cycle;
  const roundOver = (c: number) => os.rounds.some((r) => r.cycle === c && r.ended_ago !== null);

  if (seg.length === 1) {
    const live = os.souls.find((s) => s.outcome === "playing");
    const reg = os.registrations.filter((r) => r.round === (["grace", "ended"].includes(os.state) ? current + 1 : current));
    const data: Status = {
      servers: [
        {
          server: os.server,
          display_name: os.display_name,
          cycle: current,
          state: os.state,
          soul: live
            ? {
                uuid: live.uuid,
                name: live.name,
                since: at(live.started_ago),
                phase: os.current?.phase ?? "alive",
                ...(os.current?.sc ? { deadline: now + os.current.sc.remaining_ms, ...os.current.sc } : {})
              }
            : null,
          waiting: Math.max(0, reg.length - reg.filter((r) => r.played).length),
          played: os.souls.filter((s) => s.cycle === current).length,
          registered: reg.length,
          spawn: os.state === "prep" || !os.spawn ? null : { dim: os.spawn.dim, x: os.spawn.x, y: os.spawn.y, z: os.spawn.z },
          grace_ends_at: os.state === "grace" && os.phase_ends_ago !== null ? at(os.phase_ends_ago) : null,
          prep_ends_at: os.state === "prep" && os.phase_ends_ago !== null ? at(os.phase_ends_ago) : null
        }
      ]
    };
    return json(req, data);
  }

  const route = seg[1];
  const off = () => problem(404, "not_found", "no such route");

  if (route === "live" && seg.length === 2) {
    if (!os.features.live) return off();
    const live = os.souls.find((s) => s.outcome === "playing");
    const reg = os.registrations.filter((r) => r.round === current);
    const inRound = os.souls.filter((s) => s.cycle === current);
    const ended = inRound.filter((s) => s.ended_ago !== null);
    const longest = ended.reduce<OsMockSoul | null>((a, s) => (!a || dur(s)! > dur(a)! ? s : a), null);
    const prev = ended.at(-1) ?? null;
    const round = os.rounds.find((r) => r.cycle === current);
    const gr = os.graves.filter((g) => g.cycle === current);
    const data: Live = {
      server: os.server,
      display_name: os.display_name,
      cycle: current,
      state: os.state,
      updated_at: now - 3_000,
      soul: live
        ? {
            uuid: live.uuid,
            name: live.name,
            turn: live.turn,
            since: at(live.started_ago),
            alive_ms: live.started_ago,
            phase: os.current?.phase ?? "alive",
            online: os.current?.online ?? false,
            realm: os.current?.realm ?? "overworld",
            second_chance: os.current?.sc ? { deadline: now + os.current.sc.remaining_ms, ...os.current.sc } : null,
            headline: headline(live),
            waystones: os.waystones.filter((w) => w.cycle === current && w.first_turn === live.turn).length
          }
        : null,
      round: {
        started_at: round?.started_ago != null ? at(round.started_ago) : null,
        prep_ends_at: os.state === "prep" && os.phase_ends_ago !== null ? at(os.phase_ends_ago) : null,
        grace_ends_at: os.state === "grace" && os.phase_ends_ago !== null ? at(os.phase_ends_ago) : null,
        waiting: Math.max(0, reg.length - reg.filter((r) => r.played).length),
        played: inRound.length,
        registered: reg.length,
        graves: { total: gr.length, claimed: gr.filter((g) => g.claimed_by).length },
        longest: longest ? { uuid: longest.uuid, name: longest.name, turn: longest.turn, duration_ms: dur(longest)! } : null,
        scope: `round:${os.server}/${current}`
      },
      previous: prev
        ? {
            uuid: prev.uuid,
            name: prev.name,
            turn: prev.turn,
            duration_ms: dur(prev),
            cause: prev.cause,
            damage_type: prev.damage_type,
            grave_id: prev.grave_id,
            grave_claimed: !!os.graves.find((g) => g.id === prev.grave_id)?.claimed_by,
            has_journal: !!prev.journal
          }
        : null,
      recent: events(os, now).filter((e) => e.cycle === current).slice(0, 5)
    };
    return json(req, data);
  }

  if (route === "rounds") {
    if (!os.features.tracking) return off();
    if (seg.length === 2) {
      const pg = kit.paging(url);
      if (pg instanceof Response) return pg;
      const rows = [...os.rounds].sort((a, b) => b.cycle - a.cycle).map((r) => roundRow(os, r.cycle, now));
      const data: RoundList = { total: rows.length, rounds: rows.slice(pg.offset, pg.offset + pg.limit) };
      return json(req, data);
    }
    if (seg.length === 3) {
      const c = Number(seg[2]);
      if (!os.rounds.some((r) => r.cycle === c)) return problem(404, "not_found", "no such round");
      const data: RoundDetail = { ...roundRow(os, c, now), records: records(os, c) };
      return json(req, data);
    }
  }

  if (route === "souls") {
    if (seg.length === 2) {
      const pg = kit.paging(url);
      if (pg instanceof Response) return pg;
      let rows = os.souls.map((s) => soulRow(os, s));
      if (cycleParam !== null) rows = rows.filter((s) => s.cycle === cycleParam);
      if (os.features.tracking) {
        const uuid = sp.get("uuid");
        const outcome = sp.get("outcome");
        if (uuid) rows = rows.filter((s) => s.uuid.replace(/-/g, "") === uuid.replace(/-/g, ""));
        if (outcome) rows = rows.filter((s) => outcome.split(",").includes(s.outcome));
        const sort = sp.get("sort") ?? "turn";
        const desc = sp.get("order") === "desc";
        const key = (s: Soul) => (sort === "duration" ? (s.duration_ms ?? -1) : sort === "started" ? s.started_at : s.cycle * 10_000 + s.turn);
        rows.sort((a, b) => (desc ? key(b) - key(a) : key(a) - key(b)));
      } else {
        rows = rows.map(({ second_chance_result: _a, waited_ms: _b, stats_ready: _c, ...r }) => ({ ...r, death: r.death ? { dim: r.death.dim, x: r.death.x, y: r.death.y, z: r.death.z } : null }));
      }
      const data: SoulList = { total: rows.length, souls: rows.slice(pg.offset, pg.offset + pg.limit) };
      return json(req, data);
    }
    if (!os.features.tracking && !(seg.length === 4 && seg[3] === "trail" && os.features.map)) return off();
    const c = cycleParam ?? current;
    const s = os.souls.find((x) => x.cycle === c && x.turn === Number(seg[2]));
    if (seg.length === 3) {
      if (!s) return problem(404, "not_found", "no such soul");
      const g = os.graves.find((x) => x.id === s.grave_id);
      const data: SoulDetail = {
        ...soulRow(os, s),
        headline: headline(s),
        grave: g ? graveRow(os, g, now) : null,
        waystones: os.waystones.filter((w) => w.cycle === s.cycle && w.first_turn === s.turn).length,
        has_trail: s.outcome !== "playing" && s.trail.length > 0 && os.features.map
      };
      return json(req, data);
    }
    if (seg[3] === "stats" && seg.length === 4) {
      if (!s) return problem(404, "not_found", "no such soul");
      const pg = kit.paging(url);
      if (pg instanceof Response) return pg;
      const typeF = sp.get("type");
      const rows = s.stats.filter((x) => !typeF || x.type === (typeF.includes(":") ? typeF : `minecraft:${typeF}`)).map((x) => kit.statRow(x.type, x.subject, x.value));
      const data: SoulStats = { total: rows.length, final: s.outcome !== "playing", stats: rows.slice(pg.offset, pg.offset + pg.limit) };
      return json(req, data);
    }
    if (seg[3] === "trail" && seg.length === 4) {
      if (!os.features.map) return off();
      // a living soul's trail answers exactly like an unknown turn (API-EXPANSION §7.2)
      if (!s || s.outcome === "playing" || !s.trail.length) return problem(404, "not_found", "no such trail");
      const data: Trail = {
        server: os.server,
        cycle: s.cycle,
        soul: { uuid: s.uuid, name: s.name, turn: s.turn },
        interval_ms: 30_000,
        thinned: false,
        segments: s.trail.map((t) => ({ dim: t.dim, started_at: at(t.points[0][0]), ended_at: at(t.points.at(-1)![0]), points: t.points.map(([a, x, y, z]) => [at(a), x, y, z]) }))
      };
      return json(req, data);
    }
  }

  if (route === "graves" && seg.length === 2) {
    const pg = kit.paging(url);
    if (pg instanceof Response) return pg;
    let rows = [...os.graves].sort((a, b) => a.created_ago - b.created_ago).map((g) => graveRow(os, g, now));
    if (cycleParam !== null) rows = rows.filter((g) => g.cycle === cycleParam);
    const claimed = sp.get("claimed");
    if (claimed === "true" || claimed === "false") rows = rows.filter((g) => !!g.claimed_by === (claimed === "true"));
    if (os.features.tracking) {
      const by = sp.get("claimed_by");
      const soul = sp.get("soul");
      if (by) rows = rows.filter((g) => g.claimed_by?.uuid === by);
      if (soul) rows = rows.filter((g) => g.soul.uuid === soul);
    } else rows = rows.map(({ contents: _c, marked: _m, ...g }) => g);
    const data: GraveList = { total: rows.length, graves: rows.slice(pg.offset, pg.offset + pg.limit) };
    return json(req, data);
  }

  if (route === "journals" && seg.length === 3) {
    const latestWithSouls = Math.max(0, ...os.souls.map((s) => s.cycle));
    const c = cycleParam ?? latestWithSouls;
    const s = os.souls.find((x) => x.cycle === c && x.turn === Number(seg[2]));
    // one 404 for everything: living soul, nothing published, unknown turn
    if (!s || !s.journal || s.outcome === "playing") return problem(404, "not_found", "no journal");
    const data: Journal = { server: os.server, soul: { uuid: s.uuid, name: s.name, turn: s.turn, cycle: s.cycle }, title: s.journal.title, pages: s.journal.pages, published_at: at(s.journal.published_ago) };
    return json(req, data);
  }

  if (route === "registrations" && seg.length === 2) {
    const pg = kit.paging(url);
    if (pg instanceof Response) return pg;
    const rq = sp.get("round");
    const round = rq === null ? (["grace", "ended"].includes(os.state) ? current + 1 : current) : Number(rq);
    // by sign-up time, never the queue
    const rows = os.registrations.filter((r) => r.round === round).sort((a, b) => b.registered_ago - a.registered_ago);
    const data: Registrations = { round, total: rows.length, players: rows.slice(pg.offset, pg.offset + pg.limit).map((r) => ({ uuid: r.uuid, name: r.name, registered_at: at(r.registered_ago), played: r.played })) };
    return json(req, data);
  }

  if (route === "events" && seg.length === 2) {
    const pg = kit.paging(url);
    if (pg instanceof Response) return pg;
    let rows = events(os, now);
    if (!os.features.tracking) rows = rows.filter((e) => !["offering", "second_chance_ended", "waystone_activated", "waystone_removed"].includes(e.kind));
    if (cycleParam !== null) rows = rows.filter((e) => e.cycle === cycleParam);
    const since = sp.get("since");
    if (since) rows = rows.filter((e) => e.at >= Number(since));
    if (os.features.tracking) {
      const uuid = sp.get("uuid");
      const kind = sp.get("kind");
      if (uuid) rows = rows.filter((e) => e.uuid === uuid);
      if (kind) rows = rows.filter((e) => kind.split(",").includes(e.kind));
    }
    const data: EventList = { total: rows.length, events: rows.slice(pg.offset, pg.offset + pg.limit) };
    return json(req, data);
  }

  if (route === "pranks" && seg.length === 2) {
    if (!os.features.tracking) return off();
    const c = cycleParam ?? current;
    if (!roundOver(c)) return problem(404, "not_found", "pranks are served for finished rounds only");
    const ghosts = new Map<string, Pranks["ghosts"][number]>();
    for (const p of os.pranks.filter((x) => x.cycle === c)) {
      const g = ghosts.get(p.uuid) ?? { uuid: p.uuid, name: p.name, total: 0, kinds: {} };
      g.total += p.count;
      g.kinds[p.kind] = (g.kinds[p.kind] ?? 0) + p.count;
      ghosts.set(p.uuid, g);
    }
    const data: Pranks = { server: os.server, cycle: c, ghosts: [...ghosts.values()].sort((a, b) => b.total - a.total) };
    return json(req, data);
  }

  if (route === "waystones" && seg.length === 2) {
    if (!os.features.map) return off();
    const c = cycleParam ?? current;
    const rows = os.waystones.filter((w) => w.cycle === c).map((w) => waystoneRow(os, w, now));
    const data: Waystones = { total: rows.length, waystones: rows };
    return json(req, data);
  }

  if (route === "map") {
    if (!os.features.map) return off();
    const c = cycleParam ?? current;
    const layers = mapLayers(os, c, now);
    if (seg.length === 2) {
      const dims = [...new Set(Object.values(layers).flatMap((fs) => fs.map((f) => String(f.properties.dim))))].sort();
      const titles: Record<string, string> = { spawn: "Spawn", deaths: "Deaths", graves: "Graves", waystones: "Waystones", trails: "Trails" };
      const data: MapIndex = {
        server: os.server,
        cycle: c,
        crs: CRS,
        dims,
        layers: Object.entries(layers).map(([id, fs]) => ({ id, title: titles[id], features: fs.length, updated_at: now - 60_000, href: `/v2/onesoul/map/${id}?cycle=${c}` }))
      };
      return json(req, data);
    }
    if (seg.length === 3) {
      const fs = layers[seg[2]];
      if (!fs) return problem(404, "not_found", "no such layer");
      const dim = sp.get("dim");
      const data: FeatureCollection = { type: "FeatureCollection", crs: CRS, features: dim ? fs.filter((f) => f.properties.dim === dim) : fs };
      return json(req, data);
    }
  }

  return off();
}

function dur(s: OsMockSoul): number | null {
  return s.ended_ago === null ? null : s.started_ago - s.ended_ago;
}

function soulOf(os: OneSoulWorld, g: OsMockGrave): OsMockSoul | undefined {
  return os.souls.find((s) => s.cycle === g.cycle && s.turn === g.turn);
}

function soulRow(os: OneSoulWorld, s: OsMockSoul): Soul {
  const now = Date.now();
  const playing = s.outcome === "playing";
  return {
    server: os.server,
    turn: s.turn,
    cycle: s.cycle,
    uuid: s.uuid,
    name: s.name,
    started_at: now - s.started_ago,
    ended_at: s.ended_ago === null ? null : now - s.ended_ago,
    duration_ms: dur(s),
    cause: s.cause,
    death: s.death ? { ...s.death, damage_type: s.damage_type, killer: s.killer, reason: s.reason } : null,
    second_chance: s.second_chance,
    outcome: s.outcome,
    grave_id: s.grave_id,
    has_journal: !playing && !!s.journal,
    second_chance_result: s.sc_result,
    waited_ms: playing ? null : s.waited_ms,
    stats_ready: true
  };
}

function graveRow(os: OneSoulWorld, g: OsMockGrave, now: number): Grave {
  const s = soulOf(os, g);
  return {
    id: g.id,
    server: os.server,
    cycle: g.cycle,
    soul: { uuid: s?.uuid ?? "", name: s?.name ?? "", turn: g.turn },
    dim: g.dim,
    x: g.x,
    y: g.y,
    z: g.z,
    items: g.items,
    created_at: now - g.created_ago,
    claimed_by: g.claimed_by,
    claimed_at: g.claimed_ago === null ? null : now - g.claimed_ago,
    contents: g.contents,
    marked: g.marked
  };
}

function waystoneRow(os: OneSoulWorld, w: OneSoulWorld["waystones"][number], now: number): Waystone {
  const s = os.souls.find((x) => x.cycle === w.cycle && x.turn === w.first_turn);
  return {
    id: w.id,
    label: w.label,
    origin: w.origin,
    dim: w.dim,
    x: w.x,
    y: w.y,
    z: w.z,
    first_by: s ? { uuid: s.uuid, name: s.name, turn: s.turn } : null,
    first_at: now - w.first_ago,
    visits: w.visits,
    removed_at: w.removed_ago === null ? null : now - w.removed_ago
  };
}

function headline(s: OsMockSoul) {
  const sum = (f: (x: { type: string; subject: string }) => boolean) => s.stats.filter(f).reduce((a, x) => a + x.value, 0);
  const mined = sum((x) => x.type === "minecraft:mined");
  const killed = sum((x) => x.type === "minecraft:killed");
  const walk = sum((x) => x.subject === "minecraft:walk_one_cm");
  const biomes = s.stats.filter((x) => x.type === "cakeutils:entered_biome").length;
  const dims = 1 + s.stats.filter((x) => x.type === "cakeutils:entered_dimension").length;
  return [
    { id: "blocks_mined", title: "Blocks mined", value: mined, display: mined.toLocaleString("en-GB") },
    { id: "mobs_killed", title: "Mobs killed", value: killed, display: String(killed) },
    { id: "distance", title: "Distance", value: walk, display: walk >= 100_000 ? `${(walk / 100_000).toFixed(1)} km` : `${Math.round(walk / 100)} m` },
    { id: "biomes", title: "Biomes found", value: biomes, display: String(biomes) },
    { id: "dimensions", title: "Dimensions", value: dims, display: String(dims) }
  ];
}

function roundRow(os: OneSoulWorld, c: number, now: number): Round {
  const r = os.rounds.find((x) => x.cycle === c)!;
  const souls = os.souls.filter((s) => s.cycle === c);
  const ended = souls.filter((s) => s.ended_ago !== null);
  const longest = ended.reduce<OsMockSoul | null>((a, s) => (!a || dur(s)! > dur(a)! ? s : a), null);
  const gr = os.graves.filter((g) => g.cycle === c);
  const over = r.ended_ago !== null;
  const state = over ? "ended" : c === os.cycle ? os.state : "ended";
  return {
    server: os.server,
    cycle: c,
    state,
    prep_started_at: now - r.prep_started_ago,
    started_at: r.started_ago === null ? null : now - r.started_ago,
    ended_at: r.ended_ago === null ? null : now - r.ended_ago,
    seed: over ? r.seed : null, // a seed maps the live world: only once the round is over
    archive: r.archive,
    registered: os.registrations.filter((x) => x.round === c).length,
    souls: souls.length,
    total_survival_ms: souls.reduce((a, s) => a + (s.ended_ago === null ? s.started_ago : dur(s)!), 0),
    longest: longest ? { uuid: longest.uuid, name: longest.name, turn: longest.turn, duration_ms: dur(longest)! } : null,
    graves: { total: gr.length, claimed: gr.filter((g) => g.claimed_by).length },
    deaths: souls.filter((s) => s.outcome === "died").length,
    scope: `round:${os.server}/${c}`
  };
}

function records(os: OneSoulWorld, c: number) {
  const ended = os.souls.filter((s) => s.cycle === c && s.ended_ago !== null);
  const best = (title: string, id: string, f: (s: OsMockSoul) => number, show: (v: number) => string) => {
    const b = ended.reduce<OsMockSoul | null>((a, s) => (!a || f(s) > f(a) ? s : a), null);
    return b ? [{ id, title, uuid: b.uuid, name: b.name, turn: b.turn, value: f(b), display: show(f(b)) }] : [];
  };
  const mined = (s: OsMockSoul) => s.stats.filter((x) => x.type === "minecraft:mined").reduce((a, x) => a + x.value, 0);
  const biomes = (s: OsMockSoul) => s.stats.filter((x) => x.type === "cakeutils:entered_biome").length;
  const walked = (s: OsMockSoul) => s.stats.filter((x) => x.subject === "minecraft:walk_one_cm").reduce((a, x) => a + x.value, 0);
  return [
    ...best("Most blocks mined in one life", "most_mined", mined, (v) => v.toLocaleString("en-GB")),
    ...best("Farthest walked", "farthest_walked", walked, (v) => `${(v / 100_000).toFixed(1)} km`),
    ...best("Most biomes", "most_biomes", biomes, String)
  ];
}

/** The timeline, newest first, the way the proxy builds it (pranks folded, positions masked while they would help the soul). */
export function events(os: OneSoulWorld, now: number): OsEvent[] {
  const out: OsEvent[] = [];
  const ev = (ago: number, cycle: number, kind: string, who: { uuid: string; name: string } | null, data: Record<string, unknown> = {}) =>
    out.push({ at: now - ago, server: os.server, cycle, kind, uuid: who?.uuid ?? null, name: who?.name ?? null, data });
  for (const r of os.rounds) {
    ev(r.prep_started_ago, r.cycle, "prep_started", null, { ends_at: now - r.prep_started_ago + 3 * DAY });
    if (r.started_ago !== null) {
      ev(r.started_ago + 1, r.cycle, "prep_ended", null, { outcome: "started", souls: os.registrations.filter((x) => x.round === r.cycle).length });
      ev(r.started_ago, r.cycle, "round_started", null, r.ended_ago !== null && r.seed ? { seed: r.seed } : {});
    }
    if (r.ended_ago !== null) ev(r.ended_ago, r.cycle, "round_ended", null, { archive: r.archive });
  }
  for (const s of os.souls) {
    const who = { uuid: s.uuid, name: s.name };
    ev(s.started_ago, s.cycle, "soul_chosen", who);
    if (s.second_chance) {
      const scAt = s.ended_ago === null ? s.started_ago / 3 : s.ended_ago + 2 * 3_600_000;
      // the non-final death that opened Borrowed Time: its position stays masked while the soul plays
      const masked = s.outcome === "playing";
      ev(scAt + 1, s.cycle, "death", who, { cause: `${s.name} was slain by Piglin`, final: false, duration_ms: s.started_ago - scAt, ...(masked ? {} : { dim: "minecraft:the_nether", x: -12, y: 70, z: 33 }) });
      ev(scAt, s.cycle, "second_chance", who, { variant: s.second_chance, deadline: now - scAt + 3_600_000 });
      ev(scAt - 600_000, s.cycle, "offering", who, { item: "minecraft:diamond_pickaxe", added_ms: 840_000 });
      if (s.sc_result) ev(s.ended_ago! + 1, s.cycle, "second_chance_ended", who, { ...s.sc_result });
    }
    if (s.outcome === "skipped") {
      ev(s.ended_ago! + 6 * 3_600_000, s.cycle, "absence_warning", who, { left_ms: 6 * 3_600_000 });
      ev(s.ended_ago!, s.cycle, "absence_skip", who);
    }
    if (s.outcome === "died" && s.death) {
      ev(s.ended_ago!, s.cycle, "death", who, { cause: s.cause, ...s.death, duration_ms: dur(s), final: true, damage_type: s.damage_type, killer: s.killer, reason: s.reason });
    }
  }
  for (const g of os.graves) {
    const s = soulOf(os, g);
    const who = s ? { uuid: s.uuid, name: s.name } : null;
    ev(g.created_ago - 1, g.cycle, "grave_created", who, { grave_id: g.id, x: g.x, y: g.y, z: g.z, dim: g.dim, items: g.items });
    if (g.claimed_by && g.claimed_ago !== null) ev(g.claimed_ago, g.cycle, "grave_claimed", g.claimed_by, { grave_id: g.id, by: g.claimed_by.uuid, by_name: g.claimed_by.name });
  }
  for (const w of os.waystones) {
    const s = os.souls.find((x) => x.cycle === w.cycle && x.turn === w.first_turn);
    ev(w.first_ago, w.cycle, "waystone_activated", s ? { uuid: s.uuid, name: s.name } : null, { waystone: w.id, label: w.label, origin: w.origin, dim: w.dim, x: w.x, y: w.y, z: w.z });
    if (w.removed_ago !== null) ev(w.removed_ago, w.cycle, "waystone_removed", null, { waystone: w.id });
  }
  if (os.spawn) {
    const s = os.souls.find((x) => x.cycle === os.cycle && x.turn === os.spawn!.set_turn);
    ev(os.spawn.set_ago, os.cycle, "spawn_moved", s ? { uuid: s.uuid, name: s.name } : null, { dim: os.spawn.dim, x: os.spawn.x, y: os.spawn.y, z: os.spawn.z });
  }
  // pranks: one row per ghost, round and UTC day, count only
  const folded = new Map<string, OsEvent>();
  for (const p of os.pranks) {
    const dayStart = Math.floor((now - p.day_ago) / DAY) * DAY;
    const k = `${p.cycle}|${p.uuid}|${dayStart}`;
    const e = folded.get(k) ?? { at: dayStart, server: os.server, cycle: p.cycle, kind: "prank", uuid: p.uuid, name: p.name, data: { count: 0 } };
    e.data.count = (e.data.count as number) + p.count;
    folded.set(k, e);
  }
  out.push(...folded.values());
  return out.sort((a, b) => b.at - a.at);
}

function mapLayers(os: OneSoulWorld, c: number, now: number): Record<string, Feature[]> {
  const pt = (x: number, z: number, y: number) => ({ type: "Point" as const, coordinates: [x, z, y] as [number, number, number] });
  const souls = os.souls.filter((s) => s.cycle === c);
  return {
    spawn:
      os.spawn && c === os.cycle && os.state !== "prep"
        ? [{ type: "Feature", id: "spawn", geometry: pt(os.spawn.x, os.spawn.z, os.spawn.y), properties: { kind: "spawn", dim: os.spawn.dim, set_at: now - os.spawn.set_ago } }]
        : [],
    deaths: souls
      .filter((s) => s.outcome !== "playing" && s.death)
      .map((s) => ({
        type: "Feature" as const,
        id: `death-${s.cycle}-${s.turn}`,
        geometry: pt(s.death!.x, s.death!.z, s.death!.y),
        properties: { kind: "death", dim: s.death!.dim, uuid: s.uuid, name: s.name, turn: s.turn, at: now - (s.ended_ago ?? 0), cause: s.cause, damage_type: s.damage_type, killer: s.killer, reason: s.reason, final: true }
      })),
    graves: os.graves
      .filter((g) => g.cycle === c)
      .map((g) => {
        const s = soulOf(os, g);
        return {
          type: "Feature" as const,
          id: g.id,
          geometry: pt(g.x, g.z, g.y),
          properties: { kind: "grave", dim: g.dim, id: g.id, soul: { uuid: s?.uuid, name: s?.name, turn: g.turn }, items: g.items, claimed: !!g.claimed_by, claimed_by: g.claimed_by, created_at: now - g.created_ago }
        };
      }),
    waystones: os.waystones
      .filter((w) => w.cycle === c)
      .map((w) => ({ type: "Feature" as const, id: w.id, geometry: pt(w.x, w.z, w.y), properties: { kind: "waystone", ...waystoneRow(os, w, now) } })),
    // a living soul's trail is never served (API-EXPANSION §7.2)
    trails: souls
      .filter((s) => s.outcome !== "playing")
      .flatMap((s) =>
        s.trail.map((t, i) => ({
          type: "Feature" as const,
          id: `trail-${s.cycle}-${s.turn}-${i}`,
          geometry: { type: "LineString" as const, coordinates: t.points.map(([, x, y, z]) => [x, z, y] as [number, number, number]) },
          properties: { kind: "trail", dim: t.dim, uuid: s.uuid, name: s.name, turn: s.turn, outcome: s.outcome, started_at: now - t.points[0][0], ended_at: now - t.points.at(-1)![0], times: t.points.map(([a]) => now - a) }
        }))
      )
  };
}
