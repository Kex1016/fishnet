// Loads shared by the One Soul pages. Paging through a list is capped so a page never fans out: at most
// MAX_PAGES calls of 100 rows each, all cached by the transport.
import type { Result } from "#lib/api/result.ts";
import type { Grave, OsEvent, Round, Soul } from "#lib/onesoul/types.ts";
import { oneSoul } from "./index.ts";

const MAX_PAGES = 5;

async function pages<T>(fetchPage: (offset: number) => Promise<Result<{ total: number } & Record<string, unknown>>>, key: string): Promise<{ rows: T[]; total: number; ok: boolean; asOf: number | null; stale: boolean; capped: boolean }> {
  const rows: T[] = [];
  let total = 0;
  let asOf: number | null = null;
  let stale = false;
  for (let i = 0; i < MAX_PAGES; i++) {
    const r = await fetchPage(i * 100);
    if (!r.ok) return { rows, total, ok: i > 0, asOf, stale, capped: false };
    total = r.data.total;
    asOf = asOf === null ? r.asOf : Math.min(asOf, r.asOf);
    stale ||= r.stale;
    const got = (r.data[key] as T[]) ?? [];
    rows.push(...got);
    if (rows.length >= total || got.length === 0) return { rows, total, ok: true, asOf, stale, capped: false };
  }
  return { rows, total, ok: true, asOf, stale, capped: rows.length < total };
}

/** Every soul (one round or all), in turn order. */
export function allSouls(server: string, cycle?: number | null) {
  return pages<Soul>((offset) => oneSoul().souls({ server, cycle: cycle ?? undefined, limit: 100, offset }), "souls");
}

export function allGraves(server: string, cycle?: number | null) {
  return pages<Grave>((offset) => oneSoul().graves({ server, cycle: cycle ?? undefined, limit: 100, offset }), "graves");
}

export function allEvents(server: string, q: { cycle?: number | null; kind?: string } = {}) {
  return pages<OsEvent>((offset) => oneSoul().events({ server, cycle: q.cycle ?? undefined, kind: q.kind, limit: 100, offset }), "events");
}

export type RoundSummary = Pick<Round, "cycle" | "started_at" | "ended_at" | "souls" | "total_survival_ms" | "longest" | "deaths"> & {
  state: string | null;
  graves: { total: number; claimed: number } | null;
  registered: number | null;
  scope: string | null;
  seed: Round["seed"];
  archive: string | null;
  prep_started_at: number | null;
};

/**
 * Every round, newest first: from GET /v2/onesoul/rounds when the proxy has it, else summed up from the
 * souls (counts inside one round, never across rounds; no graves, sign-ups or scope then).
 */
export async function roundSummaries(server: string, current: number): Promise<{ rounds: RoundSummary[]; full: boolean; asOf: number | null; stale: boolean }> {
  const c = oneSoul();
  const r = await c.rounds({ server, limit: 100 });
  if (r.ok) return { rounds: r.data.rounds.map((x) => ({ ...x })), full: true, asOf: r.asOf, stale: r.stale };
  const s = await allSouls(server);
  const by = new Map<number, Soul[]>();
  for (const x of s.rows) by.set(x.cycle, [...(by.get(x.cycle) ?? []), x]);
  for (let i = 1; i <= current; i++) if (!by.has(i)) by.set(i, []);
  const rounds = [...by.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([cycle, souls]): RoundSummary => {
      const ended = souls.filter((x) => x.duration_ms !== null);
      const longest = ended.reduce<Soul | null>((a, x) => (!a || x.duration_ms! > a.duration_ms! ? x : a), null);
      return {
        cycle,
        state: cycle === current ? null : "ended",
        started_at: souls[0]?.started_at ?? null,
        ended_at: cycle === current ? null : (souls.at(-1)?.ended_at ?? null),
        souls: souls.length,
        total_survival_ms: ended.reduce((a, x) => a + x.duration_ms!, 0),
        longest: longest ? { uuid: longest.uuid, name: longest.name, turn: longest.turn, duration_ms: longest.duration_ms! } : null,
        deaths: souls.filter((x) => x.outcome === "died").length,
        graves: null,
        registered: null,
        scope: null,
        seed: null,
        archive: null,
        prep_started_at: null
      };
    });
  return { rounds, full: false, asOf: s.asOf, stale: s.stale };
}
