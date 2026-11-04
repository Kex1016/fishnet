// Marks the recorder's cakeutils calls so the client's rate bucket (W1) can put them behind page
// renders (PLAN §3.2): the Client signatures carry no priority, so the recorder runs every job inside
// this AsyncLocalStorage context and the bucket asks `inRecorder()`.
import { AsyncLocalStorage } from "node:async_hooks";

const als = new AsyncLocalStorage<true>();

/** True while the current async call chain belongs to a recorder job. */
export function inRecorder(): boolean {
  return als.getStore() === true;
}

/** Runs `fn` as recorder work. */
export function asRecorder<T>(fn: () => Promise<T>): Promise<T> {
  return als.run(true, fn);
}
