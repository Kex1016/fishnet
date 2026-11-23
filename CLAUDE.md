# CLAUDE.md — fishnet

Fishnet, the website for the Fishplex network: `https://fishnet.haiiro.moe`, a public, read-only, server-rendered
SvelteKit site over the cakeutils v2 API. The spec is `docs/PLAN.md` (read it first); this file is
for engineering sessions and the work units of PLAN §7. The goal in David's words: `docs/GOAL.md`
(the project files) and PLAN §1.

## Rules that never bend

- **The token stays on the server.** Every cakeutils call goes through `src/lib/server/cakeutils/client.ts`
  from `+page.server.ts` / `+server.ts`. No `/v2` pass-through route, ever. `bun run build` ends with
  `scripts/leakcheck.ts`, which fails on a token, the env name or a source map in `build/client/`.
  Logs show the token's public id (`cu_<id>`) only; URLs in logs are `scheme://host:port`.
- **Admin is the one writer.** `/admin` (404 without `FISHNET_ADMIN_TOKEN`) edits names and the hide lists
  only; nothing on the site ever writes to cakeutils. Every admin action calls `requireAdmin` (session +
  CSRF token); the admin token is read only in `src/lib/server/admin/index.ts` and never logged.
- **Real data everywhere.** Every number comes from the API or from the recorder's SQLite. No
  placeholder numbers in pages. The mock exists for development; the production server refuses to
  start with `FISHNET_MOCK` set.
- **Never add scopes together** (cakeutils I3, G-16): network ≠ sum of servers; a server includes its
  minis. Adding players inside one scope is fine.
- **"Not happened yet" has three answers** (PLAN §2.2, §3.5), each shown on purpose: `404` → "Nobody
  has done this yet"; empty list / `total: 0` → EmptyState; a player without the stat → `0` or missing.
  Milestones: `tracked:false` → "No milestones for this stat"; `off` → the section is not rendered at
  all; backfilled → "Reached before tracking began".
- **cakeutils down** → last good data with "as of <time> <zone>" and a Notice; never a blank or a 500.
- **Untrusted text is text.** Names, prefixes, suffixes render through Svelte (escaped); segments map to
  an allow-list (`src/lib/players/Segments.svelte`). Never parse MiniMessage, never `{@html}` API data.
- Copy: English, sentence case, no exclamation marks, no emoji. Dates "4 Nov 2026". Data is stored and sent in UTC; a moment is shown in the visitor's time zone and names it ("17:44 CET", `src/lib/format/dates.ts`, David 12 Nov 2026), UTC until the browser has set the `tz` cookie. Charts bucketed by UTC day or hour keep UTC labels and say so.
- Unknown fields, units, kinds, types: ignored or shown generically, never a crash. Never hard-code
  the stat list.

## Commands (Bun)

```sh
bun install
FISHNET_MOCK=busy bun run dev          # dev server on :5173 against the busy fixtures (or fresh)
bun run check                          # svelte-check
bun test                               # bun:test, tests/*.test.ts
bun run build                          # vite build + leak check → build/ (adapter-node)
FISHNET_MOCK=busy FISHNET_ALLOW_MOCK=1 PORT=3101 node build/index.js    # the production build on fixtures
bun run mock [fresh|busy] [port]       # the fixture server over HTTP (token: cu_mock_mock), default :8085
bun run shots --base http://127.0.0.1:3101 --out docs/screenshots/<unit>/busy / /players  # PR screenshots
bun run e2e                            # after bun run build: Playwright checks on both scenarios (tests/e2e/); --base <url> for a live site
bun run fixtures                       # regenerate mock fixtures from the generators (deterministic)
bun run types                          # regenerate src/lib/api/schema.d.ts from openapi.json
```

Node 24 runs production (`node build/index.js`, `node:sqlite` for the recorder); the container's Node
22 is fine for building and smoke tests. Playwright + Chromium are pre-installed in the cloud
container for `bun run shots`; they are not a dependency.

## Layout and ownership (PLAN §7)

