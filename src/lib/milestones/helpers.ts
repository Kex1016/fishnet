// Pure helpers for the milestone components and the /milestones page (PLAN §2.5, §3.5). No imports from
// the server side, so the components can use them in the browser too.
import type { MilestoneRow, MilestoneFeedRow } from "#lib/api/types.ts";
import { parseMetric, boardHref } from "#lib/api/metric.ts";
import { milestonePhrase, statTitle, type Phrase } from "#lib/format/labels.ts";

/** What a rung says about its time: exact, before tracking, or not reached. */
export type When = { state: "at"; at: number } | { state: "before" } | { state: "none" };

export function whenOf(m: Pick<MilestoneRow, "reached_at" | "backfilled">): When {
  if (m.backfilled) return { state: "before" };
  if (typeof m.reached_at === "number") return { state: "at", at: m.reached_at };
  return { state: "none" };
}

type StatOf = Pick<MilestoneFeedRow, "type" | "subject" | "stat_name">;

/** The stat a feed row is about, in words (#lib/format/labels.ts): "Pufferfish killed", "Mobs killed" for a type total. */
export function statLabel(m: StatOf): string {
  return statTitle({ type: m.type, subject: m.subject, subjectName: m.stat_name });
}

/** A feed row as a sentence around its threshold: "Killed 1000 Pufferfish", "Killed by Zombie 50 times". */
export function rowPhrase(m: StatOf & Pick<MilestoneFeedRow, "display" | "threshold">): Phrase {
  return milestonePhrase({ type: m.type, subject: m.subject, subjectName: m.stat_name }, m.display, m.threshold);
}

/** Where a row's stat has its board on this site, or null when the metric cannot be read. */
export function statHref(m: Pick<MilestoneFeedRow, "metric">, scope?: string): string | null {
  const metric = parseMetric(m.metric);
  return metric ? boardHref(metric, scope) : null;
}

/** A row's player when the API knows one (the player endpoint's rows carry none; the feed's can be null). */
export function whoOf(m: { uuid?: string | null; name?: string | null }): { uuid: string; name: string } | null {
  return m.uuid && m.name ? { uuid: m.uuid, name: m.name } : null;
}

/** A stable key for a feed row (the same threshold of the same stat only exists once per scope). */
export function rowKey(m: Pick<MilestoneFeedRow, "metric" | "threshold">): string {
  return `${m.metric}#${m.threshold}`;
}

export type First = { uuid: string; name: string; count: number };

/** Players ranked by how many milestones they were first to: count descending, then name. Rows without a known player are skipped. */
export function firstsByPlayer(rows: { uuid?: string | null; name?: string | null }[]): First[] {
  const by = new Map<string, First>();
  for (const r of rows) {
    const w = whoOf(r);
    if (!w) continue;
    const hit = by.get(w.uuid);
    if (hit) hit.count++;
    else by.set(w.uuid, { ...w, count: 1 });
  }
  return [...by.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** The first rung nobody has reached yet (the "next" one), or -1 when the ladder is complete or empty. */
export function nextRung(milestones: MilestoneRow[]): number {
  return milestones.findIndex((m) => !m.backfilled && m.reached_at == null);
}

// ---- the per-day heatmap grid

const DAY = 86_400_000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dayStart(ms: number): number {
  return Math.floor(ms / DAY) * DAY;
}

/** 0 = Monday … 6 = Sunday, for a UTC day start. */
function weekday(dayMs: number): number {
  return (new Date(dayMs).getUTCDay() + 6) % 7;
}

export type DayCells = { rows: { label: string; cells: (number | null)[] }[]; columns: string[]; weeks: number };

/**
 * Milestones per day as a weekday × week grid (Mon–Sun rows, one column per week, labelled with the
 * Monday's date). Days before `since` (the recorder's start) and days in the future are null (no data);
 * days after it with no entry are a real 0. With no `since` or no data at all, every cell is null.
 */
export function dayGrid(days: { day: number; v: number }[], since: number | null, now: number, maxWeeks = 13): DayCells {
  const today = dayStart(now);
  const known = new Map(days.map((d) => [dayStart(d.day), d.v]));
  const first = days.length ? Math.min(...days.map((d) => dayStart(d.day))) : since != null ? dayStart(since) : today;
  const from = since != null ? Math.min(first, dayStart(since)) : first;
  const monday = (d: number) => d - weekday(d) * DAY;
  const lastMonday = monday(today);
  const firstMonday = Math.max(monday(from), lastMonday - (maxWeeks - 1) * 7 * DAY);
  const weeks = Math.round((lastMonday - firstMonday) / (7 * DAY)) + 1;
  const empty = days.length === 0;
  const rows = WEEKDAYS.map((label, wd) => ({
    label,
    cells: Array.from({ length: weeks }, (_, w) => {
      const d = firstMonday + (w * 7 + wd) * DAY;
      if (empty || d > today) return null;
      const v = known.get(d);
      if (v !== undefined) return v;
      return since != null && d >= dayStart(since) ? 0 : null;
    })
  }));
  const columns = Array.from({ length: weeks }, (_, w) => {
    const d = new Date(firstMonday + w * 7 * DAY);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  });
  return { rows, columns, weeks };
}
