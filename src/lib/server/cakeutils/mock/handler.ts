// The fixture server (PLAN §3.2): answers /v2 requests from a World exactly the way cakeutils does
// (API.md §2, §6; STATS §6; the D-109 brief for milestones): token required, problem+json errors,
// weak ETags with 304, max-age=5, 404 for never-recorded stats, empty lists for never-seen scopes,
// private minis answered like never-seen ones, custom:* → 400 mixed_units, and the three milestone
// routes behind a feature flag. Used in-process (index.ts) and over HTTP (scripts/mock-server.ts).
// Never loaded in production: hooks.server.ts refuses to start with FISHNET_MOCK set there.
import type {
  AdvancementDetail, AdvancementFeed, AdvancementHolder, AdvancementRow, BatchResponse, Leaderboard, MilestoneFeed, MilestoneFeedRow,
  MilestoneLadder, MilestoneRow, MiniServers, Network, PlayerAdvancements, PlayerList, PlayerMilestones, PlayerProfile, Playtime,
  StatList, StatRow, StatTypes, StatValue, Subject, SubjectDetail, SubjectList, Unit
} from "#lib/api/types.ts";
import { formatStat, durationMs } from "#lib/format/stat-display.ts";
import { fnv1a, hex, type World, type WorldPlayer, type WorldSubject } from "./world.ts";
import { handleExtras } from "./extras.ts";
import { handleOneSoul } from "../../onesoul/mock/handler.ts";

const SCOPE_RE = /^(network|server:[A-Za-z0-9._-]{1,64}|mini:[A-Za-z0-9._-]{1,64}\/[^/]{1,64}|round:[A-Za-z0-9._-]{1,64}\/[0-9]{1,9})$/;

export const COUNT_THRESHOLDS = [1, 10, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000];
export const DISTANCE_THRESHOLDS = [10_000, 50_000, 100_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000, 1_000_000_000];

type Values = Map<string, number>; // "type|subject" → value
type Rolled = {
  /** player uuid → scope → values */
  byPlayer: Map<string, Map<string, Values>>;
  recorded: Set<string>; // "type|subject" ever > 0 anywhere
  recordedTypes: Set<string>;
  subjectsByType: Map<string, Set<string>>;
};

const rolledCache = new WeakMap<World, Rolled>();

function rollup(world: World): Rolled {
  let r = rolledCache.get(world);
  if (r) return r;
  const byPlayer = new Map<string, Map<string, Values>>();
  const recorded = new Set<string>();
  const recordedTypes = new Set<string>();
  const subjectsByType = new Map<string, Set<string>>();
  const miniToServer = new Map(world.minis.map((m) => [`${m.server}/${m.id}`, m.server]));
  // standalone servers (API-EXPANSION M1) stay in their own scopes, never in the network
  const standalone = new Set(world.standalone ?? []);
  for (const p of world.players) {
    const scopes = new Map<string, Values>();
    const add = (scope: string, key: string, v: number) => {
      let bag = scopes.get(scope);
      if (!bag) scopes.set(scope, (bag = new Map()));
      bag.set(key, (bag.get(key) ?? 0) + v);
    };
    for (const [leaf, bag] of Object.entries(p.stats)) {
      for (const [key, v] of Object.entries(bag)) {
        if (v === 0) continue;
        recorded.add(key);
        const [type, subject] = key.split("|");
        recordedTypes.add(type);
        if (!subjectsByType.has(type)) subjectsByType.set(type, new Set());
        subjectsByType.get(type)!.add(subject);
        let server: string;
        if (leaf.startsWith("mini:")) {
          const m = leaf.slice(5);
          server = miniToServer.get(m) ?? m.split("/")[0];
          add(leaf, key, v);
          add(`server:${server}`, key, v);
        } else if (leaf.startsWith("round:")) {
          // a One Soul round is a breakdown of its server, like a mini (I3)
          server = leaf.slice(6).split("/")[0];
          add(leaf, key, v);
          add(`server:${server}`, key, v);
        } else {
          server = leaf.slice(7);
          add(leaf, key, v);
        }
        if (!standalone.has(server)) add("network", key, v);
      }
    }
    byPlayer.set(p.uuid, scopes);
  }
  r = { byPlayer, recorded, recordedTypes, subjectsByType };
  rolledCache.set(world, r);
  return r;
}

// ---- helpers

function problem(status: number, code: string, detail: string): Response {
  const titles: Record<number, string> = { 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 429: "Too Many Requests", 500: "Internal Server Error" };
  const body = JSON.stringify({ type: `urn:cakeutils:problem:${code}`, title: titles[status] ?? "Error", status, detail });
  const headers: Record<string, string> = { "content-type": "application/problem+json", "cache-control": "no-store" };
  if (status === 401) headers["www-authenticate"] = 'Bearer realm="cakeutils"';
  return new Response(body, { status, headers });
}

