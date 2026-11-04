// The site's own token bucket in front of cakeutils (PLAN §3.2), sized below the token's limit
// (CAKEUTILS_RATE per minute, CAKEUTILS_BURST capacity). Two priorities: page renders may take any
// token; the recorder ("background") only takes one while more than `reserve` of the bucket is
// left, so a burst of recording never makes a visitor wait. Cache hits never come here; a 304
// does (it still costs a request at cakeutils).

export type Priority = "page" | "background";

export type BucketOptions = {
  ratePerMinute: number;
  burst: number;
  /** share of `burst` kept for pages, 0..1 (default 0.5) */
  reserve?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

/** cakeutils' remaining burst at or below which background pauses (its default burst is 60). */
export const LOW_REMAINING = 5;

export class TokenBucket {
  private tokens: number;
  private last: number;
  private readonly perMs: number;
  private readonly capacity: number;
  private readonly reserveTokens: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  /** background takes nothing before this time (cakeutils said its own bucket is nearly empty) */
  private backgroundPausedUntil = 0;

  constructor(o: BucketOptions) {
    this.capacity = Math.max(1, Math.floor(o.burst));
    this.perMs = Math.max(1, o.ratePerMinute) / 60_000;
    this.reserveTokens = Math.min(this.capacity - 1, Math.floor(this.capacity * (o.reserve ?? 0.5)));
    this.now = o.now ?? Date.now;
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.tokens = this.capacity;
    this.last = this.now();
  }

  private refill(): void {
    const t = this.now();
    if (t > this.last) {
      this.tokens = Math.min(this.capacity, this.tokens + (t - this.last) * this.perMs);
      this.last = t;
    }
  }

  /** Tokens a priority needs in the bucket before it may take one. */
  private floor(p: Priority): number {
    return p === "page" ? 1 : this.reserveTokens + 1;
  }

  /** Take a token now if this priority may; never waits. */
  tryTake(p: Priority): boolean {
    this.refill();
    if (p === "background" && this.now() < this.backgroundPausedUntil) return false;
    if (this.tokens >= this.floor(p)) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /** ms until `p` could take a token (0 = now). */
  waitFor(p: Priority): number {
    this.refill();
    const pause = p === "background" ? Math.max(0, this.backgroundPausedUntil - this.now()) : 0;
    const need = this.floor(p) - this.tokens;
    return Math.max(pause, need <= 0 ? 0 : Math.ceil(need / this.perMs));
  }

  /** Take a token, waiting up to `maxWaitMs`; false when it would take longer. */
  async take(p: Priority, maxWaitMs: number): Promise<boolean> {
    const deadline = this.now() + maxWaitMs;
    for (;;) {
      if (this.tryTake(p)) return true;
      const w = this.waitFor(p);
      if (this.now() + w > deadline) return false;
      await this.sleep(Math.max(1, Math.min(w, 1000)));
    }
  }

  /**
   * cakeutils' `RateLimit-Remaining` (tokens left in the token's own burst bucket): when it runs low,
   * background steps back for a while. A fixed threshold, not a share of this bucket: the site's
   * CAKEUTILS_BURST says nothing about the token's burst, and a large one would pause every call.
   */
  observeRemaining(remaining: number | null): void {
    if (remaining === null || !Number.isFinite(remaining)) return;
    if (remaining <= LOW_REMAINING) this.backgroundPausedUntil = this.now() + 10_000;
  }

  /** Tokens left right now (rounded down), for status. */
  get available(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}
