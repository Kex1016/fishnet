# fishnet: the Fishplex network website

Plan, 4 Nov 2026. Site: `https://fishnet.haiiro.moe`, behind David's own Caddy.
Data: the cakeutils v2 HTTP API on the network's Velocity proxy. Nothing on the site is made up:
every number comes from the API, or from the site's own recordings of the API (section 4).

## 1. What we are building

A public, read-only website for the Fishplex network: who is on, the servers, players and their
stats, leaderboards for any stat cakeutils knows, playtime, stat milestones ("first to 10 000 stone"),
and charts over time. It follows the look of reki.dev, endfield.reki.dev and minecraft.reki.dev
(section 6), and it must stay correct on a brand new network where almost nothing has happened yet.

Non-goals: writing to cakeutils (no announce, no admin), accounts or logins, friends and party data,
analytics or third-party requests from visitors' browsers.

## 2. Facts about cakeutils the site depends on

Read from `Kex1016/cakeutils` (`v2/API.md`, `v2/STATS.md`, `v2/openapi.yaml`, `proxy/.../api/`,
`proxy/.../store/*Queries`) on 4 Nov 2026, plus the milestones brief (D-109, branch
`claude/project-thread-k4b1ut`, not pushed yet, so the shapes below come from the brief only).

### 2.1 Access

- Token only: `Authorization: Bearer cu_<id>_<secret>`, no query tokens. Only `GET /v2/health` is open.
- **The token never reaches a browser.** All API calls happen in SvelteKit server code
  (`+page.server.ts`, `+server.ts`); the browser only ever talks to fishnet.
- No generic pass-through: fishnet exposes its own routes, never `/v2/*` verbatim, so a visitor cannot
  use the site as a relay to routes we did not mean to publish.
- Recommended token: `cakectl`/`/cakeapi token create fishnet read:players read:stats --rate 600/120`.
  `read:players` + `read:stats` covers everything the site needs, milestones included, and leaves out
  `read:relations` (friends and party are personal data) and private mini-servers (only `read` sees them).
- Rate limit is per token (default 120/min, burst 60; `429` + `Retry-After`). A `304` still costs a
  request. So the site caches on its side and coalesces concurrent misses (section 3.2).
- `GET /v2/openapi.json` (any valid token) is the generated contract; fishnet commits a copy and
  generates its TypeScript types from it.

### 2.2 The stat model

- A stat is `(type, subject)`: `minecraft:mined` × `minecraft:stone`. Criterion form in URLs and
  `metric` fields: `mined:minecraft:stone`, type totals `mined:*`. Types come from
  `GET /v2/stats/types` (`key`, `name`, `kind`), subjects from `GET /v2/stats/subjects` (`key`, `kind`,
  `name`, `unit`, `icon`), one subject with every type that has data for it from
  `GET /v2/stats/subjects/{subject}`. **Never hard-code the stat list**; modded types and subjects
  appear when someone first uses them.
- One subject can have several names by kind (`minecraft:cod` = entity "Cod", item "Raw Cod"). Pick the
  name for the kind the stat type counts.
- `name` can be `null` (a key seen before its definition arrived): show a title-cased key. `icon` can be
  `null` (blocks without items, entities without spawn eggs, custom stats): show a per-kind glyph.
- Units: `count`, `distance_cm`, `ticks`, `damage_tenths`; playtime is `ms`. Every value comes with a
  ready `display` (`1.23 km`, `1d 2h 3m`, `12.5 ♥`). Show `display` as given; use `value` + `unit` only
  for chart axes and sorting, through one TS port of cakeutils' `StatDisplay` with tests copied from its
  cases. Expect new units later: an unknown unit formats as a plain number.
- Scopes: `network` (default), `server:<id>`, `mini:<server>/<mini>`. Values are rolled up on write
  (mini → server → network). **Never add scopes together**: a network figure is not the sum of its
  servers, and a server's figure already includes its minis (cakeutils I3, G-16). Adding *players*
  inside one scope is fine (that is how the site gets a network total for a stat).
