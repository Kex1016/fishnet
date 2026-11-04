// Featured and composite boards (PLAN §3.4). W6 owns this file; W0 freezes the shape so the home
// page (W4) and player profiles (W5) can read it. A featured board whose stat answers 404 is hidden
// until it exists; composites sum players' values inside ONE scope only (never across scopes).
import { metricKey, type Metric } from "#lib/api/metric.ts";
import type { Scope } from "#lib/api/scope.ts";

export type FeaturedBoard = {
  /** URL segment under /leaderboards and the key the recorder stores it under */
  id: string;
  label: string;
  /** one API board */
  metric: Metric;
};

export type CompositeBoard = {
  id: string;
  label: string;
  /** the per-player values of these stats are added, each inside the requested scope */
  parts: Metric[];
  unit: "count" | "distance_cm" | "ticks" | "damage_tenths";
  /**
   * Which part's full board is the set of players ranked (index into `parts`, default 0). A player
   * with none of that stat is not ranked: for Travel that means "has walked", which every player has.
   */
  universe?: number;
};

export const FEATURED: FeaturedBoard[] = [
  { id: "playtime", label: "Playtime", metric: { kind: "playtime" } },
  { id: "mined", label: "Blocks mined", metric: { kind: "stat", type: "minecraft:mined", subject: "*" } },
  { id: "diamonds", label: "Diamond ore", metric: { kind: "stat", type: "minecraft:mined", subject: "minecraft:diamond_ore" } },
  { id: "mob-kills", label: "Mob kills", metric: { kind: "stat", type: "minecraft:custom", subject: "minecraft:mob_kills" } },
  { id: "deaths", label: "Deaths", metric: { kind: "stat", type: "minecraft:custom", subject: "minecraft:deaths" } },
  { id: "fish", label: "Fish caught", metric: { kind: "stat", type: "minecraft:custom", subject: "minecraft:fish_caught" } }
];

export const COMPOSITES: CompositeBoard[] = [
  {
    id: "travel",
    label: "Travel",
    unit: "distance_cm",
    parts: ["walk_one_cm", "sprint_one_cm", "swim_one_cm", "boat_one_cm", "fly_one_cm", "aviate_one_cm", "horse_one_cm", "minecart_one_cm", "climb_one_cm", "crouch_one_cm", "fall_one_cm"].map(
      (s) => ({ kind: "stat", type: "minecraft:custom", subject: `minecraft:${s}` }) as Metric
    )
  }
];

export function findFeatured(id: string): FeaturedBoard | undefined {
  return FEATURED.find((b) => b.id === id);
}

export function findComposite(id: string): CompositeBoard | undefined {
  return COMPOSITES.find((b) => b.id === id);
}

/** The featured board that shows this metric, if there is one (so pages can reuse its label). */
export function featuredFor(m: Metric): FeaturedBoard | undefined {
  const key = metricKey(m);
  return FEATURED.find((b) => metricKey(b.metric) === key);
}

/** The site's own URL for a composite board: /leaderboards/<id>. */
export function compositeHref(b: CompositeBoard, scope?: Scope | string): string {
  const q = scope && scope !== "network" ? `?scope=${encodeURIComponent(scope)}` : "";
  return `/leaderboards/${encodeURIComponent(b.id)}${q}`;
}
