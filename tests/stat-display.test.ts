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

// Outputs of cakeutils' StatDisplay.format run on JDK 21 (4 Nov 2026). Java rounds HALF_UP on the
// shortest decimal form of the double; JS toFixed alone gets 100 500 cm, 4565 cm and 15 cm wrong.
describe("rounding like Java's String.format", () => {
  const cases: [number, string][] = [
    [100_500, "1.01 km"], [-100_500, "-1.01 km"], [4_565, "45.7 m"], [4_555, "45.6 m"], [-4_565, "-45.7 m"],
    [123_455, "1.23 km"], [1_234_567, "12.35 km"], [5, "0.1 m"], [15, "0.2 m"], [25, "0.3 m"], [35, "0.4 m"],
    [99_995, "1000.0 m"], [-99_995, "-1000.0 m"], [100_000, "1.00 km"], [99_999_949, "1000.00 km"], [250_005, "2.50 km"],
    [100_050, "1.00 km"], [99_949, "999.5 m"], [-1, "-0.0 m"], [-5, "-0.1 m"], [9_007_199_254_740, "90071992.55 km"]
  ];
  for (const [cm, want] of cases) test(`${cm} cm`, () => expect(formatStat("distance_cm", cm)).toBe(want));
  test("damage", () => {
    expect(formatStat("damage_tenths", -125)).toBe("-12.5 ♥");
    expect(formatStat("damage_tenths", -1)).toBe("-0.1 ♥");
    expect(formatStat("damage_tenths", 0)).toBe("0.0 ♥");
    expect(formatStat("damage_tenths", 99_999)).toBe("9999.9 ♥");
  });
});
