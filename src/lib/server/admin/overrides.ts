// Owner-set label overrides, in their own SQLite file (<FISHNET_DATA_DIR>/admin.db), apart from the
// recorder's: the recorder's file can be dropped and rebuilt, these are the owner's words. Shape is
// what src/lib/format/labels.ts `setLabelOverrides` takes: per stat type (full key, "minecraft:killed")
// a label, a title template and a milestone phrase template; per stat (criterion form,
// "killed:minecraft:pufferfish" or "killed:*") a title and a phrase.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fullType, parseMetric, metricKey } from "#lib/api/metric.ts";

export type TypeFields = { label?: string; title?: string; phrase?: string };
export type StatFields = { title?: string; phrase?: string };
export type LabelOverrides = { types: Record<string, TypeFields>; stats: Record<string, StatFields> };

export const TYPE_FIELDS = ["label", "title", "phrase"] as const;
export const STAT_FIELDS = ["title", "phrase"] as const;
export const MAX_TEXT = 80;

const SCHEMA = [
  `CREATE TABLE label_override (
     scope TEXT NOT NULL CHECK (scope IN ('type', 'stat')),
     key TEXT NOT NULL,
     field TEXT NOT NULL CHECK (field IN ('label', 'title', 'phrase')),
     value TEXT NOT NULL,
     updated_at INTEGER NOT NULL,
     PRIMARY KEY (scope, key, field)
   ) WITHOUT ROWID;
   CREATE TABLE audit (id INTEGER PRIMARY KEY, at INTEGER NOT NULL, what TEXT NOT NULL);`
];

export class AdminStore {
  readonly db: DatabaseSync;
  #cache: LabelOverrides | null = null;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA busy_timeout = 5000");
    const v = Number((this.db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version);
    if (v > SCHEMA.length) throw new Error(`admin.db schema version ${v} is newer than this build (${SCHEMA.length})`);
    for (let i = v; i < SCHEMA.length; i++) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.exec(SCHEMA[i]);
        this.db.exec(`PRAGMA user_version = ${i + 1}`);
        this.db.exec("COMMIT");
      } catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
      }
    }
  }

  /** Every override, cached until the next write. */
  overrides(): LabelOverrides {
    if (this.#cache) return this.#cache;
    const out: LabelOverrides = { types: {}, stats: {} };
    const rows = this.db.prepare("SELECT scope, key, field, value FROM label_override ORDER BY scope, key, field").all() as {
      scope: "type" | "stat";
      key: string;
      field: string;
      value: string;
    }[];
    for (const r of rows) {
      const bucket = r.scope === "type" ? out.types : out.stats;
      (bucket[r.key] ??= {} as Record<string, string>)[r.field as "title"] = r.value;
    }
    this.#cache = out;
    return out;
  }

  /** Replaces the overrides of one type or stat; empty fields are removed. */
  set(scope: "type" | "stat", key: string, fields: Record<string, string | undefined>): void {
    const allowed: readonly string[] = scope === "type" ? TYPE_FIELDS : STAT_FIELDS;
    const now = Date.now();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const f of allowed) {
        const v = fields[f];
        if (v) this.db.prepare("INSERT OR REPLACE INTO label_override VALUES (?, ?, ?, ?, ?)").run(scope, key, f, v, now);
        else this.db.prepare("DELETE FROM label_override WHERE scope = ? AND key = ? AND field = ?").run(scope, key, f);
      }
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    } finally {
      this.#cache = null;
    }
  }

  /** A line in the audit table; a failure to write it never fails the edit itself. */
  audit(what: string): void {
    try {
      this.db.prepare("INSERT INTO audit (at, what) VALUES (?, ?)").run(Date.now(), what.slice(0, 500));
    } catch (e) {
      console.warn(`fishnet: admin audit line not written: ${(e as Error).message}`);
    }
  }

  recentAudit(limit = 20): { at: number; what: string }[] {
    return this.db.prepare("SELECT at, what FROM audit ORDER BY id DESC LIMIT ?").all(limit) as { at: number; what: string }[];
  }

  close(): void {
    this.db.close();
  }
}

/** A stat type key in full form ("minecraft:killed", "create:pressed"), or null. */
export function cleanTypeKey(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const k = fullType(s.trim());
  return /^[a-z0-9_.-]{1,64}:[a-z0-9_./-]{1,128}$/.test(k) ? k : null;
}

/** A stat in criterion form ("killed:minecraft:pufferfish", "killed:*"), normalised, or null. */
export function cleanStatKey(s: unknown): string | null {
  if (typeof s !== "string" || s.length > 200) return null;
  const m = parseMetric(s.trim().toLowerCase());
  if (!m || m.kind !== "stat") return null;
  if (!cleanTypeKey(m.type)) return null;
  if (m.subject !== "*" && !/^[a-z0-9_.-]{1,64}:[a-z0-9_./-]{1,128}$/.test(m.subject)) return null;
  return metricKey(m);
}

/**
 * One label or template: trimmed, single line, at most MAX_TEXT characters, no control characters.
 * It is shown as text (Svelte escapes it), never parsed as markup. Empty means "no override".
 */
export function cleanText(s: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (s === undefined || s === null) return { ok: true, value: "" };
  if (typeof s !== "string") return { ok: false, error: "Not text" };
  const v = s.replace(/\s+/g, " ").trim();
  if (v.length > MAX_TEXT) return { ok: false, error: `At most ${MAX_TEXT} characters` };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(v)) return { ok: false, error: "No control characters" };
  return { ok: true, value: v };
}
