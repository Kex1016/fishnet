// The ladders on a profile (PLAN §3.4): a stat's thresholds as squares, the ones the player has passed,
// the next one and the rest. A threshold is passed when the player's own value in the same scope and unit is
// at or above it. The API's rung says who was first and when; it says nothing about this player, so the
// state comes from the player's value, never from the rung's time.
import type { MilestoneLadder, Unit } from "#lib/api/types.ts";
import type { LadderStep } from "#lib/design/types.ts";
import { day } from "#lib/format/dates.ts";
import { formatStat } from "#lib/format/stat-display.ts";

export type LadderView = { steps: LadderStep[]; reached: number };

/**
 * One stat's ladder for a player with `value` (in the ladder's unit). Null when the ladder cannot be read
 * against this value: not tracked, no rungs, or the player's figure is in another unit.
 */
export function statLadder(ladder: MilestoneLadder, value: number | null, unit: Unit | null): LadderView | null {
  if (!ladder.tracked || ladder.milestones.length === 0) return null;
  if (value === null || (unit !== null && unit !== ladder.unit)) return null;
  const rungs = [...ladder.milestones].sort((a, b) => a.threshold - b.threshold);
  let next = -1;
  const steps: LadderStep[] = rungs.map((r, i) => {
    if (value >= r.threshold) return { key: String(r.threshold), label: r.display, state: "reached", title: `${r.display}: reached` };
    if (next < 0) next = i;
    if (next === i) return { key: String(r.threshold), label: r.display, state: "next", title: `${r.display}: next, ${formatStat(ladder.unit as Unit, r.threshold - value)} to go` };
    return { key: String(r.threshold), label: r.display, state: "locked", title: `${r.display}: not reached yet` };
  });
  return { steps, reached: steps.filter((s) => s.state === "reached").length };
}

/** The player's playtime thresholds from the activity answer: only the ones crossed, with when. */
export function playtimeLadder(milestones: { threshold_ms: number; display: string; reached_at: number | null; first: boolean }[]): LadderView | null {
  if (milestones.length === 0) return null;
  const rungs = [...milestones].sort((a, b) => a.threshold_ms - b.threshold_ms);
  const steps: LadderStep[] = rungs.map((m) => ({
    key: String(m.threshold_ms),
    label: m.display,
    state: "reached",
    title: `${m.display}: ${m.reached_at !== null ? `reached ${day(m.reached_at)}` : "reached before tracking began"}${m.first ? ", first on the network" : ""}`
  }));
  return { steps, reached: steps.length };
}
