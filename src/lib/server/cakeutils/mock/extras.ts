// Mock answers for the planned network routes (API-EXPANSION §4): firsts, criteria, deaths, activity,
// playtime milestones and board history. Built from the world's players on every call, deterministic per
// player (a seeded generator), times relative to now. The standalone (One Soul) servers never appear, as
// cakeutils promises; network reads also honour `exclude=` through the world the caller passes.
import type { World, WorldPlayer } from "./world.ts";
import type { Kit } from "../../onesoul/mock/handler.ts";

const H = 3_600_000;
const DAY = 24 * H;

function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Scope = { kind: "network" } | { kind: "server"; id: string };

const regular = (w: World) => w.servers.filter((s) => !(w.standalone ?? []).includes(s.id)).map((s) => s.id);
/** a player's play time in a scope: one server, or the network (between-server time included) */
function played(w: World, p: WorldPlayer, s: Scope): number {
  if (s.kind === "server") return p.playtime.by_server[s.id] ?? 0;
  return regular(w).reduce((a, id) => a + (p.playtime.by_server[id] ?? 0), 0) + p.playtime.between_ms;
}

const CAUSES: [string, string, string | null][] = [
  ["{n} fell from a high place", "minecraft:fall", null],
  ["{n} was slain by Zombie", "minecraft:mob_attack", "minecraft:zombie"],
  ["{n} was shot by Skeleton", "minecraft:arrow", "minecraft:skeleton"],
  ["{n} was blown up by Creeper", "minecraft:explosion", "minecraft:creeper"],
  ["{n} tried to swim in lava", "minecraft:lava", null],
  ["{n} drowned", "minecraft:drown", null],
  ["{n} burned to death", "minecraft:on_fire", null],
  ["{n} hit the ground too hard", "minecraft:fall", null]
];
const DIMS = ["minecraft:overworld", "minecraft:overworld", "minecraft:overworld", "minecraft:the_nether", "minecraft:the_end"];

function deaths(w: World, s: Scope) {
  const out: Record<string, unknown>[] = [];
  const t = Date.now();
  const servers = regular(w).filter((id) => s.kind === "network" || id === s.id);
  for (const p of w.players) {
    const r = rng(`death:${p.uuid}`);
    for (const id of servers) {
      const hours = (p.playtime.by_server[id] ?? 0) / H;
      const n = Math.min(6, Math.floor(hours / 8));
      for (let i = 0; i < n; i++) {
        const [cause, dt, killer] = CAUSES[Math.floor(r() * CAUSES.length)];
        const other = r() < 0.12 ? w.players[Math.floor(r() * w.players.length)] : null;
        const pvp = other && other.uuid !== p.uuid;
        out.push({
          at: t - Math.floor(r() * Math.min(p.first_seen_ago_ms, 40 * DAY)),
          uuid: p.uuid,
          name: p.name,
          server: id,
          cause: pvp ? `${p.name} was slain by ${other.name}` : cause.replace("{n}", p.name),
          damage_type: pvp ? "minecraft:player_attack" : dt,
          killer: pvp ? "minecraft:player" : killer,
          killer_player: pvp ? { uuid: other.uuid, name: other.name } : null,
          dim: DIMS[Math.floor(r() * DIMS.length)],
          pos: null,
          imported: false
        });
      }
    }
  }
  return out.sort((a, b) => (b.at as number) - (a.at as number));
}

const THRESHOLDS: [number, string][] = [[H, "1 h"], [10 * H, "10 h"], [100 * H, "100 h"], [1000 * H, "1000 h"], [10000 * H, "10000 h"]];

/** when a player crossed each threshold, assuming their time grew evenly since they first joined */
function crossed(w: World, p: WorldPlayer, s: Scope) {
  const total = played(w, p, s);
  const t = Date.now();
  const since = w.milestones_since_ago_ms;
  return THRESHOLDS.filter(([ms]) => total >= ms).map(([ms, display]) => {
    const ago = Math.round(p.first_seen_ago_ms * (1 - ms / total)) + p.last_seen_ago_ms;
    return { threshold_ms: ms, display, reached_at: ago > since ? null : t - ago, backfilled: ago > since, _ago: ago };
  });
}

