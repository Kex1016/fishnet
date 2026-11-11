// Which servers belong to One Soul, so the regular site never shows them (WEBSITE-BRIEF §3.3, David
// 11 Nov 2026: "Everything that's One Soul should have its own section").
//
// - A newer cakeutils (API-EXPANSION M1) marks such servers in /v2/network with `standalone: true` (and
//   `game: "onesoul"`) and keeps their figures out of the network scope itself: the site only has to hide them.
// - An older cakeutils has no flag: the One Soul servers are the ones /v2/onesoul lists, and the network
//   figures still contain them, so network reads send `exclude=<ids>` (D-113) until the flag exists.
//
// Plain state with no imports from the client, so client.ts can read it synchronously on every call.
// The refresh lives in onesoul/index.ts (it needs the client); `stale()` says when one is due.

const FRESH_MS = 60_000;

type State = {
  /** every One Soul / standalone server id */
  ids: string[];
  /** /v2/network carries the `standalone` field: cakeutils keeps these servers out of network figures itself */
  flag: boolean;
  at: number;
};

let state: State = { ids: [], flag: false, at: -Infinity };

export function setStandalone(ids: Iterable<string>, flag: boolean, at = Date.now()): void {
  state = { ids: [...new Set(ids)].sort(), flag, at };
}

/** Servers the regular site hides (lists, pickers, scopes, presence). */
export function standaloneIds(): readonly string[] {
  return state.ids;
}

/** Servers network reads must exclude because cakeutils still rolls them up (no `standalone` flag yet). */
export function standaloneExclude(): readonly string[] {
  return state.flag ? [] : state.ids;
}

export function standaloneStale(now = Date.now()): boolean {
  return now - state.at >= FRESH_MS;
}

/** For tests. */
export function resetStandalone(): void {
  state = { ids: [], flag: false, at: -Infinity };
}