- `custom:*` (a type total over custom stats) is `400 mixed_units`; ask for single subjects instead.
- **"Not happened yet" has three answers, and the site treats each one on purpose:**
  - a stat or type nobody ever recorded → `404` (leaderboards, a player's single stat, milestones);
  - a scope never seen → `200` with an empty list and `total: 0`;
  - a player who never did it → value `0` on a single-stat read, and simply missing from lists.
  A private mini-server answers exactly like a never-seen one.
- Freshness: backends flush every 15 s, the proxy commits a few seconds later; leaderboards are cached
  15 s, every `/v2` GET is `max-age=5` with a weak ETag. Show "as of" times in UTC and do not poll
  faster than that.
- Lists: `limit` 1..100 (default 10), `offset`, `total`. Player stats come ordered by type then subject,
  not by value, so "a player's top stats" needs all their pages (cheap per player, cached).
  Leaderboard ties are ordered by player id.

### 2.3 Players, servers, playtime

- `GET /v2/network`: servers (`id`, `display_name`, `online`, `waiting` from cakelimbo, `mc_version`,
  `platform`, the last two `null` while a backend is not linked) and `total_online`.
- `GET /v2/players?online=&q=&limit=&offset=`, ordered by name. `GET /v2/players/{ref}`: uuid, name,
  online, server, `first_seen`, `last_seen`, `skin` (only while online), LuckPerms `prefix`/`suffix` as
  **segments** (text + colour + style flags; render them as styled spans, never parse MiniMessage),
  playtime summary. A player row created from a stat before login has the UUID as its name.
- Playtime: `total_ms`, `by_server`, `by_mini` (keys `"<server>/<mini>"`, private minis left out but
  still inside the totals). Network total ≥ sum of servers (time between servers counts only to the
  network). Live: includes the open session.
- `GET /v2/leaderboards/playtime` and `/v2/leaderboards/stats/{type}/{subject}` →
  `{metric, scope, unit, total, entries:[{rank, uuid, name, value, unit, display}]}`.
- `GET /v2/mini-servers`: live presence, public ones only with our token.
- `POST /v2/players:batch` (≤ 100 refs, ≤ 32 includes) is a read and the cheapest way to fill many
  rows: the recorder and the player directory use it.

### 2.4 There is no history in the API

cakeutils stores current totals only. There is no "online over time", no per-day stats. The only
timestamps are `first_seen`, `last_seen` and milestones' `reached_at`. Charts over time therefore come
from two places, both real:

1. **Timestamps the API already has**: players joining per week (`first_seen`), active players
   (`last_seen`), milestones per day (`reached_at`).
2. **fishnet's own recorder** (section 4): periodic snapshots of the API in the site's own SQLite file.
   Every chart built on it says "recorded since <date>" and starts empty on a new install.

### 2.5 Milestones (D-109, in progress)

Shapes as in the brief; additive, behind `/v2`:

- `GET /v2/milestones/stats/{type}/{subject}?scope=` → `{metric, scope, unit, tracked, milestones:[{threshold,
  display, uuid|null, name|null, reached_at|null, backfilled}]}`, lowest first, ≤ 18 rows, `404` if the stat
  was never recorded, `tracked:false` for time and damage stats.
- `GET /v2/milestones?scope=&type=&limit=&offset=` → feed, newest first, backfilled last.
- `GET /v2/players/{ref}/milestones?scope=&type=&limit=&offset=` → what this player was first to.
- `scope=mini:` → `400`; never-seen server → empty list; `custom:*` → `400 mixed_units`.

Rules we implement: thresholds are data (render `threshold`/`display`, no 1/100/1000 table);
`uuid`, `name`, `reached_at`, `stat_name` may be `null` ("reached before tracking began", "first player
unknown"); ignore unknown fields (a `kind` may come); always page with `total`; **feature-detect**: `404`
on `/v2/milestones` means an older proxy, so every milestone section hides itself (checked at start and
every 10 min, so it turns on by itself once the proxy is updated); respect `max-age=5`; names and icons
through the catalogue.

## 3. Architecture

### 3.1 Stack

- **SvelteKit 3 + Svelte 5 + TypeScript**, same family as journey's `site/`, but server-rendered with
  `@sveltejs/adapter-node` instead of static, because data is live and the token must stay on the server.
- Bun for install, scripts and tests (`bun test`); the production server runs on Node 24 LTS
  (`node build/`), which has `node:sqlite` built in (no native module in the image).
- Charts: our own small SVG components in the reki chart style (section 6), no chart library. They
  render on the server, so pages work without JavaScript; JS adds hover readouts.
- Lucide icons, self-hosted fonts (`@fontsource`), images as AVIF/WebP/PNG through `sharp`.

### 3.2 Data layer (`src/lib/server/cakeutils/`)

- `client.ts`: typed functions, one per route (`network()`, `player(ref)`, `leaderboard(metric, scope, page)`,
  `milestones(...)`, ...), types generated from the committed `openapi.json` (+ hand-written milestone
  types until the branch merges). Base URL and token from env (`CAKEUTILS_API_URL`, `CAKEUTILS_API_TOKEN`);
  the token is never logged (log its public id `cu_<id>` only).
- Result type, not exceptions: `{ok:true, data, asOf}` | `{ok:false, kind:"not_found"|"empty"|"off"|"down"|"rate_limited"|"bad_request"}`,
  so every page decides on purpose what "not happened yet" and "cakeutils is down" look like.
- Cache: in-memory LRU keyed by URL, TTL = the response's `max-age` (5 s) with a floor per route class
  (network 5 s, leaderboards 15 s, catalogue 10 min, icons forever), stale-while-revalidate, ETag revalidation,
  single-flight for concurrent misses, and **serve-stale-on-error** (keep the last good answer up to 24 h
  and say "as of" on the page when cakeutils is unreachable).
- A token bucket in front of the client, sized below the token's limit (env `CAKEUTILS_RATE`), with the
  recorder on a lower priority than page renders. `429` honours `Retry-After`.
- `mock/`: a fixture server for development and tests, two scenarios: `fresh` (a network nobody played on:
  empty boards, 404 stats, milestones off) and `busy` (realistic data across servers and a mini-server).
  Mock mode needs `FISHNET_MOCK=1` and the production server refuses to start with it.

### 3.3 Recorder (`src/lib/server/recorder/`)

A scheduler inside the same Node process, writing `data/fishnet.db` (SQLite, WAL, volume-mounted):

| Every | Records | Charts it feeds |
|---|---|---|
| 1 min | `/v2/network`: total online, per server online and waiting, linked yes/no | online now sparkline, online over the day/week, server uptime strip, activity heatmap |
| 10 min | `/v2/mini-servers` public presence | busiest mini-servers |
| 1 h | playtime board (all pages) and the featured boards' top 100 | rank movement, "climbing this week" |
| 6 h | network totals per featured stat (sum of every entry of its board) and per type total | "network has mined 1.2 M blocks" tiles with sparklines |
| 10 min | milestone feed head (new rows only) | milestones per day, already stored by the API, recorded only to survive offsets |

- Pure derived data: a cache of the API over time. Deleting the file loses history, never anything of
  cakeutils. Retention: minute rows 30 days, then hourly roll-ups for 2 years.
- Budget: at a few hundred players this is well under 100 requests per hour beyond page traffic.
- Every series query returns its `since` date; charts with less than two points show their empty state.

### 3.4 Routes

| Route | What | API |
|---|---|---|
| `/` | hero, network status (servers, online now, waiting), stat tiles (players seen, network playtime, a few network totals), online players' faces, latest milestones, joins per week, online over the last week | network, players, playtime board, milestones, recorder |
| `/servers`, `/servers/[id]` | each server: status, version, platform, online and waiting history, its boards and milestones (`scope=server:<id>`), its live public mini-servers | network, mini-servers, leaderboards, milestones, recorder |
| `/players` | directory: search, online filter, paging, faces | players, batch (playtime) |
| `/players/[name]` | profile with prefix/suffix, first and last seen, playtime by server and mini, ranks on featured boards, stats explorer by type with icons and search, scope switch, milestones they were first to | player, playtime, stats, leaderboards, player milestones |
| `/leaderboards`, `/leaderboards/[metric]` | playtime + featured boards + any stat from the catalogue; scope switch; top 10 bar chart, full paged table, distribution | leaderboards, catalogue |
| `/stats`, `/stats/[type]`, `/stats/subject/[subject]` | the catalogue: types, subjects with icons, a subject's names and every type with data, its boards and its milestone ladder | catalogue, leaderboards, milestones |
| `/milestones` | feed, filter by scope and type, milestones per day heatmap, "firsts" per player | milestones |
| `/about` | what the site is, data freshness, API reachable yes/no, milestones on/off, recorded since | health, recorder |
| `/img/icon/[sha].png`, `/img/face/[uuid].png` | icon proxy (immutable cache), faces: skin texture via Mojang's session server by UUID, head crop in `sharp`, cached on disk 24 h, default head fallback | icons, Mojang |
| `/healthz` | for Docker and the watcher | none |

Featured boards and composite boards ("Travel" = the distance stats summed per player, like journey's
`boards.ts`) live in one config file, `src/lib/boards.ts`. A featured board whose stat answers `404` is
hidden until it exists; composites sum players' values inside one scope only.

A `hidden-players.txt` (UUID or name per line, mounted at runtime) drops opted-out players from every
page and from the recorder, as journey does.

### 3.5 Empty, missing and down: the rules every unit follows

- `404` stat / type: "Nobody has done this yet", the stat's name if the catalogue has it, no table.
- Empty list or `total: 0`: reki's EmptyState with a calm line ("No one has played on this server yet").
- `tracked:false` milestones: "No milestones for this stat".
- Milestones off (`404` on `/v2/milestones`): the section and its nav entry are not rendered at all.
- Backfilled milestone: "Reached before tracking began", name only if the API gives one.
- Chart with fewer than two points: its frame, the empty state inside it, and "Recording since <date>".
- cakeutils down: last good data with "as of <time> UTC" and a Notice; never a blank or a 500.
- Unknown fields, units, kinds, types: ignored or shown generically, never a crash.

## 4. Deploy

- `Dockerfile`: multi-stage (Bun builds, `node:24-slim` runs as a non-root user), `HEALTHCHECK` on `/healthz`.
- `compose.yml`: one service `fishnet`, `127.0.0.1:3000:3000` (only Caddy reaches it), volume `./data`,
  `env_file: .env` (`CAKEUTILS_API_URL`, `CAKEUTILS_API_TOKEN`, `CAKEUTILS_RATE`, `ORIGIN=https://fishnet.haiiro.moe`),
  `restart: unless-stopped`. `.env.example` committed, `.env` never.
- Caddy snippet in `deploy/Caddyfile.example`:

  ```caddyfile
  fishnet.haiiro.moe {
      encode zstd gzip
      reverse_proxy 127.0.0.1:3000
  }
  ```

  If Caddy runs in Docker, put both on one network and use `reverse_proxy fishnet:3000` instead.
- `deploy/deploy.sh`: fetch `origin/main`, build an image tagged with the commit, `docker compose up -d`,
  wait for `/healthz`, and roll back to the previous tag if it does not come up. Prints a one-line result.
- `deploy/watch.sh` + `deploy/fishnet-watch.service` and `.timer` (systemd): every 60 s compare
  `git ls-remote origin refs/heads/main` with the deployed commit and run `deploy.sh` on a change.
  A lock prevents overlapping runs; failures back off (1, 5, 15 min) and log to the journal. Polling
  needs no open port and no webhook secret; a private repo needs a read-only deploy key.
- `deploy/README.md`: first install on the host, the token, the Caddy block, the watcher, rollback.

## 5. Security and privacy

- Token only in the server's env; a build check fails if `cu_` or the env name appears in
  `build/client/`. Logs show `cu_<id>` only.
- No relations, no private mini-servers, no admin routes (the token cannot reach them anyway).
- Prefix/suffix and player names are rendered as text (Svelte escapes); segments map to an allow-listed
  set of colours and styles.
- CSP: `default-src 'self'`; images `'self'` only (faces and icons go through our routes).
- Hidden players list; faces fetched server side so visitors never contact Mojang.

## 6. Look

reki's layout with a Fishplex skin, the way journey skins it for Minecraft:

- Shell: sidebar (full, icons only, hidden) and TopBar with breadcrumbs and search; dark first, light works.
- Type: rounded Japanese-capable faces for headings and text, a mono face for numbers, dates "4 Nov 2026".
- One accent for the site (a sea colour fits "fish"), warm greys, compact 6–12 px corners, quick motion.
- Charts follow reki's rules: one hue, columns ≤ 24 px, 2 px lines, a readout in the card header that
  follows hover and focus, a table twin behind one "Charts | Tables" switch, stat tiles for single numbers.
- Copy: English, sentence case, no exclamation marks, no emoji; empty states are calm and short.
- Item icons: cakeutils' rendered icons in slot frames; endfield.reki.dev's tile index (name, count, one
  line) for the home page's sections.

**Open (David):** reki's design system is anzu's (journey's `site/design/reki/` is a synced copy).
Default in this plan: rebuild the look in fishnet's own `src/lib/design/` from reki's public rules, no
files copied. If anzu agrees, W0 may copy `tokens.css` and `bundle.css` instead, which saves a day.

## 7. Work units

The repo is empty, so W0 goes first and alone. Then nine units run at the same time, each owning its own
directories; nobody edits another unit's files. W10 closes.

**Contracts W0 freezes for everyone:** the client's function signatures and Result type, generated API
types, the chart components' props (stubbed), `src/lib/nav.ts` with every page listed, the route
skeletons, the history query interface (returns empty series), the mock fixtures, and `CLAUDE.md`.
A unit that needs a contract changed asks the coordinator; it does not edit the file.

**Shared files (minimal additive edits, named in the unit's report):** `package.json`, `bun.lock`,
`src/lib/nav.ts`, `src/hooks.server.ts`.

| Unit | Owns | Depends on | Model | Effort | Why this model |
|---|---|---|---|---|---|
| **W0 Scaffold, design and contracts** | everything at first; afterwards `src/lib/design/`, `src/routes/+layout*`, `CLAUDE.md` | none | `claude-fable-5-1` | high | sets the look and every contract the other nine build on; mistakes here multiply |
| **W1 API client and cache** | `src/lib/server/cakeutils/` (client, cache, rate bucket, Result), `src/lib/format/` (StatDisplay port + tests), `openapi.json` sync script | W0 | `claude-opus-5-5` | high | caching, single-flight, stale-on-error and rate limits are subtle correctness work |
| **W2 Recorder and history** | `src/lib/server/recorder/`, `src/lib/server/history.ts`, `data/` schema, retention | W0 | `claude-opus-5-5` | high | scheduler, SQLite schema and roll-ups must survive restarts and never sum scopes |
| **W3 Charts** | `src/lib/charts/` (ColumnChart, LineChart, Heatmap, Sparkline, StatTile, BarList, UptimeStrip, table twins, empty frames) | W0 | `claude-fable-5-1` | medium | visual precision and accessibility in a known design language; medium is enough for well-specified components |
| **W4 Home and servers** | `src/routes/+page*`, `src/routes/servers/` | W0 | `claude-sonnet-5-5` | high | composing pages from contracts, with care for every empty state |
| **W5 Players** | `src/routes/players/`, `src/lib/players/` (segments renderer, stats explorer) | W0 | `claude-fable-5-1` | high | the richest page: scopes, types, icons, ranks, playtime split, milestones, all with empty states |
| **W6 Leaderboards and catalogue** | `src/routes/leaderboards/`, `src/routes/stats/`, `src/lib/boards.ts` | W0 | `claude-sonnet-5-5` | high | catalogue-driven boards, composites, scope switch, paging |
| **W7 Milestones** | `src/routes/milestones/`, `src/lib/milestones/` (feed, ladder and player-list components that W4, W5, W6 import, stubbed by W0) | W0 | `claude-sonnet-5-5` | high | many null and feature-detect rules from the brief, built against a branch that is not merged yet |
| **W8 Images** | `src/routes/img/`, `src/lib/server/images/` (icon proxy, face fetch and crop, disk cache, fallbacks) | W0 | `claude-sonnet-5-5` | medium | contained, well-defined server work |
| **W9 Deploy and watcher** | `Dockerfile`, `compose.yml`, `.dockerignore`, `.env.example`, `deploy/` | W0 | `claude-sonnet-5-5` | medium | standard Docker, bash and systemd with a rollback path |
| **W9b About page and operator docs** | `src/routes/about/`, `README.md` | W0 | `claude-haiku-5-5` | low | a short page and plain docs from facts already in this plan |
| **W10 Integration, QA and go-live** | fixes anywhere through small PRs; `tests/e2e/` | all | `claude-fable-5-1` | high | swaps stubs for real parts, runs Playwright against both mock scenarios and the live API, checks the token leak test, empty states, phone width and dark/light, then the first deploy with David |

Effort guidance for every unit: start at the level above; raise W0, W5 or W10 to `xhigh` only if a
first pass misses contracts or states. Do not use `max`. Subagents and workflows only if David asks.

### Done means

- `bun run check`, `bun test` and `bun run build` pass; the token leak check passes.
- The page works in both mock scenarios, `fresh` showing every empty state on purpose.
- Screenshots at 390 px and 1440 px, dark and light, in the unit's PR.
- No numbers that do not come from the API or the recorder.

### Order

1. W0 (one thread). Its PR merges before anyone else starts.
2. W1–W9b in parallel (ten threads). Pages are built against the mock and the stubs, so they do not wait
   for W1, W2, W3 or W7.
3. W10 once they are merged; David creates the token and the host `.env`; first deploy; the watcher on.
4. When D-109 merges into cakeutils: W7 re-checks the shapes against the real `openapi.json` (a small
   follow-up, `claude-sonnet-5-5` medium).

## 8. Questions for David (defaults in brackets, nobody waits on them)

1. reki's design files: copy with anzu's OK, or rebuild the look? [rebuild]
2. Token scopes `read:players read:stats` and a higher rate, `600/120`? [yes]
3. Is `Kex1016/fishnet` private (the watcher then needs a deploy key)? [assume private]
4. Does Caddy run on the host or in Docker? [host, `127.0.0.1:3000`]
5. An opt-out list for players who don't want to be on the site? [yes, empty to start]
6. Site name and accent: "Fishplex" with a sea-blue accent? [yes]
