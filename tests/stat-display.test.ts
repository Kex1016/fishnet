import { describe, expect, test } from "bun:test";
import { axisTick, compact, durationMs, formatStat } from "#lib/format/stat-display.ts";

// The first two blocks mirror cakeutils' core StatDisplayTest (STATS §7): keep them identical.
describe("formatStat", () => {
  test("units as STATS §7 says", () => {
    expect(formatStat("count", 1234)).toBe("1234");
    expect(formatStat("count", -3)).toBe("-3");
    expect(formatStat("distance_cm", 4_560)).toBe("45.6 m");
    expect(formatStat("distance_cm", 123_456)).toBe("1.23 km");
    expect(formatStat("distance_cm", 0)).toBe("0.0 m");
    expect(formatStat("ticks", (26 * 60 + 3) * 60 * 20)).toBe("1d 2h 3m");
    expect(formatStat("ticks", 2 * 3600 * 20)).toBe("2h 0m");
    expect(formatStat("ticks", 59 * 20)).toBe("0m");
    expect(formatStat("ticks", -61 * 60 * 20)).toBe("-1h 1m");
    expect(formatStat("damage_tenths", 125)).toBe("12.5 ♥");
  });
  test("durations in milliseconds", () => {
    expect(durationMs(7_200_000)).toBe("2h 0m");
    expect(durationMs(60_000)).toBe("1m");
    expect(durationMs(59_999)).toBe("0m");
    expect(durationMs(((4 * 24 + 2) * 60 + 9) * 60_000)).toBe("4d 2h 9m");
    expect(durationMs(0)).toBe("0m");
    expect(formatStat("ms", 7_200_000)).toBe("2h 0m");
  });
  test("an unknown unit is a plain number", () => {
    expect(formatStat("furlongs", 42)).toBe("42");
  });
});

describe("axis ticks", () => {
  test("compact counts", () => {
    expect(compact(999)).toBe("999");
    expect(compact(1234)).toBe("1.2k");
    expect(compact(1_000_000)).toBe("1M");
    expect(compact(2_500_000_000)).toBe("2.5B");
  });
  test("other units", () => {
    expect(axisTick("distance_cm", 250_000)).toBe("2.5 km");
    expect(axisTick("distance_cm", 4_500)).toBe("45 m");
    expect(axisTick("ticks", 20 * 3600 * 3)).toBe("3h");
    expect(axisTick("ms", 3_600_000 * 72)).toBe("3d");
    expect(axisTick("ms", 60_000 * 20)).toBe("20m");
    expect(axisTick("damage_tenths", 125)).toBe("12.5 ♥");
  });
});