function playtimeMilestones(w: World, s: Scope) {
  const rows = w.players.flatMap((p) => crossed(w, p, s).map(({ _ago, ...m }) => ({ ...m, uuid: p.uuid, name: p.name, _ago })));
  return rows.sort((a, b) => (a.reached_at === null ? 1 : 0) - (b.reached_at === null ? 1 : 0) || a._ago - b._ago).map(({ _ago, ...r }) => r);
}

function firstToThreshold(w: World, s: Scope) {
  const firsts = new Map<number, { p: WorldPlayer; ago: number }>();
  for (const p of w.players)
    for (const m of crossed(w, p, s)) {
      const f = firsts.get(m.threshold_ms);
      if (!f || m._ago > f.ago) firsts.set(m.threshold_ms, { p, ago: m._ago });
    }
  return firsts;
}

const TITLES: Record<string, string> = {
  "minecraft:adventure/adventuring_time": "Adventuring Time",
  "minecraft:husbandry/balanced_diet": "A Balanced Diet",
  "minecraft:adventure/kill_all_mobs": "Monsters Hunted",
  "minecraft:nether/explore_nether": "Hot Tourist Destinations"
};
const titleOf = (w: World, id: string) => w.advancement_titles.find((a) => a.id === id)?.title ?? TITLES[id] ?? id;
const CRITERIA: Record<string, string[]> = {
  "minecraft:adventure/adventuring_time": ["minecraft:plains", "minecraft:forest", "minecraft:desert", "minecraft:cherry_grove", "minecraft:mangrove_swamp", "minecraft:deep_dark", "minecraft:snowy_taiga"],
  "minecraft:husbandry/balanced_diet": ["apple", "bread", "cooked_beef", "golden_carrot", "honey_bottle", "pumpkin_pie"],
  "minecraft:adventure/kill_all_mobs": ["minecraft:zombie", "minecraft:skeleton", "minecraft:creeper", "minecraft:enderman", "minecraft:warden", "minecraft:blaze"],
  "minecraft:nether/explore_nether": ["minecraft:nether_wastes", "minecraft:crimson_forest", "minecraft:warped_forest", "minecraft:soul_sand_valley", "minecraft:basalt_deltas"]
};

function criteria(w: World, s: Scope, advancement: string | null) {
  const t = Date.now();
  const out: Record<string, unknown>[] = [];
  const servers = regular(w).filter((id) => s.kind === "network" || id === s.id);
  for (const [adv, list] of Object.entries(CRITERIA)) {
    if (advancement && adv !== advancement) continue;
    const title = titleOf(w, adv);
    list.forEach((c, i) => {
      const earners = w.players.filter((p) => servers.some((id) => (p.playtime.by_server[id] ?? 0) > (i + 1) * 5 * H));
      if (!earners.length) return;
      const r = rng(`crit:${adv}:${c}`);
      const first = earners[Math.floor(r() * earners.length)];
      out.push({ advancement: adv, title, criterion: c, uuid: first.uuid, name: first.name, server: servers[Math.floor(r() * servers.length)], earned_at: t - Math.floor(r() * 30 * DAY), imported: false, earners: earners.length });
    });
  }
  return out.sort((a, b) => (b.earned_at as number) - (a.earned_at as number));
}

const RARE: [string, string][] = [["minecraft:elytra", "Elytra"], ["minecraft:totem_of_undying", "Totem of Undying"], ["minecraft:netherite_ingot", "Netherite Ingot"], ["minecraft:beacon", "Beacon"]];
const DIM_FIRSTS: [string, string][] = [["minecraft:the_nether", "Entered the Nether"], ["minecraft:the_end", "Entered the End"]];

