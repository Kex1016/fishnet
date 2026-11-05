// The transport under the typed client (PLAN §3.2): one in-memory LRU keyed by request, TTL = the
// answer's max-age raised to a floor per tier of data (policy.ts), stale-while-revalidate per tier
// (refreshes take a token only when one is spare, so they never crowd out a page), ETag
// revalidation, single-flight for concurrent misses, serve-stale-on-error up to 24 h, a token
// bucket with page and background priorities (bucket.ts), and Retry-After on 429.
//
// Nothing here throws to a caller: every path ends in a Result. Logs carry the token's public id
// and scheme://host:port only, and only on state changes (down, up again, refused, throttled), so
// an outage writes a few lines, not one per page view.
import { fail, listIsEmpty, ok, type Failure, type FailureKind, type Result } from "#lib/api/result.ts";
import type { Problem } from "#lib/api/types.ts";
import { TokenBucket, type Priority } from "./bucket.ts";
import { Lru } from "./lru.ts";
import { policyFor, swrMs, ttlMs, type Policy } from "./policy.ts";
import { displayUrl, scrub, tokenId } from "./redact.ts";
import type { FetchLike } from "./mock/index.ts";

export type { Priority };

export type CoreOptions = {
  baseUrl: string;
  token: string;
  fetchImpl?: FetchLike;
  log?: (line: string) => void;
  /** requests per minute the site allows itself (CAKEUTILS_RATE); default 400 */
  ratePerMinute?: number;
  /** bucket capacity (CAKEUTILS_BURST); default 60 */
  burst?: number;
  /** clock and sleep, for tests */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** per-request timeout; default 4 s for pages, 15 s for background */
  timeoutMs?: Partial<Record<Priority, number>>;
  /** how long a request may wait for a token; default 1.5 s for pages, 60 s for background */
  waitMs?: Partial<Record<Priority, number>>;
  /** LRU bounds; default 20 000 entries, 64 MiB */
  maxEntries?: number;
  maxBytes?: number;
  /** oldest good answer served while cakeutils is down; default 24 h */
  staleMaxMs?: number;
  /** after a failed connection, how long to answer from cache without trying again; default 5 s */
  downCooldownMs?: number;
};

export type Request = {
  /** `/v2/...` with its query */
  path: string;
  method?: "GET" | "POST";
  body?: string;
  /** icons: the answer is `{ png, etag }` instead of JSON */
  binary?: boolean;
};

export type CoreStatus = {
  /** false between a failed request and the next good one */
  reachable: boolean;
  /** epoch ms of the first failure of the current outage, or null */
  downSince: number | null;
  /** epoch ms of the last answer cakeutils gave (any status but 5xx) */
  lastOkAt: number | null;
  /** last failure, scrubbed (no token, no path) */
  lastError: string | null;
  /** when the last 429 said to try again, or null */
  rateLimitedUntil: number | null;
  cache: { entries: number; bytes: number; hits: number; misses: number; staleServed: number };
  tokens: number;
  /** where rejections come from: cakeutils' own 429s vs. the site's bucket saying no before asking */
  throttle: {
    /** 429 answers from cakeutils since start */
    upstream429: number;
    /** requests the site's own bucket turned away (no token within the page's wait) since start */
    localRefused: number;
    /** refreshes skipped because no token was spare (the cached answer was served instead) */
    refreshSkipped: number;
    /** requests per minute the site allows itself now (CAKEUTILS_RATE, lowered to the token's limit) */
    ratePerMinute: number;
    /** the token's own per-minute limit as cakeutils reports it (RateLimit-Limit), or null before the first answer */
    tokenLimit: number | null;
    /** epoch ms of the last 429 from cakeutils, or null */
    last429At: number | null;
  };
};

export interface Core {
  get<T>(req: Request, priority: Priority): Promise<Result<T>>;
  milestonesEnabled(priority: Priority): Promise<boolean>;
  /** D-111: true when /v2/milestones/advancements exists on this proxy (a D-109 proxy without it answers 404). */
  advancementsEnabled(priority: Priority): Promise<boolean>;
  status(): CoreStatus;
}

