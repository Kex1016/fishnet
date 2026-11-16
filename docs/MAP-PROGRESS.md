# Live map — progress (coordinator-owned)

Line: the `/map` page on squaremap tiles via cakeutils `/v2/map` (brief: cakeutils `v2/map/FISHNET-BRIEF.md`).
Integration branch: `claude/fishnet-map` (off `main` at `dd1267d`). PR `claude/fishnet-map` → `main` (#49, opened 2026-11-15) is for
David at GFM2 and not merged by the coordinator. Unit PRs target `claude/fishnet-map`.

Start rule (David, 2026-11-14): FM-0, FM-1, FM-3 once cakeutils MAP-C0 is merged (into cakeutils `claude/map`);
everything else after cakeutils GMAP2 (cakeutils `v2/map/PROGRESS.md` on `claude/map`).

| WU | Status | Model / effort | Thread | Branch | PR | Notes |
|---|---|---|---|---|---|---|
| FM-0 contracts | **merged** 59deb16 | Opus 5.5 / high | cmsg_017jXErfLmkLcYLSb5FKAVcMRkD7EasRAE44kCebvUP2us | claude/project-thread-hf70c4 | #38 | early |
| FM-1 tile proxy | **merged** 992d8df | Sonnet 5.5 / high | cmsg_017jXErfLmkLcYLSb5FKAVcM8uYUXfxLcYWKvBe73J2HfJ | claude/fishnet-map-fm1 | #39 | early |
| FM-3 map canvas | **merged** 41d016b | Fable 5.2 / medium | cmsg_017jXErfLmkLcYLSb5FKAVcMEKSWLpTczmc4csx1NMMHJd | | #40 | early |
| FM-2 live hub, SSE | **merged** 549ca0a | Opus 5.5 / high | cmsg_017jXErfLmkLcYLSb5FKAVcM9KqCGixSeEL8G9QZ2PRtiz | | #43 | |
| FM-4 pages | **merged** 4fd45ab | Sonnet 5.5 / high | cmsg_017jXErfLmkLcYLSb5FKAVcMHrvYSaXiUfeQmTLGZk1awV | claude/project-thread-07827n | #44 | |
| FM-5 layers, One Soul rounds | **merged** 30173d0 | Sonnet 5.5 / medium | cmsg_017jXErfLmkLcYLSb5FKAVcMJT7uHxrgGEJ3gBYJcm4wPK | | #42 | |
| FM-6 deploy, docs | **merged** 126153b | Haiku 5.5 / low | cmsg_017jXErfLmkLcYLSb5FKAVcMLx4U5tTPgm8hyjLLh1ZmYv | | #45 | |
| FM-0b fixture sync | **merged** 6cb11c9 | Sonnet 5.5 / low | cmsg_017jXErfLmkLcYLSb5FKAVcM5ftpf5BqgSVQMmVoD8A8oa | | #41 | MAP-43 follow-up (brief §7) |
| FM-m mini worlds | **merged** 85aafde | Sonnet 5.5 / medium | cmsg_017jXErfLmkLcYLSb5FKAVcMJbVo1bafaL466vm4sX3MzM | claude/fm-m | #46 | |
| FM-8 show on map | **merged** b10b6d9 | Sonnet 5.5 / medium | cmsg_017jXErfLmkLcYLSb5FKAVcM3HsPrW1hpcGKQY5rEeZJfm | | #47 | |
| FM-7 integration, QA, go-live | **merged** f88e857 | Fable 5.2 / high | cmsg_017jXErfLmkLcYLSb5FKAVcMFUCKoWwqn7MzSih8pH2dEB | | #48 | |

Gates: GFM0 **passed** 2026-11-15, GFM1 **passed** 2026-11-15, GFM2 **passed** 2026-11-15 on both mock scenarios (live API check after deploy, below). Screenshots thread ("Map screenshots"): cmsg_017jXErfLmkLcYLSb5FKAVcMADw8BDRoVvuMRhAtXTp9cP.

## Decisions

- 2026-11-14: "MAP-C0 merged" means merged into cakeutils `claude/map` (the map integration branch), not `main`.

- 2026-11-15 (FM-0): map calls live in a sibling `MapClient` (`mapApi()`, `src/lib/server/cakeutils/map.ts`) on its
  own core with the map bucket; tiles, positions and changes bypass the LRU via `core.direct()`; map problems never mark
  cakeutils unreachable; 501 `not_implemented` maps to `off`; round routes require `?server=` so the hide list applies.
  Busy mock: survival (overworld, nether, end) + creative (positions off), hidden server `staff`, hidden player
  `quietgill`; spawn block red #d23c3c, block x/z divisible by 128 drawn darker in mock tiles.
- 2026-11-15 (FM-1): tiles cached under `$FISHNET_DATA_DIR/map` (`map-mock-<scenario>` in mock; FM-6 puts it on the
  volume), `MAP_CACHE_MAX_MB` default 2048. Browser URL `/map/t/<server>/<world>/<z>/<x>_<y>.png?v=<epoch>.<seq>`
  (`<epoch>.0` when not in the change log); round tiles `/map/t/<server>/round/<cycle>/...`. 404 = not mapped,
  503 + Retry-After = retry. Header `x-map-cache`. Additive `MapClient.serverVisible()`.
- 2026-11-15 (David): the map fills the whole content area right of the site nav, edge to edge; every control and
  piece of information is a popout, overlay or hover popup (players on hover). Applies to FM-3 (canvas, preview) and
  FM-4 (`/map/[server]`); FM-5/FM-8 controls follow the same rule.
- 2026-11-15 (FM-3): Leaflet 1.9.4 (+ @types/leaflet) added, dynamic import. Layout: `mc-stage` in the shell's scroll
  area, MapCanvas inside, popouts in `mc-over > mc-over__row`, status in `mc-over__status`; `/design/map` is the
  template for FM-4. Instance: follow, unfollow, applyTiles, setView, view, pointOf; `onview` ≤ 4/s. Players drawn at
  block centre (FM-2 floors positions); layer marks at raw coordinates, world shown only (FM-5); followed player on
  another world keeps follow and waits for the page to switch world, absent → `onfollow(null)` (FM-8). Worlds without a
  change log bust tiles with `?r=` (ignored by the tile route). `scripts/map-canvas-check.ts` checks alignment.
- 2026-11-15: unrendered tiles stay `404` (cacheable, FM-1 semantics); Chromium logs them as console errors, so FM-7's
  e2e console check ignores failed requests under `/map/t/`.
- 2026-11-15: FM-0b (brief §7 follow-up) syncs mock/client with MAP-43's §2 and fixtures and adds
  `src/lib/map/worlds.ts` (vanilla worlds arrive `order 0`, raw names: the site orders and labels them).
- 2026-11-15: FM-6 starts after FM-2 (it documents FM-2's env vars and Caddy block); FM-m starts after FM-4
  (it changes FM-4's world picker), both to keep file ownership disjoint.
- 2026-11-15 (FM-2): browser connects to `liveHref(server)+"?world=&epoch=&seq="`, reconnects on world change; positions-off
  comes from `live_players` in /v2/map (not in the snapshot); tile reset on `dropped > seq` (not ≥: nothing lost when
  equal), accepted; players on worlds no longer listed are dropped; env `MAP_SSE_MAX`; 4 streams per exact client
  address (IPv6 /64 not grouped: FM-7 to judge).
- Screenshots threads: "Map screenshots" and "Map screenshots 2" are full (24 files each); later stages go to "Map screenshots 3" (cmsg_017jXErfLmkLcYLSb5FKAVcMEnq7yPfmvZvxbPPeUnNAUw; earlier "Map screenshots 2"
  (cmsg_017jXErfLmkLcYLSb5FKAVcMWkkENWXb2WqP27uo6Awu6E), at most 6 files per post.
- 2026-11-15 (FM-4): pages use `src/lib/map/liveClient.ts` (SSE, resumes after last tile event) and `pages.ts`;
  world list in `/map/[server]` `data.worlds` via worldLabel; `?follow=` written into share links but read by FM-8.
  FM-7 to look at: busy mock hub tile epoch differs from the page's change-log epoch (`mock-1`).
- 2026-11-15: FM-8 and FM-m run in parallel; both touch `/map/[server]/+page.svelte`. FM-m puts the grouped picker
  in a new `src/lib/map/WorldPicker.svelte` with a one-line swap in the page; FM-8 owns the `?follow=` handling;
  the second to merge rebases.
- 2026-11-15 (FM-8): explicit `world=` wins over the followed player's snapshot world; one unreproduced flaky test on
  the first run after a build (two runs green in review): FM-7 to watch.
- 2026-11-15 (FM-7): the SSE per-address limit groups IPv6 by /64 (`src/lib/server/map/address.ts`); each stream keeps
  its own change-log position (a page ahead of the hub no longer resets every tile); `?follow=` treats a hidden player
  like an unknown one; without ADDRESS_HEADER behind a proxy every visitor shares one address (4 streams site-wide), so
  the server logs it and `/healthz` shows `map.streams`.
- 2026-11-15: the profile button is decided at page load; brief §5.1's live re-check on the profile is not built (it
  would start a poller per profile view). The map page's not-there Notice covers a stale button.
- Left for David at deploy: `caddy validate --config deploy/Caddyfile.example --adapter caddyfile` on the host; host
  `.env` needs `ADDRESS_HEADER=X-Forwarded-For`, `XFF_DEPTH=1`; token gains `read:map`; then
  `bun run e2e --base https://fishnet.haiiro.moe --hidden <names>` for the live check. Note: Caddyfile/README use
  upstream 127.0.0.1:3000 while compose publishes 7777:3000 (pre-existing on main, port intentional): match the
  Caddy upstream to the port the host really uses.

## Log

- 2026-11-14 23:00Z: line started. cakeutils MAP-C0 in progress (not merged), GMAP2 open: no unit can start yet.
  `claude/fishnet-map` created. "Map screenshots" thread requested from the project coordinator.
- 2026-11-15 08:50Z: cakeutils MAP-C0 merged into `claude/map` (PR #98, 2050530); GMAP0 passed, GMAP1/GMAP2 open.
  FM-0 thread requested (Opus 5.5 / high). FM-1 and FM-3 follow FM-0 (brief §7.2).
- 2026-11-15 09:20Z: FM-0 reviewed (check 0 errors, 285 tests, build + leak check pass, diff and screenshots read) and merged (#38, 59deb16). GFM0 passed. FM-1 and FM-3 requested.
- 2026-11-15 09:25Z: FM-1 reviewed (merged with base: check 0 errors, 325 tests, build + leak check pass; path safety read) and merged (#39, 992d8df).
- 2026-11-15 09:32Z: David's full-bleed map direction recorded and sent to FM-3; goes into the FM-4 brief.
- 2026-11-15 10:05Z: FM-3 reviewed (check 0 errors, 340 tests, build + leak check pass, screenshots read: full-bleed per David) and merged (#40, 41d016b). Early units done; rest waits for cakeutils GMAP2.
- 2026-11-15 12:35Z: cakeutils GMAP2 passed (PROGRESS 12:30Z; PR #109 claude/map → main open for David). No shape change in openapi since MAP-C0. FM-0b, FM-2, FM-4, FM-5 requested.
- 2026-11-15 12:45Z: FM-0b #41 reviewed (check, 348 tests, build pass); sent back once: mini world label must use `name` (mini display name, MAP §8), mock mini id like the real one.
- 2026-11-15 12:50Z: FM-0b fix 0b8cb59 re-checked (check, 348 tests, build pass) and merged (#41, 6cb11c9). worlds.ts (sortWorlds, worldLabel) available to FM-4/FM-m; busy mini world cakeutils_miniservers_skyblock-1_overworld.
- 2026-11-15 12:58Z: FM-5 #42 reviewed (check, 353 tests, build + leak pass, screenshots read) and merged (30173d0). Round world names use One Soul dimension labels (not worlds.ts), accepted.
- 2026-11-15 13:05Z: FM-2 #43 reviewed (check, 381 tests merged, build + leak pass; client address via adapter ADDRESS_HEADER/XFF_DEPTH) and merged (549ca0a). FM-6 requested.
- 2026-11-15 13:10Z: FM-6 #45 reviewed (env vars all documented, Caddy SSE handle with flush_interval -1 and no encode, port untouched) and merged (126153b). Caddy config not validated with a binary: FM-7 / first deploy.
- 2026-11-15 13:15Z: FM-4 #44 reviewed (check, 392 tests, build + leak pass, screenshots read: full bleed per David, fresh empty state) and merged (4fd45ab). GFM1 still needs `bun run e2e` both scenarios: FM-7. FM-8 and FM-m requested.
- 2026-11-15 13:25Z: FM-m #46 reviewed (check, 392 tests, build + leak pass, screenshot read) and merged (85aafde). Mini stats link: /leaderboards?scope=mini:<server>/<mini>. FM-8 rebases on it.
- 2026-11-15 13:20Z: FM-8 #47 reviewed (check, 397 tests twice, build + leak pass, screenshots read) and merged (b10b6d9). All feature units merged; FM-7 requested (Fable 5.2 / high).
- 2026-11-15 13:55Z: FM-7 #48 reviewed (check, 404 tests, build + leak pass, e2e 54/54 on busy and fresh incl. 600-connection SSE check) and merged (f88e857). GFM1 and GFM2 passed on mock. PR claude/fishnet-map → main opened for David.
- 2026-11-15 13:58Z: PR #49 claude/fishnet-map → main opened for David (not merged). FM-7 screenshots sent to Map screenshots 3.

# Markers (map markers line)

Line: points and areas from cakeutils' read-only `GET /v2/map/{server}/worlds/{world}/markers` drawn on `/map/[server]`.
Brief: cakeutils `v2/map/MARKERS-FISHNET-BRIEF.md` (project files `briefs/MAP-MARKERS-WEBSITE.md`); contract: cakeutils
`v2/map/MARKERS.md` and `openapi.json` once GMK0 freezes them. Integration branch **`claude/fishnet-markers`** (off `main` at
`d719d9a`); unit PRs target it and the markers coordinator merges them. PR `claude/fishnet-markers` → `main` is for David at GFMK2.
Coordinator thread: "Build Fishnet map markers" (cmsg_017jXErfLmkLcYLSb5FKAVcMU8EDAWUZxKJUYYYZqVSPrX).

Start rule (David, 2026-11-15): FMK-0 and FMK-1 once cakeutils GMK0 is logged (cakeutils `v2/map/PROGRESS.md`, Markers
extension, branch `claude/map-markers`); everything else after cakeutils GMK2. No Fable models in this line; minimal chatter.

| WU | Status | Model / effort | Thread | Branch | PR | Notes |
|---|---|---|---|---|---|---|
| FMK-0 contracts | **merged** df814ab | Sonnet 5.5 / high | cmsg_017jXErfLmkLcYLSb5FKAVcMNKkmuhzux3SoSxqmPjJLmW | | #50 | early |
| FMK-1 Minecraft label | **merged** b02fb0c | Opus 5.5 / medium | cmsg_017jXErfLmkLcYLSb5FKAVcMK3CxUDUYdWKUzCFFncR3M3 | | #51 | early, ∥ FMK-0 |
| FMK-2 marker layer | **merged** 045f510 | Sonnet 5.5 / high | cmsg_017jXErfLmkLcYLSb5FKAVcMGL6MJWdCKxS1aoqqgc2vrV | claude/project-thread-kfo182 | #53 | FMK-0, FMK-1 |
| FMK-3 live refresh | **merged** 30ec06f | Sonnet 5.5 / medium | cmsg_017jXErfLmkLcYLSb5FKAVcM5SqQLQwqEWjTzyUULc1sqB | | #52 | FMK-0, ∥ FMK-2 |
| FMK-6 docs | **requested** | Haiku 5.5 / low | | | | FMK-2 |
| FMK-7 integration, QA, security | **requested** | Opus 5.5 / medium | | | | all |

Gates: GFMK0 (FMK-0 + FMK-1 merged), GFMK1 (FMK-2 + FMK-3 merged, check/test/build/e2e on both scenarios), GFMK2 (FMK-7
done, PR to `main` open for David). **GFMK0 passed** 2026-11-16; cakeutils GMK2 passed 2026-11-16 02:30Z. **GFMK1 passed** 2026-11-16 03:10Z. GFMK2 not yet.

## Markers decisions

- 2026-11-15: units merge into `claude/fishnet-markers` after the coordinator's review (build, tests, diff, screenshots);
  sent back at most twice, then a fresh thread one model step up. Screenshots (brief §6.3) go to the latest
  "Map screenshots" thread with room, at most 6 files per post. This line's screenshots thread: "Map screenshots 4"
  (cmsg_017jXErfLmkLcYLSb5FKAVcMMtBDSKAwwsGAJJvFv7YzHw).
- 2026-11-16 (FMK-0): `fresh` has no map servers, so its markers routes answer `404` (MARKERS §3.3); the brief's
  `200` + `markers: []` case ("No markers in this world yet") lives in `busy` (survival's end, creative's overworld).
  `MapClient.markers` returns `empty` for `[]`; `markers.json` sends a stale list with `x-stale: 1` / `x-as-of` and
  `max-age=5`, never a `304`; nothing kept → `503`. Page data `markers: MarkersLoad` (`ok` / `none` / `down`).
- 2026-11-16 (FMK-1, brief §5.3/§8 tuning): label contrast target 3 : 1 (4.5 unreachable by lightening against 22 % over
  grey); the tint searches **lighter first for every colour**, darker only when lighter cannot reach the target (dark
  titles merged into the solid black shadow on bright areas). Supersedes the L ≤ 0.6 direction rule. "Lighter" = lighter than the area as drawn (else black stays black on its
  shadow). Yellow and white areas still get dark titles (no light tint reaches 3 : 1 there). FMK-2 needs
  `unifontFor(titles)` in the map page's load for titles outside the bitmap sheets.
- 2026-11-16: `LiveHandlers.onMarkers({world, rev})` added to `liveClient.ts` by the coordinator (type only) so FMK-2
  (page wiring) and FMK-3 (hub + client emission) run in parallel without touching each other's files. FMK-2 also
  copies cakeutils' real marker fixtures into `tests/fixtures/markers/` and syncs the mock to them.
- 2026-11-16 (FMK-3): hub revalidates 30 s after the last answer (background priority waits for a fresh answer, so no
  SWR lag); the hub's first `rev` after a world becomes watched is its baseline, so the page refetches once when the
  stream opens (FMK-2) and passes `markersRev` in `connectLive` deps for the poll fallback. Mock-only
  `POST /__mock/markers/bump` in `scripts/mock-server.ts` (not in the site build).
- 2026-11-16 (FMK-2): Places order = tab order = draw order (areas by size, then pins); a popup pans the map only when
  the visitor opens it, never for links, Places or refetches; `markers.json` adds a site-side `uni` field (Unifont
  metrics for titles outside the bitmap sheets). Labels placed smallest area first, each inside its area, clear of
  areas drawn above and of placed labels (else no label at that zoom). Mock zig label within half a block of cakeutils'.

## Markers log

- 2026-11-15 21:40Z: line started on David's go. `claude/fishnet-markers` created off `main` (d719d9a). cakeutils GMK0
  not passed yet (MK-C0 running), so no unit started; re-check scheduled.
- 2026-11-15 23:50Z: cakeutils GMK0 passed (22:55Z; MARKERS.md frozen, matches brief §2; MAPD-45..61 add nothing the site
  must change). Unit briefs in project files `briefs/map-markers-web/{COMMON,FMK-0,FMK-1}.md`; FMK-0 and FMK-1 requested.
- 2026-11-16 00:10Z: FMK-0 (#50) reviewed (diff, hide check before any call, 404 for staff and bad world, 304 round
  trip, POST refused; check 0 errors, 436 tests, build + leak check PASS, busy smoke) and merged.
- 2026-11-16 00:15Z: FMK-1 (#51) reviewed: renderer good; sent back once for the lighter-first tint.
- 2026-11-16 00:25Z: FMK-1 (#51, head 6102762) re-reviewed (check 0 errors, 473 tests, build + leak check, Chromium pixel
  check DPR 1/2, screenshots) and merged. GFMK0 passed. Screenshots posted to "Map screenshots 4". FMK-2/3 wait for GMK2.
- 2026-11-16 02:15Z: cakeutils GMK2 passed (PR #122 to cakeutils main); brief §2 now cites the real fixtures (project
  copy refreshed; no 503 on the route). FMK-2 and FMK-3 briefs written and requested.
- 2026-11-16 02:35Z: FMK-3 (#52) reviewed (diff, LRU/priority semantics, hidden and 404 stop polling; check, 485 tests,
  build + leak check, e2e 54/0) and merged.
- 2026-11-16 03:00Z: FMK-2 (#53) reviewed: check, 505 tests, build, e2e 54/0, map-markers-check PASS; sent back once: an
  area title must not cross an area drawn above it or another label (placed smallest area first; brief §5.2 extended).
- 2026-11-16 03:10Z: FMK-2 (#53, head 4c4ef28) re-reviewed (check, 510 tests, build + leak check, e2e 54/0,
  map-markers-check PASS, screenshots) and merged. Merged branch re-run green: GFMK1 passed. FMK-2 screenshots to
  "Map screenshots 4". FMK-6 and FMK-7 briefs written and requested.
