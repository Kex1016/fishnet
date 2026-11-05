// The recorder's SQLite schema (PLAN §3.3), applied by `migrate()` in order by PRAGMA user_version,
// one transaction per script. Scripts are listed, never edited once shipped: a change is a new entry.
// A file newer than this build is refused (the recorder stays off, pages keep working).
//
// Everything here is derived data: a cache of the cakeutils API over time. Deleting the file loses
// history, never anything of cakeutils. Scopes are stored side by side and never added together
// (cakeutils I3, G-16): a network row is the API's network figure, not a sum of server rows.

export const MIGRATIONS: readonly string[] = [
  // 1: initial schema
  `
  CREATE TABLE meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  ) WITHOUT ROWID;

  -- when each series was first written: "Recording since" per chart
  CREATE TABLE series (
    key TEXT PRIMARY KEY,
    since INTEGER NOT NULL
  ) WITHOUT ROWID;

  -- every minute from /v2/network. scope: 'network' (total_online) or 'server:<id>'.
  -- waiting is null for the network row (the API has no network waiting figure).
  CREATE TABLE online_minute (
    scope TEXT NOT NULL,
    t INTEGER NOT NULL,
    online INTEGER NOT NULL,
    waiting INTEGER,
    linked INTEGER NOT NULL,
    PRIMARY KEY (scope, t)
  ) WITHOUT ROWID;

  -- hourly roll-ups of online_minute, kept two years
  CREATE TABLE online_hour (
    scope TEXT NOT NULL,
    t INTEGER NOT NULL,
    n INTEGER NOT NULL,
    online_mean REAL NOT NULL,
    online_max INTEGER NOT NULL,
    waiting_max INTEGER,
    linked_n INTEGER NOT NULL,
    PRIMARY KEY (scope, t)
  ) WITHOUT ROWID;

  -- every 10 minutes from /v2/mini-servers (public, occupied only). A successful poll without a
  -- row for a mini means nobody was in it.
  CREATE TABLE mini_poll (
    t INTEGER PRIMARY KEY
  );
  CREATE TABLE mini_sample (
    server TEXT NOT NULL,
    mini TEXT NOT NULL,
    t INTEGER NOT NULL,
    players INTEGER NOT NULL,
    PRIMARY KEY (server, mini, t)
  ) WITHOUT ROWID;
  CREATE INDEX mini_sample_t ON mini_sample (server, t);

  -- hourly snapshots of the featured boards (board = metricKey). complete = every entry was read.
  CREATE TABLE board_snapshot (
    board TEXT NOT NULL,
    scope TEXT NOT NULL,
    t INTEGER NOT NULL,
    total INTEGER NOT NULL,
    complete INTEGER NOT NULL,
    PRIMARY KEY (board, scope, t)
  ) WITHOUT ROWID;
  CREATE TABLE board_entry (
    board TEXT NOT NULL,
    scope TEXT NOT NULL,
    t INTEGER NOT NULL,
    uuid TEXT NOT NULL,
    name TEXT NOT NULL,
    rank INTEGER NOT NULL,
    value INTEGER NOT NULL,
    display TEXT NOT NULL,
    PRIMARY KEY (board, scope, t, uuid)
  ) WITHOUT ROWID;

  -- every 6 hours: the sum of every player's value on one board, inside ONE scope
  CREATE TABLE stat_total (
    metric TEXT NOT NULL,
    scope TEXT NOT NULL,
    t INTEGER NOT NULL,
    value INTEGER NOT NULL,
    unit TEXT NOT NULL,
    players INTEGER NOT NULL,
    PRIMARY KEY (metric, scope, t)
  ) WITHOUT ROWID;

  -- the milestone feed (D-109), stored so paging by offset cannot lose rows
  CREATE TABLE milestone (
    scope TEXT NOT NULL,
    metric TEXT NOT NULL,
    threshold REAL NOT NULL,
    uuid TEXT,
    name TEXT,
    reached_at INTEGER,
    backfilled INTEGER NOT NULL,
    seen_at INTEGER NOT NULL,
    PRIMARY KEY (scope, metric, threshold)
  ) WITHOUT ROWID;
  CREATE INDEX milestone_reached ON milestone (scope, reached_at);

  -- every player the API lists; first_seen from the profile (null until fetched)
  CREATE TABLE player (
    uuid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    first_seen INTEGER,
    seen_at INTEGER NOT NULL
  ) WITHOUT ROWID;
  CREATE INDEX player_first_seen ON player (first_seen);
  `,
  // 2: advancement firsts (cakeutils D-111): who completed each advancement first in a scope, as the
  // feed lists it. "First" can move to an earlier time when the operator imports old completions, so
  // rows are replaced on every read, never only appended. earned_at is the backend's completion time.
  `
  CREATE TABLE advancement_first (
    scope TEXT NOT NULL,
    advancement TEXT NOT NULL,
    uuid TEXT,
    name TEXT,
    server TEXT NOT NULL,
    earned_at INTEGER NOT NULL,
    imported INTEGER NOT NULL,
    seen_at INTEGER NOT NULL,
    PRIMARY KEY (scope, advancement)
  ) WITHOUT ROWID;
  CREATE INDEX advancement_first_earned ON advancement_first (scope, earned_at);
  `
];
