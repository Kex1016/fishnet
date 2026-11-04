// Every client call returns a Result, never throws (PLAN §3.2), so each page decides on purpose what
// "not happened yet" and "cakeutils is down" look like (PLAN §3.5). Frozen by W0.
import type { Problem } from "./types.ts";

export type Ok<T> = {
  ok: true;
  data: T;
  /** epoch ms when this answer was fetched; the page shows it as "as of" when `stale` */
  asOf: number;
  /** true when served from the last good answer because cakeutils was unreachable (W1) */
  stale: boolean;
  /** true when a list answer has `total: 0` / no rows: a scope nobody has played in yet */
  empty: boolean;
};

export type FailureKind =
  /** 404: a stat or type nobody ever recorded, or an unknown player */
  | "not_found"
  /** the feature is switched off on this proxy (milestones answer 404 at their root) */
  | "off"
  /** cakeutils unreachable or 5xx, and nothing stale to serve */
  | "down"
  /** 429 and nothing stale to serve; `retryAfter` in seconds */
  | "rate_limited"
  /** 400 (bad scope, `custom:*` mixed_units, ...); `problem.type` ends with the code */
  | "bad_request";

export type Failure = {
  ok: false;
  kind: FailureKind;
  status?: number;
  problem?: Problem;
  retryAfter?: number;
  /** when known, the time of the last good answer that could not be served */
  asOf?: number;
};

export type Result<T> = Ok<T> | Failure;

export function ok<T>(data: T, asOf = Date.now(), extra: { stale?: boolean; empty?: boolean } = {}): Ok<T> {
  return { ok: true, data, asOf, stale: extra.stale ?? false, empty: extra.empty ?? false };
}

export function fail(kind: FailureKind, extra: Omit<Failure, "ok" | "kind"> = {}): Failure {
  return { ok: false, kind, ...extra };
}

/** The problem code (`urn:cakeutils:problem:<code>`) of a failure, or null. */
export function problemCode(r: Failure): string | null {
  const t = r.problem?.type;
  if (!t) return null;
  const i = t.lastIndexOf(":");
  return i < 0 ? t : t.slice(i + 1);
}

/** A list is "nothing yet" when its `total` is 0 or its rows are empty. Used by the client to set `empty`. */
export function listIsEmpty(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (typeof d.total === "number") return d.total === 0;
  for (const k of ["entries", "players", "stats", "subjects", "types", "milestones", "mini_servers"]) {
    if (Array.isArray(d[k])) return (d[k] as unknown[]).length === 0;
  }
  return false;
}
