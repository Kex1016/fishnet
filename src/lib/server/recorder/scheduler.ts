// The recorder's scheduler (PLAN §3.3): timers inside the site's Node process. Survives restarts: each
// job's last good run is kept in `meta`, so a restart does not re-run an hourly job that ran five
// minutes ago, and a job that is overdue runs soon after start (staggered, not all at once).
// One run per job at a time; a failed run (cakeutils down) retries sooner than its interval.
import { asRecorder } from "./context.ts";
import { getMetaNumber, setMeta } from "./db.ts";
import {
  maintain, recordBoards, recordMilestones, recordMinis, recordNetwork, recordPlayers, recordServerMilestones, recordTotals,
  type Outcome, type RecorderDeps
} from "./jobs.ts";
import { HOUR, MINUTE } from "./time.ts";

export type Job = { name: string; every: number; run: (d: RecorderDeps) => Promise<Outcome> };

export const JOBS: readonly Job[] = [
  { name: "network", every: MINUTE, run: recordNetwork },
  { name: "minis", every: 10 * MINUTE, run: recordMinis },
  { name: "players", every: 10 * MINUTE, run: recordPlayers },
  { name: "milestones", every: 10 * MINUTE, run: (d) => recordMilestones(d, "network") },
  { name: "boards", every: HOUR, run: recordBoards },
  { name: "milestones-servers", every: HOUR, run: recordServerMilestones },
  { name: "maintenance", every: HOUR, run: maintain },
  { name: "totals", every: 6 * HOUR, run: recordTotals }
];

/** After a failed run: retry after this long (or the job's own interval, if shorter). */
export const RETRY = 5 * MINUTE;

/** When a job should first run after a start: when it is due, but not before its stagger slot. */
export function firstRun(job: Job, lastRun: number | null, now: number, index: number): number {
  if (job.every === MINUTE) return now + 1_000; // right away: the other jobs read its server list
  const stagger = now + 5_000 + index * 4_000;
  return lastRun === null ? stagger : Math.max(stagger, lastRun + job.every);
}

export function nextRun(job: Job, startedAt: number, outcome: Outcome, now: number): number {
  if (job.every === MINUTE) return Math.floor(now / MINUTE) * MINUTE + MINUTE + 2_000;
  if (outcome === "down") return now + Math.min(job.every, RETRY);
  return startedAt + job.every;
}

export type Scheduler = { stop(): void; /** runs one job now (tests, mock seeding) */ runOnce(name: string): Promise<Outcome> };

export function startScheduler(d: RecorderDeps, jobs: readonly Job[] = JOBS): Scheduler {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const running = new Set<string>();
  const state = new Map<string, Outcome>();
  let stopped = false;

  async function run(job: Job): Promise<Outcome> {
    if (running.has(job.name)) return "skipped";
    running.add(job.name);
    const startedAt = d.now();
    let outcome: Outcome;
    try {
      outcome = await asRecorder(() => job.run(d));
    } catch (e) {
      d.log(`fishnet recorder: job ${job.name} failed: ${(e as Error).message}`);
      outcome = "down";
    } finally {
      running.delete(job.name);
    }
    if (outcome !== "down") setMeta(d.db, `last_run:${job.name}`, startedAt);
    const before = state.get(job.name);
    if (outcome === "down" && before !== "down") d.log(`fishnet recorder: ${job.name} not recorded (cakeutils unreachable or refused), retrying`);
    if (outcome !== "down" && before === "down") d.log(`fishnet recorder: ${job.name} recording again`);
    state.set(job.name, outcome);
    return outcome;
  }

  function schedule(job: Job, at: number) {
    if (stopped) return;
    const t = setTimeout(async () => {
      const startedAt = d.now();
      const outcome = await run(job);
      schedule(job, nextRun(job, startedAt, outcome, d.now()));
    }, Math.max(0, at - d.now()));
    (t as { unref?: () => void }).unref?.();
    timers.set(job.name, t);
  }

  const now = d.now();
  jobs.forEach((job, i) => schedule(job, firstRun(job, getMetaNumber(d.db, `last_run:${job.name}`), now, i)));

  return {
    stop() {
      stopped = true;
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    },
    runOnce(name) {
      const job = jobs.find((j) => j.name === name);
      return job ? run(job) : Promise.resolve("skipped");
    }
  };
}
