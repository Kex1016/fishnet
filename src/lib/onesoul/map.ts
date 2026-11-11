// Map data for the One Soul maps: GeoJSON in raw block coordinates, positions [x, z, y], the dimension in
// properties.dim (API-EXPANSION §3). Nothing is projected: x runs east (right) and z south (down), as in
// the game, one map per dimension. Every label carries player text as text only.
import { dimLabel, life } from "./format.ts";
import { osHref } from "./links.ts";
import type { Feature, FeatureCollection, Trail } from "./types.ts";

export type Mark = {
  id: string;
  kind: "spawn" | "death" | "grave" | "waystone" | "other";
  dim: string;
  x: number;
  z: number;
  y: number | null;
  /** short label: a name, "Spawn", a waystone's label (player text) */
  title: string;
  /** a second line: cause of death, items, who found it */
  detail: string | null;
  href: string | null;
  /** an open grave, a removed waystone */
  muted?: boolean;
};
export type Path = { id: string; dim: string; points: [number, number][]; title: string; detail: string | null; href: string | null };
export type DimMap = { dim: string; label: string; marks: Mark[]; paths: Path[]; box: Box };
export type Box = { x: number; z: number; w: number; h: number };

const DIM_ORDER = ["minecraft:overworld", "minecraft:the_nether", "minecraft:the_end"];
export const LAYERS = ["trails", "deaths", "graves", "waystones", "spawn"] as const;
export type LayerId = (typeof LAYERS)[number];

const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const ref = (v: unknown): { uuid: string; name: string; turn?: number } | null =>
  v && typeof v === "object" && typeof (v as { name?: unknown }).name === "string" ? (v as { uuid: string; name: string; turn?: number }) : null;

function pos(c: unknown): [number, number, number | null] | null {
  if (!Array.isArray(c) || c.length < 2) return null;
  const [x, z, y] = c;
  return typeof x === "number" && typeof z === "number" && Number.isFinite(x) && Number.isFinite(z) ? [x, z, typeof y === "number" ? y : null] : null;
}

/** One feature as a mark or a path; unknown geometry or kinds are skipped or shown generically. */
export function toShape(f: Feature, cycle: number): Mark | Path | null {
  const p = f.properties ?? {};
  const dim = s(p.dim) ?? "unknown";
  const g = f.geometry;
  const id = String(f.id ?? `${String(p.kind)}-${dim}-${JSON.stringify(g?.coordinates ?? null).slice(0, 48)}`);
  if (!g) return null;
  if (g.type === "LineString" && Array.isArray(g.coordinates)) {
    const pts = (g.coordinates as unknown[]).map(pos).filter((q): q is [number, number, number | null] => q !== null).map(([x, z]) => [x, z] as [number, number]);
    if (pts.length < 2) return null;
    const name = s(p.name) ?? "A soul";
    const turn = n(p.turn);
    const span = n(p.started_at) !== null && n(p.ended_at) !== null ? life(n(p.ended_at)! - n(p.started_at)!) : null;
    return { id, dim, points: pts, title: turn !== null ? `${name}, turn ${turn}` : name, detail: span ? `${span} in ${dimLabel(dim)}` : null, href: turn !== null ? osHref.soul(cycle, turn) : null };
  }
  if (g.type !== "Point") return null;
  const q = pos(g.coordinates);
  if (!q) return null;
  const [x, z, y] = q;
  const base = { id, dim, x, z, y };
  switch (p.kind) {
    case "spawn": {
      const by = ref(p.set_by);
      return { ...base, kind: "spawn", title: "Spawn", detail: by ? `set by ${by.name}` : null, href: null };
    }
    case "death": {
      const turn = n(p.turn);
      return { ...base, kind: "death", title: s(p.name) ?? "A soul", detail: s(p.cause), href: turn !== null ? osHref.soul(cycle, turn) : null };
    }
    case "grave": {
      const soul = ref(p.soul);
      const items = n(p.items);
      const by = ref(p.claimed_by);
      const claimed = p.claimed === true || !!by;
      return {
        ...base,
        kind: "grave",
        title: soul ? `Grave of ${soul.name}` : "A grave",
        detail: `${items !== null ? `${items} item${items === 1 ? "" : "s"}, ` : ""}${claimed ? `claimed${by ? ` by ${by.name}` : ""}` : "open"}`,
        href: soul?.turn ? osHref.soul(cycle, soul.turn) : null,
        muted: claimed
      };
    }
    case "waystone": {
      const by = ref(p.first_by);
      return { ...base, kind: "waystone", title: s(p.label) ?? "Waystone", detail: by ? `found by ${by.name}` : null, href: null, muted: n(p.removed_at) !== null };
    }
    default:
      return { ...base, kind: "other", title: s(p.kind) ?? "Point", detail: null, href: null };
  }
}

