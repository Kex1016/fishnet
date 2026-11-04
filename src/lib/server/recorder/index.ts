// The recorder in the running site (PLAN §3.3): one SQLite file at <FISHNET_DATA_DIR>/fishnet.db, the
// scheduler started from hooks.server.ts `init`, and the History that pages read. Kept on globalThis
// so a dev-server reload never starts a second scheduler.
//
// Failure is quiet for visitors: if the file cannot be opened (permissions, a newer schema), the log
// says `fishnet recorder NOT running: <why>` once and every chart shows its empty state.
// Mock mode never touches the disk: an in-memory database seeded from the scenario (mock-seed.ts).
import { join } from "node:path";
import { building } from "$app/env";
import { api, setRequestPriority } from "../cakeutils/client.ts";
import { config } from "../env.ts";
import { isHiddenPlayer } from "../hidden.ts";
import { emptyHistory, type History } from "../history.ts";
import { inRecorder } from "./context.ts";
import { type Db, openDb } from "./db.ts";
import type { RecorderDeps } from "./jobs.ts";
import { seedMock } from "./mock-seed.ts";
import { createSqliteHistory } from "./queries.ts";
import { type Scheduler, startScheduler } from "./scheduler.ts";

type State = { db: Db | null; history: History; scheduler: Scheduler | null };

const KEY = Symbol.for("fishnet.recorder");
const g = globalThis as unknown as { [KEY]?: State };

const log = (l: string) => console.warn(l);

function deps(db: Db): RecorderDeps {
  return { db, client: api(), now: Date.now, hidden: isHiddenPlayer, log };
}

function init(): State {
  const existing = g[KEY];
  if (existing) return existing;
  const c = config();
  // the client's rate bucket puts recorder calls behind page renders (W1)
  setRequestPriority(() => (inRecorder() ? "background" : "page"));
  let state: State;
  if (c.mock) {
    const db = openDb(":memory:");
    // seeded at page priority: the fixtures have no rate limit, and background calls would step back
    // behind the mock's small RateLimit-Remaining for seconds each
    const ready = seedMock(deps(db), c.mock).catch((e) => log(`fishnet recorder: mock history not seeded: ${(e as Error).message}`));
    state = { db, history: createSqliteHistory(db, { hidden: isHiddenPlayer, ready, log }), scheduler: null };
  } else {
    const path = join(c.dataDir, "fishnet.db");
    try {
      const db = openDb(path);
      state = { db, history: createSqliteHistory(db, { hidden: isHiddenPlayer, log }), scheduler: null };
    } catch (e) {
      log(`fishnet recorder NOT running: cannot open ${path}: ${(e as Error).message}`);
      state = { db: null, history: emptyHistory, scheduler: null };
    }
  }
  g[KEY] = state;
  return state;
}

/** Starts the scheduler (once). Called from hooks.server.ts `init`; a no-op while building and in mock mode. */
export function startRecorder(): void {
  if (building) return;
  const s = init();
  if (!s.db) return;
  if (config().mock) {
    console.info(`fishnet recorder: mock history in memory ("${config().mock}"), nothing written to disk`);
    return;
  }
  if (s.scheduler) return;
  s.scheduler = startScheduler(deps(s.db));
  console.info(`fishnet recorder: recording to ${join(config().dataDir, "fishnet.db")}`);
  const stop = () => {
    s.scheduler?.stop();
    try {
      s.db?.close();
    } catch {
      // already closed
    }
    s.db = null;
  };
  process.once("sveltekit:shutdown" as "exit", stop);
}

/** The History pages read: SQLite-backed, or empty while building and when the file cannot be opened. */
export function recorderHistory(): History {
  if (building) return emptyHistory;
  return init().history;
}
