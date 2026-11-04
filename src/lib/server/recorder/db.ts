// The recorder's SQLite file (PLAN §3.3): node:sqlite (built into Node 24; Bun implements it too, so
// `bun test` runs the same code). WAL, one process, synchronous calls: a transaction never awaits,
// so two jobs can never interleave inside one.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { MIGRATIONS } from "./schema.ts";

export type Db = DatabaseSync;

/** Opens (and creates) the file, applies the listed migrations. Throws on a file newer than this build. */
export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    db.exec("PRAGMA busy_timeout = 5000");
    if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = NORMAL");
    migrate(db);
  } catch (e) {
    db.close();
    throw e;
  }
  return db;
}

export function schemaVersion(db: Db): number {
  return Number((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version);
}

export function migrate(db: Db): void {
  const v = schemaVersion(db);
  if (v > MIGRATIONS.length) throw new Error(`schema version ${v} is newer than this build (${MIGRATIONS.length})`);
  for (let i = v; i < MIGRATIONS.length; i++) {
    tx(db, () => {
      db.exec(MIGRATIONS[i]);
      db.exec(`PRAGMA user_version = ${i + 1}`);
    });
  }
}

/** Runs `fn` in one write transaction. `fn` must be synchronous (no await inside). */
export function tx<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function getMeta(db: Db, key: string): string | null {
  const r = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
  return r ? r.value : null;
}

export function getMetaNumber(db: Db, key: string): number | null {
  const v = getMeta(db, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function setMeta(db: Db, key: string, value: string | number): void {
  db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(key, String(value));
}

/** Marks a series as recorded from `t` on (the first write wins). Also sets the recorder's start. */
export function registerSeries(db: Db, key: string, t: number): void {
  db.prepare("INSERT OR IGNORE INTO series (key, since) VALUES (?, ?)").run(key, t);
  db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('recording_since', ?)").run(String(t));
}

export function seriesSince(db: Db, key: string): number | null {
  const r = db.prepare("SELECT since FROM series WHERE key = ?").get(key) as { since: number } | undefined;
  return r ? Number(r.since) : null;
}
