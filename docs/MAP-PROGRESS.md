# Live map — progress (coordinator-owned)

Line: the `/map` page on squaremap tiles via cakeutils `/v2/map` (brief: cakeutils `v2/map/FISHNET-BRIEF.md`).
Integration branch: `claude/fishnet-map` (off `main` at `dd1267d`). PR `claude/fishnet-map` → `main` is opened for
David at GFM2 and not merged by the coordinator. Unit PRs target `claude/fishnet-map`.

Start rule (David, 2026-11-14): FM-0, FM-1, FM-3 once cakeutils MAP-C0 is merged (into cakeutils `claude/map`);
everything else after cakeutils GMAP2 (cakeutils `v2/map/PROGRESS.md` on `claude/map`).

| WU | Status | Model / effort | Thread | Branch | PR | Notes |
|---|---|---|---|---|---|---|
| FM-0 contracts | **merged** 59deb16 | Opus 5.5 / high | cmsg_017jXErfLmkLcYLSb5FKAVcMRkD7EasRAE44kCebvUP2us | claude/project-thread-hf70c4 | #38 | early |
| FM-1 tile proxy | in progress | Sonnet 5.5 / high | cmsg_017jXErfLmkLcYLSb5FKAVcM8uYUXfxLcYWKvBe73J2HfJ | | | early |
| FM-3 map canvas | in progress | Fable 5.2 / medium | cmsg_017jXErfLmkLcYLSb5FKAVcMEKSWLpTczmc4csx1NMMHJd | | | early |
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

## Log

- 2026-11-14 23:00Z: line started. cakeutils MAP-C0 in progress (not merged), GMAP2 open: no unit can start yet.
  `claude/fishnet-map` created. "Map screenshots" thread requested from the project coordinator.
- 2026-11-15 08:50Z: cakeutils MAP-C0 merged into `claude/map` (PR #98, 2050530); GMAP0 passed, GMAP1/GMAP2 open.
  FM-0 thread requested (Opus 5.5 / high). FM-1 and FM-3 follow FM-0 (brief §7.2).
- 2026-11-15 09:20Z: FM-0 reviewed (check 0 errors, 285 tests, build + leak check pass, diff and screenshots read) and merged (#38, 59deb16). GFM0 passed. FM-1 and FM-3 requested.
