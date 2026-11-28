// A round's steps into the Nether and the End (TH-26 events): the first stable portal, the first soul into the
// Nether, an open End portal, the first soul into the End, a torch passed. The kinds filter needs the tracking
// group; without it the answer is null and the round page leaves the window out.
import type { Result } from "#lib/api/result.ts";
import type { OsEvent } from "#lib/onesoul/types.ts";
import { oneSoul } from "./index.ts";

export const THRESHOLD_KINDS = "rift_stable,nether_entered,end_opened,end_entered,torch_passed";

export type RoundThresholds = { events: OsEvent[]; asOf: number; stale: boolean };

export async function roundThresholds(server: string, cycle: number): Promise<RoundThresholds | null> {
  const r: Result<{ events: OsEvent[] }> = await oneSoul().events({ server, cycle, kind: THRESHOLD_KINDS, limit: 100 });
  return r.ok ? { events: r.data.events, asOf: r.asOf, stale: r.stale } : null;
}