function firsts(w: World, s: Scope, kinds: string[] | null) {
  const t = Date.now();
  const out: Record<string, unknown>[] = [];
  const want = (k: string) => !kinds || kinds.includes(k);
  const servers = regular(w).filter((id) => s.kind === "network" || id === s.id);
  if (want("playtime"))
    for (const [ms, f] of firstToThreshold(w, s)) {
      const display = THRESHOLDS.find(([x]) => x === ms)![1];
      const back = f.ago > w.milestones_since_ago_ms;
      out.push({ kind: "playtime", at: back ? null : t - f.ago, uuid: f.p.uuid, name: f.p.name, server: null, title: `First to ${display} played`, detail: { threshold_ms: ms }, backfilled: back, imported: false });
    }
  if (want("criterion")) for (const c of criteria(w, s, null).slice(0, 8)) out.push({ kind: "criterion", at: c.earned_at, uuid: c.uuid, name: c.name, server: c.server, title: `${c.title}: ${String(c.criterion).replace(/^minecraft:/, "").replace(/_/g, " ")}`, detail: { advancement: c.advancement, criterion: c.criterion }, backfilled: false, imported: false });
  const r = rng(`firsts:${s.kind === "server" ? s.id : "network"}`);
  const active = w.players.filter((p) => servers.some((id) => (p.playtime.by_server[id] ?? 0) > 20 * H));
  if (active.length) {
    if (want("dimension"))
      for (const [dim, title] of DIM_FIRSTS) {
        const p = active[Math.floor(r() * active.length)];
        out.push({ kind: "dimension", at: t - Math.floor(r() * 35 * DAY), uuid: p.uuid, name: p.name, server: servers[0], title, detail: { dim }, backfilled: false, imported: false });
      }
    if (want("item"))
      for (const [item, label] of RARE.slice(0, Math.min(RARE.length, Math.ceil(active.length / 4)))) {
        const p = active[Math.floor(r() * active.length)];
        out.push({ kind: "item", at: t - Math.floor(r() * 25 * DAY), uuid: p.uuid, name: p.name, server: servers[Math.floor(r() * servers.length)], title: `First ${label}`, detail: { subject: item }, backfilled: false, imported: false });
      }
    if (want("biome")) {
      const p = active[Math.floor(r() * active.length)];
      out.push({ kind: "biome", at: t - Math.floor(r() * 20 * DAY), uuid: p.uuid, name: p.name, server: servers[0], title: "First into a Cherry Grove", detail: { subject: "minecraft:cherry_grove" }, backfilled: false, imported: false });
    }
  }
  return out.sort((a, b) => (a.at === null ? 1 : 0) - (b.at === null ? 1 : 0) || ((b.at as number) ?? 0) - ((a.at as number) ?? 0));
}

/** hours a player usually plays: a fixed evening window per player, so the heatmap has a shape */
function habit(p: WorldPlayer) {
  const r = rng(`habit:${p.uuid}`);
  return { start: 15 + Math.floor(r() * 7), len: 2 + Math.floor(r() * 4), weekend: r() < 0.6 };
}

function onlineSeries(w: World, s: Scope, bucket: string, since: number, until: number) {
  const step = bucket === "5m" ? 5 * 60_000 : bucket === "hour" ? H : DAY;
  const players = w.players.filter((p) => played(w, p, s) > 0);
  const out: { start: number; avg: number; max: number }[] = [];
  let peak = { at: 0, count: -1 };
  for (let t0 = Math.floor(since / step) * step; t0 < until; t0 += step) {
    let avg = 0;
    let max = 0;
    const hours = step >= DAY ? 24 : 1;
    for (let k = 0; k < hours; k++) {
      const d = new Date(t0 + k * H);
      const on = players.filter((p) => {
        const hb = habit(p);
        const h = d.getUTCHours();
        const wk = d.getUTCDay() === 0 || d.getUTCDay() === 6;
        const inWin = (h - hb.start + 24) % 24 < hb.len + (wk && hb.weekend ? 2 : 0);
        return inWin && rng(`${p.uuid}:${Math.floor((t0 + k * H) / H)}`)() < 0.7;
      }).length;
      avg += on / hours;
      max = Math.max(max, on);
    }
    out.push({ start: t0, avg: Math.round(avg * 10) / 10, max });
    if (max > peak.count) peak = { at: t0, count: max };
  }
  return { series: out, peak: peak.count >= 0 ? peak : null };
}