type Good = {
  good: true;
  data: unknown;
  etag: string | null;
  asOf: number;
  expires: number;
  ttl: number;
  /** served after a failed refresh; the page shows "as of" */
  stale: boolean;
  size: number;
  binary: boolean;
};
type Bad = { good: false; failure: Failure; expires: number };
type Entry = Good | Bad;

const DAY = 24 * 60 * 60_000;
const FEATURE_CHECK_MS = 10 * 60_000;

export function createCore(o: CoreOptions): Core {
  const f: FetchLike = o.fetchImpl ?? ((input, init) => fetch(input, init));
  const log = o.log ?? ((l: string) => console.warn(l));
  const now = o.now ?? Date.now;
  const timeout: Record<Priority, number> = { page: 4_000, background: 15_000, ...o.timeoutMs };
  const wait: Record<Priority, number> = { page: 1_500, background: 60_000, ...o.waitMs };
  const staleMax = o.staleMaxMs ?? DAY;
  const cooldown = o.downCooldownMs ?? 5_000;
  const base = o.baseUrl.replace(/\/+$/, "");
  const who = `${displayUrl(base)} as ${tokenId(o.token)}`;

  const cache = new Lru<Entry>(o.maxEntries ?? 20_000, o.maxBytes ?? 64 * 1024 * 1024);
  const flights = new Map<string, Promise<Result<unknown>>>();
  const bucket = new TokenBucket({ ratePerMinute: o.ratePerMinute ?? 400, burst: o.burst ?? 60, now, sleep: o.sleep });

  let downSince: number | null = null;
  let downUntil = 0;
  let lastOkAt: number | null = null;
  let lastError: string | null = null;
  let blockedUntil = 0;
  let lastRefusedLog = -Infinity;
  let lastThrottleLog = -Infinity;
  const counters = { hits: 0, misses: 0, staleServed: 0 };
  const throttle = { upstream429: 0, localRefused: 0, refreshSkipped: 0 };
  let tokenLimit: number | null = null;
  let last429At: number | null = null;

  function answer<T>(e: Entry): Result<T> {
    if (!e.good) return { ...e.failure };
    if (e.stale) counters.staleServed++;
    return ok(e.data as T, e.asOf, { stale: e.stale, empty: !e.binary && listIsEmpty(e.data) });
  }

  function markDown(reason: string): void {
    const t = now();
    downUntil = t + cooldown;
    lastError = scrub(reason);
    if (downSince === null) {
      downSince = t;
      log(`cakeutils unreachable at ${who}: ${lastError}; serving last good answers up to ${Math.round(staleMax / 3_600_000)} h old`);
    }
  }

  function markUp(): void {
    const t = now();
    lastOkAt = t;
    if (downSince !== null) {
      log(`cakeutils reachable again at ${displayUrl(base)} after ${Math.max(1, Math.round((t - downSince) / 1000))} s`);
      downSince = null;
      downUntil = 0;
    }
  }

  /** The last good answer when the policy allows it and it is young enough, else a failure. */
  function fallback<T>(key: string, policy: Policy, kind: FailureKind, extra: Omit<Failure, "ok" | "kind">, retryAt: number): Result<T> {
    const prev = cache.peek(key);
    const t = now();
    if (prev?.good && policy.staleOk && t - prev.asOf <= staleMax) {
      prev.stale = true;
      prev.expires = Math.max(t + 1, retryAt);
      return answer<T>(prev);
    }
    return fail(kind, { ...extra, ...(prev?.good ? { asOf: prev.asOf } : {}) });
  }

  async function readProblem(res: Response): Promise<Problem | undefined> {
    try {
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("json")) return undefined;
      const p = (await res.json()) as Problem;
      return p && typeof p === "object" ? p : undefined;
    } catch {
      return undefined;
    }
  }

  function retryAfterSeconds(h: string | null): number {
    if (!h) return 1;
    const n = Number(h);
    if (Number.isFinite(n)) return Math.max(1, Math.ceil(n));
    const d = Date.parse(h);
    return Number.isFinite(d) ? Math.max(1, Math.ceil((d - Date.now()) / 1000)) : 1;
  }

  async function fetchInto<T>(key: string, req: Request, policy: Policy, priority: Priority): Promise<Result<T>> {
    counters.misses++;
    const t0 = now();
    if (t0 < blockedUntil) {
      return fallback<T>(key, policy, "rate_limited", { retryAfter: Math.max(1, Math.ceil((blockedUntil - t0) / 1000)) }, blockedUntil);
    }
    if (t0 < downUntil) return fallback<T>(key, policy, "down", {}, downUntil);

    if (!(await bucket.take(priority, wait[priority]))) {
      throttle.localRefused++;
      const w = bucket.waitFor(priority);
      return fallback<T>(key, policy, "rate_limited", { retryAfter: Math.max(1, Math.ceil(w / 1000)) }, now() + Math.max(w, 1000));
    }

    const prev = cache.peek(key);
    const prevGood = prev?.good ? prev : undefined;
    const headers: Record<string, string> = { accept: req.binary ? "image/png" : "application/json" };
    if (o.token) headers.authorization = `Bearer ${o.token}`;
    if (req.body !== undefined) headers["content-type"] = "application/json";
    if (prevGood?.etag) headers["if-none-match"] = prevGood.etag;

    let res: Response;
    try {
      res = await f(`${base}${req.path}`, { method: req.method ?? "GET", headers, body: req.body, signal: AbortSignal.timeout(timeout[priority]) });
    } catch (e) {
      const err = e as Error;
      markDown(err?.name === "TimeoutError" || err?.name === "AbortError" ? `no answer within ${timeout[priority] / 1000} s` : String(err?.message ?? e));
      return fallback<T>(key, policy, "down", {}, downUntil);
    }

    const t = now();
    const remaining = res.headers.get("ratelimit-remaining");
    bucket.observeRemaining(remaining === null ? null : Number(remaining));
    observeLimit(res.headers.get("ratelimit-limit"));
    const cc = res.headers.get("cache-control");
    const status = res.status;

    if (status === 304 && prevGood) {
      markUp();
      prevGood.asOf = t;
      prevGood.ttl = ttlMs(policy, cc);
      prevGood.expires = t + prevGood.ttl;
      prevGood.stale = false;
      prevGood.etag = res.headers.get("etag") ?? prevGood.etag;
      return answer<T>(prevGood);
    }

    if (status >= 200 && status < 300) {
      let data: unknown;
      let size: number;
      try {
        if (req.binary) {
          const png = new Uint8Array(await res.arrayBuffer());
          data = { png, etag: res.headers.get("etag") };
          size = png.byteLength + 200;
        } else {
          const text = await res.text();
          data = JSON.parse(text);
          size = text.length * 2 + 200;
        }
      } catch (e) {
        lastError = scrub(`unreadable answer from ${req.method ?? "GET"} (${(e as Error).message})`);
        return fallback<T>(key, policy, "down", { status }, t + cooldown);
      }
      markUp();
      const ttl = ttlMs(policy, cc);
      const entry: Good = { good: true, data, etag: req.binary ? null : res.headers.get("etag"), asOf: t, expires: t + ttl, ttl, stale: false, size, binary: !!req.binary };
      cache.set(key, entry, size);
      return answer<T>(entry);
    }

    if (status === 404 || status === 400) {
      markUp();
      const failure = fail(status === 404 ? "not_found" : "bad_request", { status, problem: await readProblem(res) });
      cache.set(key, { good: false, failure, expires: t + policy.negativeMs }, 400);
      return { ...failure };
    }

    if (status === 429) {
      markUp();
      throttle.upstream429++;
      last429At = t;
      const ra = retryAfterSeconds(res.headers.get("retry-after"));
      blockedUntil = t + ra * 1000;
      if (t - lastThrottleLog > 60_000) {
        lastThrottleLog = t;
        log(`cakeutils rate-limited ${tokenId(o.token)}: waiting ${ra} s (CAKEUTILS_RATE / CAKEUTILS_BURST may be above the token's limit)`);
      }
      return fallback<T>(key, policy, "rate_limited", { status, retryAfter: ra, problem: await readProblem(res) }, blockedUntil);
    }

    if (status === 401 || status === 403) {
      markUp();
      lastError = `refused (${status})`;
      if (t - lastRefusedLog > 10 * 60_000) {
        lastRefusedLog = t;
        log(`cakeutils refused ${tokenId(o.token)}: ${status} (check the token and its scopes: read:players read:stats)`);
      }
      return fallback<T>(key, policy, "down", { status, problem: await readProblem(res) }, t + cooldown);
    }

    markDown(`HTTP ${status}`);
    return fallback<T>(key, policy, "down", { status, problem: await readProblem(res) }, downUntil);
  }

  /**
   * cakeutils' `RateLimit-Limit` is the token's per-minute rate. When CAKEUTILS_RATE is set above it
   * (say 400 against a token created without `--rate`, which gets cakeutils' default 120), every busy
   * minute ends in 429s; the bucket steps down to 90 % of the token's rate instead, and says so once.
   */
  function observeLimit(h: string | null): void {
    const n = h === null ? NaN : Number(h);
    if (!Number.isFinite(n) || n <= 0 || n === tokenLimit) return;
    tokenLimit = n;
    const before = bucket.ratePerMinute;
    bucket.capRate(Math.max(1, Math.floor(n * 0.9)));
    if (bucket.ratePerMinute !== before) {
      log(`cakeutils allows ${tokenId(o.token)} ${n} requests/min, below CAKEUTILS_RATE (${o.ratePerMinute ?? 400}): pacing at ${bucket.ratePerMinute}/min`);
    }
  }

  function flight<T>(key: string, run: () => Promise<Result<T>>): Promise<Result<T>> {
    const existing = flights.get(key);
    if (existing) return existing as Promise<Result<T>>;
    const p = run()
      .catch((e): Result<T> => {
        lastError = scrub(String((e as Error)?.message ?? e));
        return fail("down");
      })
      .finally(() => flights.delete(key));
    flights.set(key, p as Promise<Result<unknown>>);
    return p;
  }

  async function get<T>(req: Request, priority: Priority): Promise<Result<T>> {
    try {
      const key = req.method === "POST" ? `POST ${req.path} ${req.body ?? ""}` : req.path;
      const policy = policyFor(req.path);
      const e = cache.get(key);
      const t = now();
      if (e) {
        if (t < e.expires) {
          counters.hits++;
          return answer<T>(e);
        }
        // Pages get the cached answer at once inside the tier's window; the recorder ("background")
        // waits for a fresh one, so what it records is never older than the TTL.
        if (e.good && !e.stale && priority === "page" && t < e.expires + swrMs(policy, e.ttl)) {
          counters.hits++;
          if (!flights.has(key)) {
            // the refresh only takes a spare token (background priority, no waiting): when pages are
            // busy it is skipped and the next visitor in the window tries again
            if (bucket.waitFor("background") === 0) void flight(key, () => fetchInto(key, req, policy, "background"));
            else throttle.refreshSkipped++;
          }
          return answer<T>(e);
        }
      }
      // a page that joins a background flight keeps its own deadline: it does not wait a minute for a token
      return await flight<T>(key, () => fetchInto<T>(key, req, policy, priority));
    } catch (e) {
      lastError = scrub(String((e as Error)?.message ?? e));
      return fail("down");
    }
  }

  /**
   * Feature detection by probing one list route: 404 on it = a proxy without the feature; a good answer or a
   * 400 proves the route exists. Remembered 10 min; while cakeutils is down or throttling, the last known
   * value (a stale answer proves the route existed).
   */
  function feature(probePath: string): (priority: Priority) => Promise<boolean> {
    let known: { at: number; on: boolean } | null = null;
    return async (priority) => {
      const t = now();
      if (known && t - known.at < FEATURE_CHECK_MS) return known.on;
      const r = await get<unknown>({ path: probePath }, priority);
      if ((r.ok && !r.stale) || (!r.ok && r.kind === "bad_request")) known = { at: t, on: true };
      else if (!r.ok && r.kind === "not_found") known = { at: t, on: false };
      else return known?.on ?? r.ok;
      return known.on;
    };
  }

  return {
    get,
    milestonesEnabled: feature("/v2/milestones?limit=1"),
    advancementsEnabled: feature("/v2/milestones/advancements?limit=1"),
    status: () => ({
      reachable: downSince === null,
      downSince,
      lastOkAt,
      lastError,
      rateLimitedUntil: blockedUntil > now() ? blockedUntil : null,
      cache: { entries: cache.size, bytes: cache.byteSize, ...counters },
      tokens: bucket.available,
      throttle: { ...throttle, ratePerMinute: bucket.ratePerMinute, tokenLimit, last429At }
    })
  };
}
