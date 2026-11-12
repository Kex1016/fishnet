// Death groups for the network death feed: the structured damage type where cakeutils has it, else a
// simple pattern over the (untrusted) death message; anything else is Other.
import { causeGroup } from "#lib/onesoul/charts.ts";
import type { Soul } from "#lib/onesoul/types.ts";
import type { Death } from "./types.ts";

export function causeOf(d: Death): string {
  if (d.killer_player) return "Killed by a player";
  return causeGroup({ cause: d.cause, death: d.damage_type ? { dim: d.dim ?? "", x: 0, y: 0, z: 0, damage_type: d.damage_type } : null } as Soul);
}
