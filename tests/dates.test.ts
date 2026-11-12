import { describe, expect, test } from "bun:test";
import { ago, asOf, dateTime, day, setZoneSource, utcDay, utcHm, validZone } from "#lib/format/dates.ts";

const T = Date.UTC(2026, 10, 4, 17, 44, 39);

test("day and dateTime read like reki", () => {
  expect(day(T)).toBe("4 Nov 2026");
  expect(dateTime(T)).toBe("4 Nov 2026, 17:44 UTC");
});

test("asOf drops the date on the same day", () => {
  expect(asOf(T, T + 60_000)).toBe("as of 17:44 UTC");
  expect(asOf(T, T + 86_400_000)).toBe("as of 4 Nov 2026, 17:44 UTC");
});

test("ago", () => {
  expect(ago(T, T + 30_000)).toBe("just now");
  expect(ago(T, T + 120_000)).toBe("2 min ago");
  expect(ago(T, T + 3 * 3_600_000)).toBe("3 h ago");
  expect(ago(T, T + 86_400_000)).toBe("1 day ago");
  expect(ago(T, T + 30 * 86_400_000)).toBe("4 Nov 2026");
});

describe("the visitor's time zone (stored UTC, shown local)", () => {
  const t = Date.UTC(2026, 10, 4, 23, 30); // 4 Nov 2026, 23:30 UTC
  const withZone = (z: string, f: () => void) => {
    setZoneSource(() => z);
    try {
      f();
    } finally {
      setZoneSource(() => "UTC");
    }
  };
  test("UTC by default", () => {
    expect(dateTime(t)).toBe("4 Nov 2026, 23:30 UTC");
  });
  test("a moment moves to the visitor's day and names the zone", () => {
    withZone("Europe/Budapest", () => {
      expect(day(t)).toBe("5 Nov 2026");
      expect(dateTime(t)).toBe("5 Nov 2026, 00:30 CET");
      expect(asOf(t, t + 60_000)).toBe("as of 00:30 CET");
    });
    withZone("America/New_York", () => expect(dateTime(t)).toBe("4 Nov 2026, 18:30 EST"));
  });
  test("UTC buckets keep UTC labels whatever the zone", () => {
    withZone("Asia/Tokyo", () => {
      expect(utcDay(t)).toBe("4 Nov 2026");
      expect(utcHm(t)).toBe("23:30");
    });
  });
  test("only real zone names from the cookie", () => {
    expect(validZone("Europe/Budapest")).toBe("Europe/Budapest");
    expect(validZone("Not/AZone")).toBeNull();
    expect(validZone("x; path=/")).toBeNull();
    expect(validZone(undefined)).toBeNull();
  });
});