export function handleExtras(w: World, url: URL, seg: string[], req: Request, kit: Pick<Kit, "json" | "problem" | "paging">): Response | null {
  const key = seg.join("/");
  const known = ["firsts", "milestones/criteria", "deaths", "activity/playtime", "activity/heatmap", "activity/online", "milestones/playtime"];
  const isPlayer = seg[0] === "players" && seg.length === 3 && (seg[2] === "activity" || seg[2] === "advancement-criteria");
  const isHistory = seg[0] === "leaderboards" && seg[1] === "history";
  if (!known.includes(key) && !isPlayer && !isHistory) return null;
  if (w.extras === false) return kit.problem(404, "not_found", "no such route");

  const sc = url.searchParams.get("scope") ?? "network";
  let s: Scope;
  if (sc === "network") s = { kind: "network" };
  else if (sc.startsWith("server:") && regular(w).includes(sc.slice(7))) s = { kind: "server", id: sc.slice(7) };
  else if (sc.startsWith("server:")) return kit.problem(404, "not_found", "unknown scope");
  else return kit.problem(400, "bad_request", "scope must be network or server:<id> here");
  const num = (k: string, d: number) => {
    const v = url.searchParams.get(k);
    return v !== null && Number.isFinite(Number(v)) ? Number(v) : d;
  };
  const now = Date.now();
  const page = <T>(rows: T[], name: string, extra: Record<string, unknown> = {}) => {
    const pg = kit.paging(url);
    if (pg instanceof Response) return pg;
    return kit.json(req, { scope: sc, total: rows.length, [name]: rows.slice(pg.offset, pg.offset + pg.limit), ...extra });
  };

  if (isPlayer) {
    const p = w.players.find((x) => x.uuid === seg[1].toLowerCase() || x.name.toLowerCase() === seg[1].toLowerCase());
    if (!p) return kit.problem(404, "not_found", "no such player");
    if (seg[2] === "advancement-criteria") {
      const rows = criteria(w, s, url.searchParams.get("advancement"));
      const mine = Object.entries(CRITERIA).flatMap(([adv, list]) =>
        list
          .filter((_, i) => played(w, p, s) > (i + 1) * 5 * H)
          .map((c) => {
            const f = rows.find((r) => r.advancement === adv && r.criterion === c);
            return { advancement: adv, title: titleOf(w, adv), criterion: c, earned_at: f && f.uuid === p.uuid ? f.earned_at : now - Math.floor(rng(`${p.uuid}${c}`)() * 30 * DAY), imported: false, first: !!f && f.uuid === p.uuid };
          })
      );
      const pg = kit.paging(url);
      if (pg instanceof Response) return pg;
      return kit.json(req, { total: mine.length, criteria: mine.slice(pg.offset, pg.offset + pg.limit) });
    }
    const total = played(w, p, s);
    const r = rng(`act:${p.uuid}`);
    const sessions = total > 0 ? Math.max(1, Math.round(total / (1.6 * H))) : 0;
    const firstPerThreshold = firstToThreshold(w, s);
    return kit.json(req, {
      first_session_at: total > 0 ? now - p.first_seen_ago_ms : null,
      sessions,
      days_active: Math.min(Math.ceil(p.first_seen_ago_ms / DAY), Math.ceil(sessions * 0.7)),
      longest_session: total > 0 ? { started_at: now - Math.floor(r() * p.first_seen_ago_ms), ms: Math.min(total, Math.round((2 + r() * 6) * H)), server: s.kind === "server" ? s.id : regular(w)[Math.floor(r() * regular(w).length)] } : null,
      streak: total > 0 ? { current_days: p.last_seen_ago_ms < DAY ? 1 + Math.floor(r() * 6) : 0, best_days: 3 + Math.floor(r() * 12), best_ended: now - Math.floor(r() * 20 * DAY) } : null,
      playtime_milestones: crossed(w, p, s).map(({ _ago, ...m }) => ({ ...m, first: firstPerThreshold.get(m.threshold_ms)?.p.uuid === p.uuid }))
    });
  }

  switch (key) {
    case "firsts": {
      const k = url.searchParams.get("kinds");
      return page(firsts(w, s, k ? k.split(",") : null), "firsts");
    }
    case "milestones/criteria":
      return page(criteria(w, s, url.searchParams.get("advancement")), "criteria");
    case "deaths": {
      const pl = url.searchParams.get("player");
      return page(deaths(w, s).filter((d) => !pl || d.uuid === pl || (d.name as string).toLowerCase() === pl.toLowerCase()), "deaths");
    }
    case "milestones/playtime":
      return page(playtimeMilestones(w, s), "milestones");
    case "activity/online": {
      const bucket = url.searchParams.get("bucket") ?? "hour";
      if (!["5m", "hour", "day"].includes(bucket)) return kit.problem(400, "bad_request", "bucket must be 5m, hour or day");
      const until = num("until", now);
      const since = num("since", until - (bucket === "day" ? 30 * DAY : bucket === "hour" ? 2 * DAY : 6 * H));
      return kit.json(req, { scope: sc, bucket, ...onlineSeries(w, s, bucket, since, until) });
    }
    case "activity/playtime": {
      const bucket = url.searchParams.get("bucket") ?? "day";
      if (!["day", "week", "month"].includes(bucket)) return kit.problem(400, "bad_request", "bucket must be day, week or month");
      const until = num("until", now);
      const since = num("since", until - 30 * DAY);
      const { series } = onlineSeries(w, s, "day", since, until);
      const step = bucket === "day" ? 1 : bucket === "week" ? 7 : 30;
      const out: { start: number; ms: number; players: number }[] = [];
      for (let i = 0; i < series.length; i += step) {
        const chunk = series.slice(i, i + step);
        out.push({ start: chunk[0].start, ms: Math.round(chunk.reduce((a, x) => a + x.avg * DAY, 0)), players: Math.max(...chunk.map((x) => x.max)) + Math.round(chunk.length / 3) });
      }
      return kit.json(req, { scope: sc, bucket, series: out });
    }
    case "activity/heatmap": {
      const cells: [number, number, number][] = [];
      const players = w.players.filter((p) => played(w, p, s) > 0);
      for (let wd = 0; wd < 7; wd++)
        for (let h = 0; h < 24; h++) {
          let ms = 0;
          for (const p of players) {
            const hb = habit(p);
            const wk = wd >= 5;
            if ((h - hb.start + 24) % 24 < hb.len + (wk && hb.weekend ? 2 : 0)) ms += Math.round(H * 3 * 0.7);
          }
          cells.push([wd, h, ms]);
        }
      return kit.json(req, { scope: sc, cells });
    }
  }

  // board history: playtime and type totals are snapshotted; anything else is not tracked
  const lim = Math.min(10, Math.max(1, num("limit", 5)));
  const metric = seg.slice(2).join("/");
  const days = 14;
  const value = (p: WorldPlayer): number | null => {
    if (metric === "playtime") return played(w, p, s);
    const [type, subject] = [seg[2], seg[3]];
    if (subject !== "*") return null;
    const full = type.includes(":") ? type : `minecraft:${type}`;
    let v = 0;
    for (const [leaf, vals] of Object.entries(p.stats)) {
      if (leaf.startsWith("round:")) continue;
      if (s.kind === "server" && leaf !== `server:${s.id}` && !leaf.startsWith(`mini:${s.id}/`)) continue;
      if (s.kind === "network" && !regular(w).some((id) => leaf === `server:${id}` || leaf.startsWith(`mini:${id}/`))) continue;
      for (const [k, x] of Object.entries(vals)) if (k.startsWith(`${full}|`)) v += x;
    }
    return v;
  };
  if (metric !== "playtime" && seg[3] !== "*") return kit.json(req, { metric, scope: sc, tracked: false, days: [] });
  const unit = metric === "playtime" ? "ms" : "count";
  const out = [];
  for (let d = days - 1; d >= 0; d--) {
    const day = Math.floor((now - d * DAY) / DAY) * DAY;
    const entries = w.players
      .map((p) => ({ p, v: value(p) ?? 0 }))
      .filter((x) => x.v > 0)
      .map((x) => ({ p: x.p, v: Math.round(x.v * (1 - d * (0.02 + rng(`h:${x.p.uuid}`)() * 0.04))) }))
      .sort((a, b) => b.v - a.v)
      .slice(0, lim)
      .map((x, i) => ({ rank: i + 1, uuid: x.p.uuid, name: x.p.name, value: x.v, display: unit === "ms" ? `${Math.floor(x.v / H)}h ${Math.floor((x.v % H) / 60000)}m` : x.v.toLocaleString("en-GB") }));
    if (entries.length) out.push({ day, entries });
  }
  return kit.json(req, { metric, scope: sc, unit, tracked: true, days: out });
}
