# Live map — progress (coordinator-owned)

Line: the `/map` page on squaremap tiles via cakeutils `/v2/map` (brief: cakeutils `v2/map/FISHNET-BRIEF.md`).
Integration branch: `claude/fishnet-map` (off `main` at `dd1267d`). PR `claude/fishnet-map` → `main` is opened for
David at GFM2 and not merged by the coordinator. Unit PRs target `claude/fishnet-map`.

Start rule (David, 2026-11-14): FM-0, FM-1, FM-3 once cakeutils MAP-C0 is merged (into cakeutils `claude/map`);
everything else after cakeutils GMAP2 (cakeutils `v2/map/PROGRESS.md` on `claude/map`).

| WU | Status | Model / effort | Thread | Branch | PR | Notes |
|---|---|---|---|---|---|---|
| FM-0 contracts | **merged** 59deb16 | Opus 5.5 / high | cmsg_017jXErfLmkLcYLSb5FKAVcMRkD7EasRAE44kCebvUP2us | claude/project-thread-hf70c4 | #38 | early |
| FM-1 tile proxy | **merged** 992d8df | Sonnet 5.5 / high | cmsg_017jXErfLmkLcYLSb5FKAVcM8uYUXfxLcYWKvBe73J2HfJ | claude/fishnet-map-fm1 | #39 | early |
| FM-3 map canvas | **merged** 41d016b | Fable 5.2 / medium | cmsg_017jXErfLmkLcYLSb5FKAVcMEKSWLpTczmc4csx1NMMHJd | | #40 | early |
| FM-2 live hub, SSE | waiting (GMAP2) | Opus 5.5 / high | | | | |
| FM-4 pages | waiting (GMAP2, FM-3) | Sonnet 5.5 / high | | | | |
| FM-5 layers, One Soul rounds | waiting (GMAP2, FM-3) | Sonnet 5.5 / medium | | | | |
| FM-6 deploy, docs | waiting (GMAP2, FM-1, FM-2) | Haiku 5.5 / low | | | | |
| FM-m mini worlds | waiting (GMAP2, MAP-31) | Sonnet 5.5 / medium | | | | |
| FM-8 show on map | waiting (FM-4) | Sonnet 5.5 / medium | | | | |
| FM-7 integration, QA, go-live | waiting (all) | Fable 5.2 / high | | | | |

Gates: GFM0 **passed** 2026-11-15, GFM1 open, GFM2 open. Screenshots thread ("Map screenshots"): cmsg_017jXErfLmkLcYLSb5FKAVcMADw8BDRoVvuMRhAtXTp9cP.

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

## Log

- 2026-11-14 23:00Z: line started. cakeutils MAP-C0 in progress (not merged), GMAP2 open: no unit can start yet.
  `claude/fishnet-map` created. "Map screenshots" thread requested from the project coordinator.
- 2026-11-15 08:50Z: cakeutils MAP-C0 merged into `claude/map` (PR #98, 2050530); GMAP0 passed, GMAP1/GMAP2 open.
  FM-0 thread requested (Opus 5.5 / high). FM-1 and FM-3 follow FM-0 (brief §7.2).
- 2026-11-15 09:20Z: FM-0 reviewed (check 0 errors, 285 tests, build + leak check pass, diff and screenshots read) and merged (#38, 59deb16). GFM0 passed. FM-1 and FM-3 requested.
- 2026-11-15 09:25Z: FM-1 reviewed (merged with base: check 0 errors, 325 tests, build + leak check pass; path safety read) and merged (#39, 992d8df).
- 2026-11-15 09:32Z: David's full-bleed map direction recorded and sent to FM-3; goes into the FM-4 brief.
- 2026-11-15 10:05Z: FM-3 reviewed (check 0 errors, 340 tests, build + leak check pass, screenshots read: full-bleed per David) and merged (#40, 41d016b). Early units done; rest waits for cakeutils GMAP2.
