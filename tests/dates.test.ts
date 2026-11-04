import { expect, test } from "bun:test";
import { ago, asOf, dateTime, day } from "#lib/format/dates.ts";

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
