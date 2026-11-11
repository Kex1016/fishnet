// Words for One Soul states, outcomes, realms and timeline rows. Unknown values get a generic, still
// readable rendering (title-cased id), never a crash. Player text passes through untouched: the caller
// renders it as text (Svelte escapes it).
import { durationMs } from "#lib/format/stat-display.ts";
import type { OsEvent, OsState, Outcome, Realm } from "./types.ts";

export function titleId(id: string): string {
  const s = id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
  const t = s.replace(/[_/.-]+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : id;
}

const STATES: Record<string, { label: string; line: string }> = {
  prep: { label: "Sign-ups open", line: "The world does not exist yet. Players are signing up." },
  idle: { label: "Waiting", line: "The world is ready and waits for its next soul." },
  running: { label: "Running", line: "One soul plays; everyone else watches." },
  exhausted: { label: "No souls left", line: "Every soul who signed up has had their turn." },
  grace: { label: "Grace period", line: "No souls are left. The round ends when grace runs out." },
  ended: { label: "Round over", line: "The round is over. A new one starts from the console." }
};

export function stateLabel(s: OsState): string {
  return STATES[s]?.label ?? titleId(s);
}
export function stateLine(s: OsState): string {
  return STATES[s]?.line ?? "";
}

const OUTCOMES: Record<string, string> = {
  playing: "Playing",
  died: "Died",
  skipped: "Skipped (absent)",
  round_ended: "Round ended",
  replaced: "Replaced"
};
export function outcomeLabel(o: Outcome): string {
  return OUTCOMES[o] ?? titleId(o);
}

const REALMS: Record<string, string> = { overworld: "the Overworld", nether: "the Nether", end: "the End", other: "another dimension" };
export function realmLabel(r: Realm | null | undefined): string | null {
  return r ? (REALMS[r] ?? titleId(r)) : null;
}

const DIMS: Record<string, string> = { "minecraft:overworld": "Overworld", "minecraft:the_nether": "Nether", "minecraft:the_end": "End" };
export function dimLabel(d: string | null | undefined): string {
  return d ? (DIMS[d] ?? titleId(d)) : "Unknown";
}

/** "3 d 4 h", "4 h 12 min", "12 min", "40 s". Two units at most. */
export function life(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "–";
  return durationMs(Math.max(0, ms));
}

/** "01:04:09" for a ticking clock (hours can exceed 24). */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`;
}

/** "2 d 3 h" style countdown to an instant, for prep and grace (coarser than `clock`). */
export function until(at: number, now: number): string {
  const ms = at - now;
  if (ms <= 0) return "any moment";
  return life(ms);
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * One timeline row as a sentence and a tone. `who` is the row's player name (raw text, the caller renders
 * it); the rest of the sentence never contains player text except the death cause and waystone label, which
 * are returned separately in `quote` so the caller can mark them as quoted player text.
 */
export type EventLine = { text: string; quote: string | null; tone: "death" | "soul" | "grave" | "round" | "ghost" | "other" };

export function eventLine(e: OsEvent): EventLine {
  const d = e.data ?? {};
  switch (e.kind) {
    case "soul_chosen":
      return { text: "became the soul", quote: null, tone: "soul" };
    case "death":
      return d.final === false
        ? { text: "fell, but got a second chance", quote: str(d.cause), tone: "death" }
        : { text: `died${num(d.duration_ms) !== null ? ` after ${life(num(d.duration_ms))}` : ""}`, quote: str(d.cause), tone: "death" };
    case "second_chance":
      return { text: "is on borrowed time", quote: null, tone: "soul" };
    case "offering": {
      const add = num(d.added_ms);
      return { text: `burned ${str(d.item) ? titleId(str(d.item)!) : "an offering"}${add ? ` for ${life(add)}` : ""}`, quote: null, tone: "soul" };
    }
    case "second_chance_ended": {
      const o = str(d.outcome);
      const what = o === "redeemed" ? "survived borrowed time" : o === "expired" ? "ran out of borrowed time" : o === "died" ? "died on borrowed time" : "left borrowed time";
      return { text: what, quote: null, tone: "soul" };
    }
    case "absence_warning":
      return { text: "has been away too long", quote: null, tone: "other" };
    case "absence_skip":
      return { text: "was skipped for being away", quote: null, tone: "other" };
    case "grave_created":
      return { text: `left a grave${num(d.items) !== null ? ` with ${num(d.items)} items` : ""}`, quote: null, tone: "grave" };
    case "grave_claimed":
      return { text: "claimed a grave", quote: null, tone: "grave" };
    case "spawn_moved":
      return { text: "moved the spawn", quote: null, tone: "other" };
    case "waystone_activated":
      return { text: "found a waystone", quote: str(d.label), tone: "other" };
    case "waystone_removed":
      return { text: "A waystone was removed", quote: null, tone: "other" };
    case "exhausted":
      return { text: "No souls are left", quote: null, tone: "round" };
    case "grace_started":
      return { text: "Grace began", quote: null, tone: "round" };
    case "grace_ended":
      return { text: "Grace ended", quote: null, tone: "round" };
    case "round_ended":
      return { text: "The round ended", quote: null, tone: "round" };
    case "round_started":
      return { text: "The world opened", quote: null, tone: "round" };
    case "prep_started":
      return { text: "Sign-ups opened", quote: null, tone: "round" };
    case "prep_extended":
      return { text: d.reason === "no_souls" ? "Sign-ups were extended: nobody had signed up" : "Sign-ups were extended", quote: null, tone: "round" };
    case "prep_ended":
      return { text: "Sign-ups closed", quote: null, tone: "round" };
    case "prank": {
      const n = num(d.count) ?? 0;
      return { text: `played ${n} prank${n === 1 ? "" : "s"} that day`, quote: null, tone: "ghost" };
    }
    default:
      return { text: titleId(e.kind), quote: null, tone: "other" };
  }
}

/** Rows whose sentence starts with the player's name (the rest stand alone). */
export function eventHasActor(e: OsEvent): boolean {
  return !!e.name && !["exhausted", "grace_started", "grace_ended", "round_ended", "round_started", "prep_started", "prep_extended", "prep_ended", "waystone_removed"].includes(e.kind);
}