| Path | What | Owner after W0 |
|---|---|---|
| `src/lib/api/` | `types.ts` (API aliases + milestone shapes), `schema.d.ts` (generated), `result.ts`, `scope.ts`, `metric.ts` | frozen contract (coordinator) |
| `src/lib/server/cakeutils/client.ts` | the `Client` interface + W0's plain implementation | W1 keeps the signatures, replaces the internals (cache, ETag, single-flight, stale-on-error, rate bucket) |
| `src/lib/server/cakeutils/mock/` | world model, fixture handler, `fixtures/{fresh,busy}.json`, `mockFetch` | W1 (additive; scenarios stay) |
| `src/lib/server/env.ts`, `src/env.ts` | runtime config; the token lives here only | W1 |
| `src/lib/server/history.ts` | the `History` interface; `emptyHistory` until W2 | W2 |
| `src/lib/server/recorder/` | scheduler + SQLite (`data/fishnet.db`) | W2 |
| `src/lib/server/hidden.ts` | opted-out players (`HIDDEN_PLAYERS_FILE`): they leave every page and the recorder. The One Soul section (`src/routes/one-soul/`, `src/lib/server/onesoul/`) does not apply the list, on purpose (David, 17 Nov 2026): do not add it there without asking | W5 |
| `src/lib/server/hidden-servers.ts`, `src/lib/server/cakeutils/hide.ts` | hidden servers (`HIDDEN_SERVERS_FILE`): the client wrapper drops them from every answer and asks cakeutils for network figures with `exclude=` (D-113) | post-W10 |
| `src/lib/format/` | `stat-display.ts` (StatDisplay port, cakeutils' tests), `dates.ts` | W1 |
| `src/lib/charts/` | `types.ts` (props, frozen) + components, stubbed | W3 |
| `src/lib/design/` | fonts, tokens, base, `fx-` classes, Window, PageHead, RankList, Feed, Face, Pager, ScopeSwitch, ... (`docs/HAIIRO.md`) | H0 (frozen; ask for additions) |
| `src/lib/milestones/` | `types.ts` (props, frozen) + MilestoneFeed, MilestoneLadder, PlayerFirsts, stubbed | W7 |
| `src/lib/players/` | Segments (final), names helpers, StatsExplorer (stub) | W5 |
| `src/lib/boards.ts` | featured and composite boards | W6 |
| `src/lib/nav.ts`, `src/hooks.server.ts`, `package.json`, `bun.lock` | shared: minimal additive edits, named in the unit's report | all |
| `src/routes/+layout*`, `+error.svelte`, `src/routes/design/` | the shell and the design preview | H0 |
| `src/routes/+page*`, `src/routes/servers/` | home, servers | W4 |
| `src/routes/players/` | directory, profile | W5 |
| `src/routes/leaderboards/`, `src/routes/stats/` | boards and catalogue | W6 |
| `src/routes/milestones/` | feed (filters: scope, stat type, player), `players/` = every player's milestone total from the recorder (`holders.ts`) | W7 |
| `src/routes/advancements/` | advancement firsts: feed, `[...id]` detail (D-111; components in `src/lib/milestones/Advancement*`, `advancements.ts`) | post-W10 |
| `src/routes/admin/`, `src/lib/server/admin/` | owner editing behind `FISHNET_ADMIN_TOKEN`: names (overrides for `labels.ts`, `data/admin.db`), hidden servers and players (edits the list files) | post-W10 |
| `src/routes/img/`, `src/lib/server/images/` | icon proxy, faces | W8 |
| `Dockerfile`, `compose.yml`, `.dockerignore`, `.env.example`, `deploy/` | deploy and watcher | W9 |
| `src/routes/about/`, `README.md` | about page, operator docs | W9b |
| `tests/e2e/` | Playwright against both scenarios; `map.ts` = the live map and its security pass (FM-7): a check may start a site of its own with `ctx.boot` (other limits, or the build over HTTP against `bun run mock` with real hide lists); `map-markers.ts` = the map markers and their security pass (FMK-7), with `map-markers-upstream.ts` (hostile titles, a 1000-marker world, a request log) | W10 |
| `src/lib/map/` | the live map (line FM, `docs/MAP-PROGRESS.md`): `types.ts`, `links.ts`, `view.ts` (frozen, FM-0); `MapCanvas.svelte`, `crs.ts`, `tiles.ts`, `players.ts`, `overlays.ts`, `map.css`, `MapPopout.svelte` (FM-3: Leaflet by dynamic import, full-bleed `mc-stage` with popouts, `scripts/map-canvas-check.ts`) | map coordinator |

A unit that needs a frozen contract changed asks the coordinator; it does not edit the file.

Shared helpers, so pages do not grow their own: `src/lib/url.ts` (`withParams`, `offsetParam`),
`src/lib/servers.ts` (`serverNameMap`, `scopeLabel`), `src/lib/players/names.ts` (`playerRowLabel`,
`playerHref`), `src/lib/boards.ts` (`barRows`), `src/lib/milestones/pictures.ts` (a catalogue icon for rows
the API sends without one; `pictures.server.ts` binds the client; the advancement → icon item table is
generated by `scripts/advancement-icons.py` from the game jar).

## The contracts in one screen

- `Result<T>` (`src/lib/api/result.ts`): `{ok:true, data, asOf, stale, empty}` or
  `{ok:false, kind: "not_found"|"off"|"down"|"rate_limited"|"bad_request", status?, problem?, retryAfter?, asOf?}`.
  `empty` is a flag on a successful list answer (`total: 0`), so pages keep the payload (PLAN §3.2 listed
  it as a kind; W0 made it a flag on purpose). `problemCode(r)` gives `mixed_units` etc.
- `Client` (`client.ts`): `health, network, players, player, playtime, playerStats, playerStat, batch,
  statTypes, subjects, subject, leaderboard(metric, scope, page), miniServers, icon, milestonesEnabled,
  milestones, milestoneLadder, playerMilestones, advancementsEnabled, advancements, advancement,
  playerAdvancements` (the last four: cakeutils D-111, PLAN §2.6, feature-detected on their own). `api()` is the configured singleton. Relations and
  admin routes do not exist here.
- `Scope` (`scope.ts`): `network | server:<id> | mini:<server>/<mini>`; `scopeParam(url)`.
  `Metric` (`metric.ts`): `{kind:"playtime"} | {kind:"stat", type, subject}`; criterion form
  `mined:minecraft:stone`, `mined:*`; `parseMetric`, `metricKey`, `boardHref`.
- `History` (`history.ts`): `recordingSince, online, onlineRecent, server, activityByHour, miniPresence,
  networkTotal, rankMoves, milestonesPerDay, milestoneHolders, advancementsPerDay, joinsPerWeek`; every answer
  carries `since`. `milestoneHolders` is every player's milestone total, counted from the recorder's full
  copy of the feed (job `milestone-holders`); `complete: null` until that copy has been read once.
- Charts (`charts/types.ts`): `ChartFrame` (`title, href, sub, since, asOf, stale, view, emptyTitle,
  emptyLine`) + `ColumnChart, LineChart, Sparkline, Heatmap, StatTile, BarList, UptimeStrip, DataTable,
  ViewSwitch`. Pages draw charts only (David, 17 Nov 2026): no page passes `view` or carries the switch;
  the table twins stay in the components for the design preview. The One Soul map has its own Map | Table.
- Milestones (`milestones/types.ts`): components take the client's `Result` and render every state.
- Pages return `{ title, crumbs }` from their server load (`src/lib/nav.ts` `Crumb`); the layout
  reads `page.data.crumbs`. Links that change a search param go through `src/lib/url.ts` `withParams`.

## The look (`src/lib/design/`, `docs/HAIIRO.md`)

haiiro (haiiro.moe/~cakes) since 23 Nov 2026: Rosé Pine on one dark theme (no light theme, no toggle),
One Soul in Gruvbox dark through the realm scope (`data-realm="onesoul"` on `<html>`, or `.realm`).
Components read tokens (`--color-*`, `--ink-*`), never a colour. IBM VGA 8x16 for everything (bold is its
2x face), Jacquard 24 for display at 28px and up, Unifont behind both; every font self-hosted. Square
corners, 5px double pine windows labelled like a prompt, dither instead of blur, no easing. The shell is
`.fx` (bar, strip, side nav window, blob backdrop); a page renders a `PageHead` and `Window`s into
`.fx-main`, and a stage (the map) as a direct child of it. Classes `fx-` and haiiro's own; the frozen
contract (tokens, classes, component props) is `docs/HAIIRO.md`. The old `fp-`/`t-` classes and token names
are gone (H11): nothing defines them. Current links are `aria-current="page"`. Preview: `/design` (dev and
mock only).

## SvelteKit 3 (this repo) differs from the docs you may remember

- No `svelte.config.js`: options go to `sveltekit({...})` in `vite.config.ts`.
- `$app/env` (not `$app/environment`); env vars are declared in `src/env.ts` with `defineEnvVars` and
  imported from `$app/env/private` (no `$env/dynamic/private`). Add new variables there.
- Hook types from `@sveltejs/kit/hooks`; param matchers live in `src/params.ts` (`defineParams`).
- `page.url` is read-only: components take `UrlLike` (`src/lib/url.ts`), not `URL`.
- `#lib/*` resolves through `package.json` `imports` (Bun, Vite and TypeScript all honour it).

## Done means (PLAN §7)

`bun run check`, `bun test`, `bun run build` (with the leak check) pass; the pages work in both mock
scenarios, `fresh` showing every empty state on purpose; screenshots at 390 px and 1440 px (one dark
theme), in `docs/screenshots/<unit>/` and in the PR; no numbers that do not come from the API or the
recorder; shared-file edits listed in the PR.
