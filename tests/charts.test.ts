// The pure helpers behind the charts (W3): ticks, labels, paths, buckets.
import { describe, expect, test } from "bun:test";
import { areaPath, axisTop, columnPath, columnWidth, compact, heatLevel, labelEvery, linePath, linkedShare, nearestIndex, niceFloor, niceStep, niceTicks, tickLabel, timeLabel, timeReadout, uptimeBuckets, xByTime, yOf } from "../src/lib/charts/scale.ts";

describe("ticks", () => {
  test("nice steps", () => {
    expect(niceStep(14)).toBe(5);
    expect(niceStep(100)).toBe(25);
    expect(niceStep(3)).toBe(1);
    expect(niceStep(0)).toBe(1);
  });
  test("ticks run from zero past the max", () => {
    expect(niceTicks(14)).toEqual([0, 5, 10, 15]);
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(1)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(axisTop(14)).toBe(15);
    expect(axisTop(1_234_567)).toBeGreaterThanOrEqual(1_234_567);
  });
  test("compact labels", () => {
    expect(compact(950)).toBe("950");
    expect(compact(9999)).toBe("9999");
    expect(compact(12_000)).toBe("12K");
    expect(compact(12_500)).toBe("13K");
    expect(compact(1_200_000)).toBe("1.2M");
    expect(compact(2_000_000_000)).toBe("2B");
  });
  test("tick labels by unit", () => {
    expect(tickLabel("count", 0)).toBe("0");
    expect(tickLabel("count", 25_000)).toBe("25K");
    expect(tickLabel("ms", 3_600_000)).toBe("1h 0m");
    expect(tickLabel("distance_cm", 150_000)).toBe("1.50 km");
    expect(tickLabel("damage_tenths", 125)).toBe("12.5 ♥");
    // an unknown unit formats as a plain number
    expect(tickLabel("furlongs" as never, 12_000)).toBe("12K");
  });
  test("time labels: hours inside two days, days beyond", () => {
    const t = Date.UTC(2026, 10, 4, 17, 44);
    expect(timeLabel(t, 3_600_000)).toBe("17:44");
    expect(timeLabel(t, 30 * 86_400_000)).toBe("4 Nov");
  });
  test("label thinning keeps a minimum width per label", () => {
    expect(labelEvery(12, 40, 30)).toBe(1);
    expect(labelEvery(12, 10, 30)).toBe(3);
    expect(labelEvery(1, 1, 30)).toBe(1);
  });
});

describe("geometry", () => {
  test("columns cap at 24px and leave a gap", () => {
    expect(columnWidth(60)).toBe(24);
    expect(columnWidth(10)).toBe(8);
    expect(columnWidth(2)).toBe(1);
  });
  test("column path: rounded top, square base", () => {
    expect(columnPath(10, 20, 24, 30, 3)).toBe("M10,50V23Q10,20 13,20H31Q34,20 34,23V50Z");
    expect(columnPath(10, 20, 24, 0, 3)).toBe("");
    // the radius shrinks with a short column
    expect(columnPath(0, 0, 10, 1, 3)).toBe("M0,1V1Q0,0 1,0H9Q10,0 10,1V1Z");
  });
  test("x by time places uneven samples where they belong", () => {
    expect(xByTime([{ t: 0 }, { t: 10 }, { t: 40 }], 0, 100)).toEqual([0, 25, 100]);
    expect(xByTime([{ t: 5 }], 0, 100)).toEqual([0]);
    expect(xByTime([], 0, 100)).toEqual([]);
  });
  test("y clamps to the axis", () => {
    expect(yOf(0, 10, 0, 100)).toBe(100);
    expect(yOf(10, 10, 0, 100)).toBe(0);
    expect(yOf(50, 10, 0, 100)).toBe(0);
    expect(yOf(5, 0, 0, 100)).toBe(100);
  });
  test("line and area paths", () => {
    expect(linePath([0, 10], [5, 7])).toBe("M0,5L10,7");
    expect(areaPath([0, 10], [5, 7], 20)).toBe("M0,5L10,7L10,20L0,20Z");
    expect(areaPath([], [], 20)).toBe("");
  });
  test("nearest index", () => {
    expect(nearestIndex([0, 10, 20], 12)).toBe(1);
    expect(nearestIndex([0, 10, 20], 99)).toBe(2);
  });
  test("heat levels: zero is 0, max is 4", () => {
    expect(heatLevel(0, 10)).toBe(0);
    expect(heatLevel(1, 10)).toBe(1);
    expect(heatLevel(5, 10)).toBe(2);
    expect(heatLevel(10, 10)).toBe(4);
    expect(heatLevel(3, 0)).toBe(0);
  });
});

