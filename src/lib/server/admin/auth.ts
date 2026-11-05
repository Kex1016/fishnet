// Site admin login (owner-editable labels and hide lists). Pure parts, no env or SvelteKit access, so
// tests can drive them: the token check, the session table and the login rate limit.
//
// - The admin token is a site-side secret (FISHNET_ADMIN_TOKEN), never the cakeutils token. Unset or
//   too short: admin is off and every /admin route is a 404.
// - The check hashes both sides first and compares the digests with timingSafeEqual, so neither the
//   length nor a matching prefix shows in the time it takes.
// - Sessions are random 256-bit ids held in memory (a restart logs everyone out), 12 hours, each with
//   its own CSRF token that every form posts back.
// - Failed logins: 5 per 10 minutes per client address, 20 per 10 minutes across all addresses (behind
//   a proxy without ADDRESS_HEADER every client shares one address; the limit then only gets stricter).
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const MIN_TOKEN_LENGTH = 24;
export const SESSION_MS = 12 * 60 * 60 * 1000;
export const WINDOW_MS = 10 * 60 * 1000;
export const PER_ADDRESS = 5;
export const GLOBAL = 20;

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

/** True when `given` is the admin token. Constant time in both inputs' contents and lengths. */
export function tokenMatches(expected: string, given: string): boolean {
  if (expected.length < MIN_TOKEN_LENGTH) return false;
  return timingSafeEqual(digest(expected), digest(given));
}

export type Session = { id: string; csrf: string; expires: number };

export class Sessions {
  readonly #map = new Map<string, Session>();
  constructor(private readonly now: () => number = Date.now) {}

  create(): Session {
    this.#sweep();
    const s = { id: randomBytes(32).toString("base64url"), csrf: randomBytes(24).toString("base64url"), expires: this.now() + SESSION_MS };
    this.#map.set(s.id, s);
    return s;
  }
  get(id: string | undefined): Session | null {
    if (!id || id.length > 64) return null;
    const s = this.#map.get(id);
    if (!s) return null;
    if (s.expires <= this.now()) {
      this.#map.delete(id);
      return null;
    }
    return s;
  }
  delete(id: string | undefined): void {
    if (id) this.#map.delete(id);
  }
  clear(): void {
    this.#map.clear();
  }
  get size(): number {
    return this.#map.size;
  }
  #sweep() {
    const t = this.now();
    for (const [k, s] of this.#map) if (s.expires <= t) this.#map.delete(k);
  }
}

/** True when the posted CSRF token is this session's. */
export function csrfMatches(s: Session, given: unknown): boolean {
  return typeof given === "string" && given.length === s.csrf.length && timingSafeEqual(Buffer.from(given), Buffer.from(s.csrf));
}

/** Failed-login limiter: fixed window per address and overall. */
export class LoginLimiter {
  readonly #fails = new Map<string, number[]>();
  #all: number[] = [];
  constructor(private readonly now: () => number = Date.now) {}

  /** Seconds until this address may try again, or 0. */
  blockedFor(address: string): number {
    const t = this.now();
    const mine = this.#recent(address, t);
    this.#all = this.#all.filter((x) => x > t - WINDOW_MS);
    const until = Math.max(
      mine.length >= PER_ADDRESS ? mine[mine.length - PER_ADDRESS] + WINDOW_MS : 0,
      this.#all.length >= GLOBAL ? this.#all[this.#all.length - GLOBAL] + WINDOW_MS : 0
    );
    return until > t ? Math.ceil((until - t) / 1000) : 0;
  }
  fail(address: string): void {
    const t = this.now();
    const mine = this.#recent(address, t);
    mine.push(t);
    this.#fails.set(address, mine);
    this.#all.push(t);
    if (this.#fails.size > 10_000) this.#fails.clear(); // a flood of addresses cannot grow memory; the global limit still holds
  }
  succeed(address: string): void {
    this.#fails.delete(address);
  }
  #recent(address: string, t: number): number[] {
    return (this.#fails.get(address) ?? []).filter((x) => x > t - WINDOW_MS);
  }
}