/** A trail in its native form (`format=points`) as paths, one per segment. */
export function trailPaths(t: Trail): Path[] {
  return t.segments
    .filter((g) => g.points.length >= 2)
    .map((g, i) => ({
      id: `trail-${t.soul.turn}-${i}`,
      dim: g.dim,
      points: g.points.map(([, x, , z]) => [x, z] as [number, number]),
      title: `${t.soul.name}, turn ${t.soul.turn}`,
      detail: `${life(g.ended_at - g.started_at)} in ${dimLabel(g.dim)}`,
      href: null
    }));
}

/** A box around everything with some room, at least 64 blocks, and not thinner than 1:1.8. */
export function boxOf(marks: Mark[], paths: Path[]): Box {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  const add = (x: number, z: number) => {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  };
  for (const m of marks) add(m.x, m.z);
  for (const p of paths) for (const [x, z] of p.points) add(x, z);
  if (!Number.isFinite(x0)) return { x: -32, z: -32, w: 64, h: 64 };
  let w = Math.max(64, x1 - x0);
  let h = Math.max(64, z1 - z0);
  if (w / h > 1.8) h = w / 1.8;
  if (h / w > 1.2) w = h / 1.2;
  const pad = Math.max(w, h) * 0.08;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  return { x: cx - w / 2 - pad, z: cz - h / 2 - pad, w: w + 2 * pad, h: h + 2 * pad };
}

/** Grid lines every 1, 2 or 5 × 10^k blocks, about five across. */
export function gridStep(span: number): number {
  const raw = span / 5;
  const k = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * k).find((v) => v >= raw) ?? 10 * k;
}

/** Splits shapes into one map per dimension: overworld, nether, end, then any other in name order. */
export function byDimension(shapes: (Mark | Path)[]): DimMap[] {
  const by = new Map<string, { marks: Mark[]; paths: Path[] }>();
  for (const sh of shapes) {
    const e = by.get(sh.dim) ?? { marks: [], paths: [] };
    if ("points" in sh) e.paths.push(sh);
    else e.marks.push(sh);
    by.set(sh.dim, e);
  }
  const rank = (d: string) => (DIM_ORDER.includes(d) ? DIM_ORDER.indexOf(d) : 99);
  return [...by.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
    .map(([dim, e]) => ({ dim, label: dimLabel(dim), marks: e.marks, paths: e.paths, box: boxOf(e.marks, e.paths) }));
}

/**
 * The site's own guard over map layers: nothing of the soul who is playing (no trail, no death position),
 * and a waystone they found does not name them while they play (it would hint where they are).
 */
export function withoutLiving(fc: FeatureCollection, living: { uuid: string } | null): FeatureCollection {
  return {
    ...fc,
    features: (fc.features ?? [])
      .map((f) => {
        const by = f.properties?.first_by as { uuid?: string } | undefined;
        return living && f.properties?.kind === "waystone" && by?.uuid === living.uuid ? { ...f, properties: { ...f.properties, first_by: null } } : f;
      })
      .filter((f) => {
      const p = f.properties ?? {};
      if (p.kind === "trail" && (p.outcome === "playing" || p.outcome === null || p.outcome === undefined)) return false;
      if (!living) return true;
      const uuid = p.uuid ?? (p.soul as { uuid?: string } | undefined)?.uuid;
      return !((p.kind === "trail" || p.kind === "death") && uuid === living.uuid);
    })
  };
}
