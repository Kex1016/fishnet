import { expect, test } from "bun:test";
import { Lru } from "#lib/server/cakeutils/lru.ts";
import { TokenBucket } from "#lib/server/cakeutils/bucket.ts";
import { maxAgeMs, policyFor, ttlMs } from "#lib/server/cakeutils/policy.ts";
import { displayUrl, scrub, tokenId } from "#lib/server/cakeutils/redact.ts";

test("LRU evicts the least recently used by count and by bytes", () => {
  const l = new Lru<number>(3, 100);
  l.set("a", 1, 10);
  l.set("b", 2, 10);
  l.set("c", 3, 10);
  l.get("a");
  l.set("d", 4, 10);
  expect(l.peek("b")).toBeUndefined();
  expect(l.peek("a")).toBe(1);
  l.set("e", 5, 95);
  expect(l.size).toBe(1);
  expect(l.byteSize).toBe(95);
});

test("token bucket refills at the per-minute rate", async () => {
  let t = 0;
  const b = new TokenBucket({ ratePerMinute: 60, burst: 2, now: () => t, sleep: async (ms) => void (t += ms) });
  expect(b.tryTake("page")).toBe(true);
  expect(b.tryTake("page")).toBe(true);
  expect(b.tryTake("page")).toBe(false);
  expect(await b.take("page", 1_000)).toBe(true);
  expect(t).toBe(1_000);
  expect(await b.take("page", 10)).toBe(false);
});

test("cakeutils' RateLimit-Remaining pauses background for a while", () => {
  let t = 0;
  const b = new TokenBucket({ ratePerMinute: 600, burst: 60, now: () => t });
  b.observeRemaining(1);
  expect(b.tryTake("background")).toBe(false);
  expect(b.tryTake("page")).toBe(true);
  t += 10_001;
  expect(b.tryTake("background")).toBe(true);
});

test("a large CAKEUTILS_BURST does not pause background while cakeutils has room", () => {
  let t = 0;
  const b = new TokenBucket({ ratePerMinute: 6000, burst: 1000, now: () => t });
  b.observeRemaining(50);
  expect(b.tryTake("background")).toBe(true);
  b.observeRemaining(5);
  expect(b.tryTake("background")).toBe(false);
});

test("policies and Cache-Control", () => {
  expect(maxAgeMs("private, max-age=5")).toBe(5_000);
  expect(maxAgeMs("no-store")).toBe(0);
  expect(maxAgeMs(null)).toBe(0);
  expect(maxAgeMs("private, max-age=31536000, immutable")).toBe(Infinity);
  expect(ttlMs(policyFor("/v2/network"), "private, max-age=5")).toBe(5_000);
  expect(ttlMs(policyFor("/v2/network"), "private, max-age=30")).toBe(30_000);
  expect(ttlMs(policyFor("/v2/leaderboards/playtime?scope=server%3Aa"), "private, max-age=5")).toBe(15_000);
  expect(ttlMs(policyFor("/v2/stats/subjects?type=mined"), null)).toBe(600_000);
  expect(policyFor("/v2/health").staleOk).toBe(false);
  expect(policyFor("/v2/players/x/stats").cls).toBe("live");
});

test("redaction", () => {
  expect(tokenId("cu_abc123_secretpart")).toBe("cu_abc123");
  expect(tokenId("")).toBe("(none)");
  expect(displayUrl("https://user:pw@api.example:8443/v2/x?q=1")).toBe("https://api.example:8443");
  const s = scrub("GET https://api.example:8443/v2/players/x failed with Bearer cu_abc123_secretpart");
  expect(s).toBe("GET https://api.example:8443 failed with Bearer cu_abc123");
});