describe("uptime buckets", () => {
  const m = 60_000;
  const samples = [
    { t: 0, online: 2, waiting: 0, linked: true },
    { t: 1 * m, online: 4, waiting: 1, linked: true },
    { t: 2 * m, online: 0, waiting: 0, linked: false },
    { t: 3 * m, online: 0, waiting: 3, linked: false },
    { t: 6 * m, online: 6, waiting: 0, linked: true }
  ];
  test("fixed widths, means inside, unknown where nothing was sampled", () => {
    const b = uptimeBuckets(samples, 2 * m);
    expect(b.length).toBe(3);
    expect(b[0]).toMatchObject({ t0: 0, t1: 2 * m, n: 2, online: 3, waiting: 0.5, linked: "all" });
    expect(b[1]).toMatchObject({ n: 2, online: 0, linked: "none" });
    expect(b[2]).toMatchObject({ n: 1, online: 6, linked: "all" });
    expect(uptimeBuckets([{ t: 0, online: 1, waiting: 0, linked: true }], m)).toEqual([]);
  });
  test("a bucket with mixed samples is partly linked; a gap is unknown", () => {
    // the last sample sits on the range's end and joins the last bucket
    const b = uptimeBuckets(samples, 3 * m);
    expect(b.map((x) => x.linked)).toEqual(["some", "some"]);
    const gap = uptimeBuckets([samples[0], samples[4]], m);
    expect(gap.map((x) => x.linked)).toEqual(["all", "unknown", "unknown", "unknown", "unknown", "all"]);
    expect(linkedShare(gap)).toBe(1);
    expect(linkedShare(b)).toBe(0);
    expect(linkedShare([])).toBeNull();
  });
  test("default: the range split into 96 buckets", () => {
    const b = uptimeBuckets([samples[0], { ...samples[4], t: 96 * m }]);
    expect(b.length).toBe(96);
  });
});

describe("time ticks", () => {
  test("ms ticks land on minutes, hours and days", () => {
    expect(niceTicks(148_000_000, 4, "ms")).toEqual([0, 43_200_000, 86_400_000, 129_600_000, 172_800_000]);
    expect(niceTicks(9 * 60_000, 4, "ms")).toEqual([0, 300_000, 600_000]);
    expect(niceTicks(7 * 60_000, 4, "ms")).toEqual([0, 120_000, 240_000, 360_000, 480_000]);
    expect(niceTicks(400 * 86_400_000, 4, "ms")[1]).toBe(100 * 86_400_000);
  });
  test("ticks (20 per second) likewise", () => {
    expect(niceTicks(20 * 3600 * 5, 4, "ticks")).toEqual([0, 20 * 3600 * 2, 20 * 3600 * 4, 20 * 3600 * 6]);
  });
});

describe("axis floor", () => {
  test("a nice floor below the minimum, never below zero", () => {
    expect(niceFloor(2_000_000_000, 3_335_200_000)).toBe(2_000_000_000);
    expect(niceFloor(37, 52)).toBe(35);
    expect(niceFloor(0, 10)).toBe(0);
    expect(niceFloor(5, 5)).toBe(0);
  });
  test("readouts shorten with the span", () => {
    const t = Date.UTC(2026, 10, 4, 17, 44);
    expect(timeReadout(t, 3_600_000)).toBe("17:44 UTC");
    expect(timeReadout(t, 7 * 86_400_000)).toBe("4 Nov, 17:44 UTC");
    expect(timeReadout(t, 90 * 86_400_000)).toBe("4 Nov 2026");
  });
});