function json(req: Request, data: unknown): Response {
  const body = JSON.stringify(data);
  const etag = `W/"${hex(`etag:${body}`, 16)}"`;
  const headers = { "content-type": "application/json", "cache-control": "private, max-age=5", etag, "ratelimit-limit": "600", "ratelimit-remaining": "119" };
  const inm = req.headers.get("if-none-match");
  if (inm && (inm === "*" || inm.split(",").map((s) => s.trim().replace(/^W\//, "")).includes(etag.replace(/^W\//, "")))) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(req.method === "HEAD" ? null : body, { status: 200, headers });
}

function shortType(t: string): string {
  return t.startsWith("minecraft:") ? t.slice(10) : t;
}
function fullType(t: string): string {
  return t.includes(":") ? t : `minecraft:${t}`;
}

function paging(url: URL): { limit: number; offset: number } | Response {
  const l = url.searchParams.get("limit");
  const o = url.searchParams.get("offset");
  const limit = l === null ? 10 : Number(l);
  const offset = o === null ? 0 : Number(o);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return problem(400, "bad_request", "limit must be 1..100");
  if (!Number.isInteger(offset) || offset < 0 || offset > 1_000_000) return problem(400, "bad_request", "offset must be 0..1000000");
  return { limit, offset };
}

type ScopeInfo = { scope: string; seen: boolean; server?: string; mini?: string; round?: number };

function scopeOf(world: World, url: URL): ScopeInfo | Response {
  const s = url.searchParams.get("scope") ?? "network";
  if (!SCOPE_RE.test(s)) return problem(400, "bad_request", "scope must be network, server:<id> or mini:<server>/<mini>");
  if (s === "network") return { scope: s, seen: true };
  if (s.startsWith("round:")) {
    // round scopes exist on a proxy with WE-10 only; an older one answers 400 like any unknown scope kind
    if (!world.onesoul?.features.rounds_scope) return problem(400, "bad_request", "scope must be network, server:<id> or mini:<server>/<mini>");
    const [server, cycle] = s.slice(6).split("/");
    const seen = world.onesoul.server === server && world.onesoul.rounds.some((r) => r.cycle === Number(cycle) && r.started_ago !== null);
    return { scope: s, seen, server, round: Number(cycle) };
  }
  if (s.startsWith("server:")) {
    const id = s.slice(7);
    return { scope: s, seen: world.servers.some((x) => x.id === id), server: id };
  }
  const rest = s.slice(5);
  const [server, mini] = rest.split("/");
  const m = world.minis.find((x) => x.server === server && x.id === mini);
  // a private mini answers exactly like one that was never seen (D-68)
  return { scope: s, seen: !!m && m.public, server, mini };
}

function findPlayer(world: World, ref: string): WorldPlayer | undefined {
  const r = decodeURIComponent(ref).toLowerCase();
  const undashed = r.replace(/-/g, "");
  return world.players.find((p) => p.name.toLowerCase() === r || p.uuid.replace(/-/g, "") === undashed);
}

function subjectRow(world: World, subject: string, typeKind: string | null): WorldSubject | undefined {
  const rows = world.subjects.filter((s) => s.key === subject);
  return rows.find((s) => s.kind === typeKind) ?? rows.find((s) => s.kind === null) ?? rows[0];
}

function typeKind(world: World, type: string): string | null {
  return world.types.find((t) => t.key === type)?.kind ?? null;
}

function iconUrl(s: WorldSubject | undefined): string | null {
  return s?.icon ? `/v2/icons/${s.icon}.png` : null;
}

function statValue(world: World, type: string, subject: string, value: number): StatValue {
  const s = subjectRow(world, subject, typeKind(world, type));
  const unit = (subject === "*" ? "count" : (s?.unit ?? "count")) as StatValue["unit"];
  return { type, subject, name: s?.name ?? null, unit, value, display: formatStat(unit, value), icon: iconUrl(s) };
}

function valuesIn(world: World, p: WorldPlayer, scope: ScopeInfo): Values {
  if (!scope.seen) return new Map();
  return rollup(world).byPlayer.get(p.uuid)?.get(scope.scope) ?? new Map();
}

function playtimeOf(world: World, p: WorldPlayer, scope: ScopeInfo, excluded: string[] = []): Playtime {
  const publicMini = (k: string) => world.minis.some((m) => `${m.server}/${m.id}` === k && m.public);
  if (scope.round !== undefined) {
    const v = scope.seen ? (p.playtime.by_round?.[`${scope.server}/${scope.round}`] ?? 0) : 0;
    return { scope: scope.scope, excluded: [], total_ms: v, by_server: v ? { [scope.server!]: v } : {}, by_mini: {} };
  }
  if (scope.mini) {
    const v = scope.seen ? (p.playtime.by_mini[`${scope.server}/${scope.mini}`] ?? 0) : 0;
    return { scope: scope.scope, excluded: [], total_ms: v, by_server: {}, by_mini: v ? { [`${scope.server}/${scope.mini}`]: v } : {} };
  }
  if (scope.server) {
    const v = scope.seen ? (p.playtime.by_server[scope.server] ?? 0) : 0;
    const by_mini: Record<string, number> = {};
    for (const [k, ms] of Object.entries(p.playtime.by_mini)) if (k.startsWith(`${scope.server}/`) && publicMini(k)) by_mini[k] = ms;
    return { scope: scope.scope, excluded: [], total_ms: v, by_server: v ? { [scope.server]: v } : {}, by_mini: scope.seen ? by_mini : {} };
  }
  const standalone = new Set(world.standalone ?? []);
  const total = Object.entries(p.playtime.by_server).reduce((a, [id, ms]) => a + (standalone.has(id) ? 0 : ms), 0) + p.playtime.between_ms;
  const by_mini: Record<string, number> = {};
  for (const [k, ms] of Object.entries(p.playtime.by_mini)) if (publicMini(k)) by_mini[k] = ms;
  return { scope: "network", excluded, total_ms: total, by_server: { ...p.playtime.by_server }, by_mini };
}

const now = () => Date.now();

function profile(world: World, p: WorldPlayer, excluded: string[] = []): PlayerProfile {
  const t = now();
  return {
    uuid: p.uuid,
    name: p.name,
    online: p.online,
    server: p.online ? p.server : null,
    first_seen: t - p.first_seen_ago_ms,
    last_seen: t - p.last_seen_ago_ms,
    skin: p.online ? p.skin : null,
    prefix: p.online ? p.prefix : [],
    suffix: p.online ? p.suffix : [],
    playtime: playtimeOf(world, p, { scope: "network", seen: true }, excluded)
  };
}

/** Board values per player for a metric in a scope; null when the stat was never recorded. */
function boardValues(world: World, type: string, subject: string, scope: ScopeInfo): { unit: Unit; rows: { p: WorldPlayer; value: number }[] } | null {
  const r = rollup(world);
  if (!r.recordedTypes.has(type)) return null;
  if (subject !== "*" && !r.recorded.has(`${type}|${subject}`)) return null;
  const unit: Unit = subject === "*" ? "count" : (subjectRow(world, subject, typeKind(world, type))?.unit ?? "count");
  const rows: { p: WorldPlayer; value: number }[] = [];
  for (const p of world.players) {
    const vals = valuesIn(world, p, scope);
    let v = 0;
    if (subject === "*") {
      for (const [k, x] of vals) if (k.startsWith(`${type}|`)) v += x;
    } else {
      v = vals.get(`${type}|${subject}`) ?? 0;
    }
    if (v > 0) rows.push({ p, value: v });
  }
  rows.sort((a, b) => b.value - a.value || (a.p.uuid < b.p.uuid ? -1 : 1));
  return { unit, rows };
}

function thresholdsFor(unit: Unit): number[] | null {
  if (unit === "count") return COUNT_THRESHOLDS;
  if (unit === "distance_cm") return DISTANCE_THRESHOLDS;
  return null;
}

/** The ladder of one stat in a scope (never-recorded → null). Deterministic per (stat, scope). */
function ladder(world: World, type: string, subject: string, scope: ScopeInfo): MilestoneLadder | null {
  const b = boardValues(world, type, subject, scope);
  if (!b) return null;
  const metric = `${shortType(type)}:${subject}`;
  const ths = thresholdsFor(b.unit);
  if (!ths) return { metric, scope: scope.scope, unit: b.unit, tracked: false, milestones: [] };
  const top = b.rows[0];
  const reachedCount = top ? ths.filter((t) => top.value >= t).length : 0;
  const seed = fnv1a(`ms:${metric}:${scope.scope}`);
  const backfilled = reachedCount === 0 ? 0 : Math.min(reachedCount, seed % 4); // the first few were passed before tracking began
  const t = now();
  const since = t - world.milestones_since_ago_ms;
  const milestones: MilestoneRow[] = ths.map((threshold, i) => {
    const display = formatStat(b.unit, threshold);
    if (i >= reachedCount) return { threshold, display, uuid: null, name: null, reached_at: null, backfilled: false };
    if (i < backfilled) {
      // reached before tracking began: the API found it already passed; sometimes it still knows who
      const known = (seed >> (i + 3)) % 3 === 0 && top;
      return { threshold, display, uuid: known ? top.p.uuid : null, name: known ? top.p.name : null, reached_at: null, backfilled: true };
    }
    // whoever holds the highest value was first; higher rungs later; a little jitter per rung
    const holder = b.rows[Math.min(b.rows.length - 1, (i + seed) % Math.min(3, b.rows.length))];
    const first = holder.value >= threshold ? holder : top!;
    const frac = (i - backfilled + 1) / (reachedCount - backfilled + 1);
    const jitter = ((fnv1a(`${metric}:${i}`) % 1000) / 1000 - 0.5) * 0.2;
    const reached_at = Math.round(since + (t - since) * Math.min(0.98, Math.max(0.01, frac + jitter * frac)));
    return { threshold, display, uuid: first.p.uuid, name: first.p.name, reached_at, backfilled: false };
  });
  return { metric, scope: scope.scope, unit: b.unit, tracked: true, milestones };
}

function feedRows(world: World, scope: ScopeInfo, typeFilter: string | null): MilestoneFeedRow[] {
  const r = rollup(world);
  const out: MilestoneFeedRow[] = [];
  for (const [type, subjects] of r.subjectsByType) {
    if (typeFilter && fullType(typeFilter) !== type) continue;
    const kind = typeKind(world, type);
    for (const subject of subjects) {
      const l = ladder(world, type, subject, scope);
      if (!l || !l.tracked) continue;
      const s = subjectRow(world, subject, kind);
      for (const m of l.milestones) {
        if (!m.backfilled && m.reached_at === null) continue;
        out.push({ ...m, metric: l.metric, type, subject, stat_name: s?.name ?? null, unit: l.unit });
      }
    }
  }
  // newest first, backfilled last (then by threshold, so the order is stable)
  out.sort((a, b) => {
    if (a.backfilled !== b.backfilled) return a.backfilled ? 1 : -1;
    if (a.reached_at !== b.reached_at) return (b.reached_at ?? 0) - (a.reached_at ?? 0);
    return a.metric < b.metric ? -1 : a.metric > b.metric ? 1 : a.threshold - b.threshold;
  });
  return out;
}

// ---- advancement milestones (D-111): "first" is computed when read, like cakeutils does, so imported rows
// with old timestamps and live grants can be in any order. Per server: the earliest completion (ties: the
// lowest uuid); network: the earliest over all servers, `server` says where. `earners` counts the players who
// have it in the scope (distinct players in the network).

type AdvEarned = { p: WorldPlayer; server: string; ago: number };
type AdvIndex = Map<string, AdvEarned[]>; // advancement id → every completion on every server

const advCache = new WeakMap<World, AdvIndex>();

function advIndex(world: World): AdvIndex {
  let idx = advCache.get(world);
  if (idx) return idx;
  idx = new Map();
  for (const p of world.players) {
    for (const [server, bag] of Object.entries(p.advancements ?? {})) {
      for (const [id, ago] of Object.entries(bag)) {
        if (!idx.has(id)) idx.set(id, []);
        idx.get(id)!.push({ p, server, ago });
      }
    }
  }
  advCache.set(world, idx);
  return idx;
}

function advTitle(world: World, id: string): string {
  return world.advancement_titles.find((a) => a.id === id)?.title ?? "";
}

function fullAdvId(id: string): string {
  return id.includes(":") ? id : `minecraft:${id}`;
}

/** The first earner of one advancement in a scope (server id, or null for the network), or null when nobody has it there. */
function advFirst(world: World, rows: AdvEarned[], server: string | null): AdvancementHolder | null {
  const inScope = server === null ? rows : rows.filter((r) => r.server === server);
  if (inScope.length === 0) return null;
  let first = inScope[0];
  for (const r of inScope) if (r.ago > first.ago || (r.ago === first.ago && r.p.uuid < first.p.uuid)) first = r;
  const imported = first.ago > world.advancements_since_ago_ms && world.advancements_imported.includes(first.server);
  const earners = server === null ? new Set(inScope.map((r) => r.p.uuid)).size : inScope.length;
  return { uuid: first.p.uuid, name: first.p.name, server: first.server, earned_at: now() - first.ago, imported, earners };
}

/** Every advancement's first earner in a scope, newest first (then by id, so the order is stable). */
function advRows(world: World, scope: ScopeInfo): AdvancementRow[] {
  if (!scope.seen) return [];
  const out: AdvancementRow[] = [];
  for (const [id, rows] of advIndex(world)) {
    const h = advFirst(world, rows, scope.server ?? null);
    if (h) out.push({ advancement: id, title: advTitle(world, id), ...h });
  }
  out.sort((a, b) => b.earned_at - a.earned_at || (a.advancement < b.advancement ? -1 : 1));
  return out;
}

// ---- icons: a 16×16 PNG per sha, coloured from the hash (sharp, dev only)

const iconCache = new Map<string, Uint8Array>();
async function iconPng(sha: string): Promise<Uint8Array> {
  const hit = iconCache.get(sha);
  if (hit) return hit;
  const { default: sharp } = await import("sharp");
  const h = fnv1a(sha);
  const rgb = [80 + (h & 0x7f), 80 + ((h >> 8) & 0x7f), 80 + ((h >> 16) & 0x7f)];
  const px = Buffer.alloc(16 * 16 * 4);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) * 4;
      const edge = x < 2 || y < 2 || x > 13 || y > 13;
      const inner = !edge && x > 3 && y > 3 && x < 12 && y < 12;
      const f = edge ? 0.55 : inner ? 1.15 : 0.9;
      px[i] = Math.min(255, rgb[0] * f);
      px[i + 1] = Math.min(255, rgb[1] * f);
      px[i + 2] = Math.min(255, rgb[2] * f);
      px[i + 3] = (x + y) % 7 === 0 && !edge ? 200 : 255;
    }
  }
  const png = new Uint8Array(await sharp(px, { raw: { width: 16, height: 16, channels: 4 } }).png().toBuffer());
  iconCache.set(sha, png);
  return png;
}

// ---- the router

// ---- exclude= (cakeutils D-113): network figures without some servers. The world without those servers'
// stats, playtime and advancements rolls up to exactly "network minus them", like the proxy's subtraction.

const withoutCache = new WeakMap<World, Map<string, World>>();

function worldWithout(world: World, ex: string[]): World {
  if (!ex.length) return world;
  const key = ex.join(",");
  let byKey = withoutCache.get(world);
  if (!byKey) withoutCache.set(world, (byKey = new Map()));
  const hit = byKey.get(key);
  if (hit) return hit;
  const gone = new Set(ex);
  const onGone = (leaf: string) => {
    const m = /^(?:server:([^/]+)|mini:([^/]+)\/.+|round:([^/]+)\/.+)$/.exec(leaf);
    return !!m && gone.has(m[1] ?? m[2] ?? m[3]);
  };
  const w: World = {
    ...world,
    players: world.players.map((p) => {
      const by_server = Object.fromEntries(Object.entries(p.playtime.by_server).filter(([id]) => !gone.has(id)));
      const hadGone = Object.keys(p.playtime.by_server).some((id) => gone.has(id));
      return {
        ...p,
        stats: Object.fromEntries(Object.entries(p.stats).filter(([leaf]) => !onGone(leaf))),
        playtime: {
          by_server,
          by_mini: Object.fromEntries(Object.entries(p.playtime.by_mini).filter(([k]) => !gone.has(k.split("/")[0]))),
          // a player with time only on excluded servers leaves the network board, as on the proxy
          between_ms: hadGone && Object.keys(by_server).length === 0 ? 0 : p.playtime.between_ms
        },
        advancements: p.advancements ? Object.fromEntries(Object.entries(p.advancements).filter(([sv]) => !gone.has(sv))) : p.advancements
      };
    })
  };
  byKey.set(key, w);
  return w;
}

const EXCLUDE_RE = /^[A-Za-z0-9._-]{1,64}(,[A-Za-z0-9._-]{1,64}){0,31}$/;

export async function handleMock(world: World, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const exRaw = url.searchParams.get("exclude");
  if (exRaw !== null && !EXCLUDE_RE.test(exRaw)) return problem(400, "bad_request", "'exclude' must be server ids separated by commas");
  const ex = exRaw ? [...new Set(exRaw.split(","))].sort() : [];
  /** the world a network-scope read sees, and what it echoes in `excluded` */
  const networkScope = (url.searchParams.get("scope") ?? "network") === "network";
  const excluded = networkScope ? ex : [];
  const all = world;
  if (networkScope) world = worldWithout(world, ex);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/v2/health") return json(req, { status: "ok" });
  if (!path.startsWith("/v2")) return problem(404, "not_found", "no such route");

  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer cu_[A-Za-z0-9]+_[A-Za-z0-9_-]+$/.test(auth)) return problem(401, "unauthorized", "a bearer token is required");
  if (req.method !== "GET" && req.method !== "HEAD" && !(req.method === "POST" && path === "/v2/players:batch")) {
    return problem(404, "not_found", "no such route");
  }
  const seg = path.slice(4).split("/").filter(Boolean).map(decodeURIComponent);

  // One Soul (built and planned routes): its own world, its own rules
  const os = handleOneSoul(all.onesoul, req, url, seg, {
    json,
    problem,
    paging,
    statRow: (type, subject, value) => statValue(all, type, subject, value),
    findPlayer: (ref) => findPlayer(all, ref)
  });
  if (os) return os;

  // the planned network routes (firsts, deaths, activity, ...): network reads honour exclude= via `world`
  const ex2 = handleExtras(world, url, seg, req, { json, problem, paging });
  if (ex2) return ex2;

  if (seg[0] === "openapi.json" && seg.length === 1) {
    const { default: doc } = await import("../../../../../openapi.json", { with: { type: "json" } });
    return json(req, doc);
  }

  if (seg[0] === "network" && seg.length === 1) {
    world = all;
    const servers = world.servers.map((s) => ({
      id: s.id,
      display_name: s.display_name,
      online: world.players.filter((p) => p.online && p.server === s.id).length,
      waiting: s.waiting,
      mc_version: s.mc_version,
      platform: s.platform,
      // API-EXPANSION M1: only a proxy that has the flag sends it
      ...(world.standalone ? { standalone: world.standalone.includes(s.id), game: world.onesoul?.server === s.id ? "onesoul" : null } : {})
    }));
    const data: Network = { servers, total_online: world.players.filter((p) => p.online).length };
    return json(req, data);
  }

  if (seg[0] === "mini-servers" && seg.length === 1) {
    world = all;
    const data: MiniServers = {
      mini_servers: world.minis
        .filter((m) => m.public)
        .map((m) => {
          const players = world.players.filter((p) => p.online && p.mini === `${m.server}/${m.id}`).map((p) => ({ uuid: p.uuid, name: p.name }));
          return { id: m.id, display_name: m.display_name, public: m.public, server: m.server, players, player_count: players.length };
        })
        .filter((m) => m.player_count > 0)
    };
    return json(req, data);
  }

  if (seg[0] === "players:batch" && req.method === "POST") {
    let body: { refs?: unknown; include?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return problem(400, "bad_request", "body must be JSON");
    }
    const refs = Array.isArray(body.refs) ? (body.refs as unknown[]).filter((r): r is string => typeof r === "string") : [];
    const include = Array.isArray(body.include) ? (body.include as unknown[]).filter((r): r is string => typeof r === "string") : [];
    if (refs.length < 1 || refs.length > 100) return problem(400, "bad_request", "refs must hold 1..100 entries");
    if (include.length > 32) return problem(400, "bad_request", "include must hold at most 32 entries");
    const scope = scopeOf(world, url);
    if (scope instanceof Response) return scope;
    const players: BatchResponse["players"] = [];
    const not_found: string[] = [];
    for (const ref of refs) {
      const p = findPlayer(world, ref);
      if (!p) {
        not_found.push(ref);
        continue;
      }
      const row: BatchResponse["players"][number] = { ref, uuid: p.uuid, name: p.name, online: p.online, server: p.online ? p.server : null };
      const vals = valuesIn(world, p, scope);
      for (const inc of include) {
        if (inc === "playtime") row.playtime = playtimeOf(worldWithout(all, ex), p, { scope: "network", seen: true }, ex);
        else if (inc.startsWith("stats:")) {
          const parts = inc.slice(6).split(":");
          if (parts.length < 2) return problem(400, "bad_request", `bad include ${inc}`);
          const subject = parts.slice(-2).join(":");
          const type = fullType(parts.slice(0, -2).join(":"));
          if (!rollup(world).recorded.has(`${type}|${subject}`)) continue;
          row.stats ??= {};
          row.stats[inc] = statValue(world, type, subject, vals.get(`${type}|${subject}`) ?? 0);
        } else return problem(400, "bad_request", `bad include ${inc}`);
      }
      players.push(row);
    }
    const data: BatchResponse = { scope: scope.scope, excluded, players, not_found };
    return json(req, data);
  }

  if (seg[0] === "players") {
    if (seg.length === 1) {
      world = all;
      const pg = paging(url);
      if (pg instanceof Response) return pg;
      const online = url.searchParams.get("online");
      if (online !== null && online !== "true" && online !== "false") return problem(400, "bad_request", "online must be true or false");
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      if (q.length > 64) return problem(400, "bad_request", "q is too long");
      let rows = [...world.players].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
      if (online !== null) rows = rows.filter((p) => p.online === (online === "true"));
      if (q) rows = rows.filter((p) => p.name.toLowerCase().includes(q));
      const data: PlayerList = {
        total: rows.length,
        players: rows.slice(pg.offset, pg.offset + pg.limit).map((p) => ({ uuid: p.uuid, name: p.name, online: p.online, server: p.online ? p.server : null }))
      };
      return json(req, data);
    }
    const p = findPlayer(world, seg[1]);
    if (!p) return problem(404, "not_found", "no such player");
    if (seg.length === 2) return json(req, profile(worldWithout(all, ex), p, ex));
    const scope = scopeOf(world, url);
    if (scope instanceof Response) return scope;
    if (seg[2] === "playtime" && seg.length === 3) return json(req, playtimeOf(world, p, scope, excluded));
    if (seg[2] === "relations" && seg.length === 3) return problem(403, "forbidden", "token lacks read:relations");
    if (seg[2] === "stats" && seg.length === 3) {
      const pg = paging(url);
      if (pg instanceof Response) return pg;
      const typeF = url.searchParams.get("type");
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const rows: StatValue[] = [];
      for (const [k, v] of valuesIn(world, p, scope)) {
        const [type, subject] = k.split("|");
        if (typeF && fullType(typeF) !== type) continue;
        const sv = statValue(world, type, subject, v);
        if (q && !subject.toLowerCase().includes(q) && !(sv.name ?? "").toLowerCase().includes(q)) continue;
        rows.push(sv);
      }
      rows.sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0));
      const data: StatList = { uuid: p.uuid, scope: scope.scope, excluded, total: rows.length, stats: rows.slice(pg.offset, pg.offset + pg.limit) };
      return json(req, data);
    }
    if (seg[2] === "stats" && seg.length === 5) {
      const type = fullType(seg[3]);
      const subject = seg[4];
      if (!rollup(world).recorded.has(`${type}|${subject}`)) return problem(404, "not_found", "nobody has recorded this stat");
      const v = valuesIn(world, p, scope).get(`${type}|${subject}`) ?? 0;
      const data: StatRow = { uuid: p.uuid, scope: scope.scope, excluded, ...statValue(world, type, subject, v) };
      return json(req, data);
    }
    if (seg[2] === "advancement-milestones" && seg.length === 3) {
      if (!world.advancements) return problem(404, "not_found", "no such route");
      if (scope.mini) return problem(400, "bad_request", "advancement milestones are kept per server and for the network, not per mini-server");
      const pg = paging(url);
      if (pg instanceof Response) return pg;
      // like the stat milestones, the player endpoint's rows carry neither uuid nor name
      const rows = advRows(world, scope)
        .filter((m) => m.uuid === p.uuid)
        .map(({ uuid: _u, name: _n, ...row }) => row);
      const data: PlayerAdvancements = { uuid: p.uuid, name: p.name, scope: scope.scope, excluded, total: rows.length, milestones: rows.slice(pg.offset, pg.offset + pg.limit) };
      return json(req, data);
    }
    if (seg[2] === "milestones" && seg.length === 3) {
      world = all;
      if (!world.milestones) return problem(404, "not_found", "no such route");
      if (scope.mini) return problem(400, "bad_request", "milestones have no mini-server scope");
      const pg = paging(url);
      if (pg instanceof Response) return pg;
      // the player endpoint's rows carry neither uuid nor name: the player is on the envelope (openapi PlayerMilestoneList)
      const rows = feedRows(world, scope, url.searchParams.get("type"))
        .filter((m) => m.uuid === p.uuid)
        .map(({ uuid: _u, name: _n, ...row }) => row);
      const data: PlayerMilestones = { uuid: p.uuid, name: p.name, scope: scope.scope, total: rows.length, milestones: rows.slice(pg.offset, pg.offset + pg.limit) };
      return json(req, data);
    }
    return problem(404, "not_found", "no such route");
  }

  if (seg[0] === "stats") {
    const r = rollup(world);
    if (seg[1] === "types" && seg.length === 2) {
      const data: StatTypes = { types: world.types.filter((t) => r.recordedTypes.has(t.key)) };
      return json(req, data);
    }
    if (seg[1] === "subjects" && seg.length === 2) {
      const pg = paging(url);
      if (pg instanceof Response) return pg;
      const typeF = url.searchParams.get("type");
      const kindF = url.searchParams.get("kind");
      if (kindF !== null && !["block", "item", "entity", "custom", "other"].includes(kindF)) return problem(400, "bad_request", "bad kind");
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const recordedSubjects = new Set<string>();
      for (const k of r.recorded) recordedSubjects.add(k.split("|")[1]);
      let rows: Subject[] = world.subjects
        .filter((s) => recordedSubjects.has(s.key))
        .map((s) => ({ key: s.key, kind: s.kind, name: s.name, unit: s.unit, icon: iconUrl(s) }));
      if (typeF) {
        const under = r.subjectsByType.get(fullType(typeF)) ?? new Set();
        const kind = typeKind(world, fullType(typeF));
        rows = rows.filter((s) => under.has(s.key) && (s.kind === kind || s.kind === null));
      }
      if (kindF) rows = rows.filter((s) => s.kind === kindF);
      if (q) rows = rows.filter((s) => s.key.toLowerCase().includes(q) || (s.name ?? "").toLowerCase().includes(q));
      rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      const data: SubjectList = { total: rows.length, subjects: rows.slice(pg.offset, pg.offset + pg.limit) };
      return json(req, data);
    }
    if (seg[1] === "subjects" && seg.length === 3) {
      const key = seg[2];
      const names = world.subjects.filter((s) => s.key === key).map((s) => ({ key: s.key, kind: s.kind, name: s.name, unit: s.unit, icon: iconUrl(s) }));
      const types = [...r.subjectsByType.entries()].filter(([, subs]) => subs.has(key)).map(([t]) => t).sort();
      if (!names.length && !types.length) return problem(404, "not_found", "no such subject");
      const data: SubjectDetail = { key, names, types };
      return json(req, data);
    }
    return problem(404, "not_found", "no such route");
  }

  if (seg[0] === "leaderboards") {
    const scope = scopeOf(world, url);
    if (scope instanceof Response) return scope;
    const pg = paging(url);
    if (pg instanceof Response) return pg;
    if (seg[1] === "playtime" && seg.length === 2) {
      const rows = world.players.map((p) => ({ p, value: playtimeOf(world, p, scope).total_ms })).filter((x) => x.value > 0);
      rows.sort((a, b) => b.value - a.value || (a.p.uuid < b.p.uuid ? -1 : 1));
      const data: Leaderboard = {
        metric: "playtime",
        scope: scope.scope,
        excluded,
        unit: "ms",
        total: rows.length,
        entries: rows.slice(pg.offset, pg.offset + pg.limit).map((x, i) => ({ rank: pg.offset + i + 1, uuid: x.p.uuid, name: x.p.name, value: x.value, unit: "ms", display: durationMs(x.value) }))
      };
      return json(req, data);
    }
    if (seg[1] === "stats" && seg.length === 4) {
      const type = fullType(seg[2]);
      const subject = seg[3];
      if (subject === "*" && typeKind(world, type) === "custom") return problem(400, "mixed_units", "custom stats have mixed units; ask for one subject");
      const b = boardValues(world, type, subject, scope);
      if (!b) return problem(404, "not_found", "nobody has recorded this stat");
      const data: Leaderboard = {
        metric: `${shortType(type)}:${subject}`,
        scope: scope.scope,
        excluded,
        unit: b.unit,
        total: b.rows.length,
        entries: b.rows.slice(pg.offset, pg.offset + pg.limit).map((x, i) => ({ rank: pg.offset + i + 1, uuid: x.p.uuid, name: x.p.name, value: x.value, unit: b.unit, display: formatStat(b.unit, x.value) }))
      };
      return json(req, data);
    }
    return problem(404, "not_found", "no such route");
  }

  if (seg[0] === "milestones" && (seg[1] === "advancements" || seg[1] === "advancement") && seg.length === 2) {
    if (!world.advancements) return problem(404, "not_found", "no such route");
    if (seg[1] === "advancements") {
      const scope = scopeOf(world, url);
      if (scope instanceof Response) return scope;
      if (scope.mini) return problem(400, "bad_request", "advancement milestones are kept per server and for the network, not per mini-server");
      const pg = paging(url);
      if (pg instanceof Response) return pg;
      const rows = advRows(world, scope);
      const data: AdvancementFeed = { scope: scope.scope, excluded, total: rows.length, milestones: rows.slice(pg.offset, pg.offset + pg.limit) };
      return json(req, data);
    }
    const raw = url.searchParams.get("id");
    if (!raw || !raw.trim()) return problem(400, "bad_request", "'id' is required");
    const id = fullAdvId(raw.trim());
    if (!advIndex(all).get(id)) return problem(404, "not_found", `no advancement ${id}`);
    const w = worldWithout(all, ex);
    const rows = advIndex(w).get(id) ?? [];
    const network = advFirst(w, rows, null);
    const servers = [...new Set(rows.map((r) => r.server))].sort().map((sv) => advFirst(w, rows, sv)!);
    const data: AdvancementDetail = { advancement: id, title: advTitle(all, id) || null, excluded: ex, network, servers };
    return json(req, data);
  }

  if (seg[0] === "milestones") {
    world = all;
    if (!world.milestones) return problem(404, "not_found", "no such route");
    const scope = scopeOf(world, url);
    if (scope instanceof Response) return scope;
    if (scope.mini) return problem(400, "bad_request", "milestones have no mini-server scope");
    if (seg.length === 1) {
      const pg = paging(url);
      if (pg instanceof Response) return pg;
      const rows = feedRows(world, scope, url.searchParams.get("type"));
      const data: MilestoneFeed = { scope: scope.scope, total: rows.length, milestones: rows.slice(pg.offset, pg.offset + pg.limit) };
      return json(req, data);
    }
    if (seg[1] === "stats" && seg.length === 4) {
      const type = fullType(seg[2]);
      const subject = seg[3];
      if (subject === "*" && typeKind(world, type) === "custom") return problem(400, "mixed_units", "custom stats have mixed units; ask for one subject");
      const l = ladder(world, type, subject, scope);
      if (!l) return problem(404, "not_found", "nobody has recorded this stat");
      return json(req, l);
    }
    return problem(404, "not_found", "no such route");
  }

  if (seg[0] === "icons" && seg.length === 2) {
    const m = /^([0-9a-f]{64})\.png$/.exec(seg[1]);
    if (!m) return problem(404, "not_found", "no such icon");
    if (!world.subjects.some((s) => s.icon === m[1])) return problem(404, "not_found", "no such icon");
    const etag = `"${m[1]}"`;
    const headers = { "content-type": "image/png", "cache-control": "private, max-age=31536000, immutable", etag };
    if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    return new Response(req.method === "HEAD" ? null : (await iconPng(m[1])) as BodyInit, { status: 200, headers });
  }

  if (seg[0] === "admin") return problem(403, "forbidden", "token lacks admin:announce");
  return problem(404, "not_found", "no such route");
}
