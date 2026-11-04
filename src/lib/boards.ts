// Featured and composite boards (PLAN §3.4). W6 owns this file; W0 freezes the shape so the home
// page (W4) and player profiles (W5) can read it. A featured board whose stat answers 404 is hidden
// until it exists; composites sum players' values inside ONE scope only (never across scopes).
import type { Metric } from "#lib/api/metric.ts";

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
