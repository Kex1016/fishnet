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
| FM-2 live hub, SSE | **merged** 549ca0a | Opus 5.5 / high | cmsg_017jXErfLmkLcYLSb5FKAVcM9KqCGixSeEL8G9QZ2PRtiz | | #43 | |
| FM-4 pages | **merged** 4fd45ab | Sonnet 5.5 / high | cmsg_017jXErfLmkLcYLSb5FKAVcMHrvYSaXiUfeQmTLGZk1awV | claude/project-thread-07827n | #44 | |
| FM-5 layers, One Soul rounds | **merged** 30173d0 | Sonnet 5.5 / medium | cmsg_017jXErfLmkLcYLSb5FKAVcMJT7uHxrgGEJ3gBYJcm4wPK | | #42 | |
| FM-6 deploy, docs | **merged** 126153b | Haiku 5.5 / low | cmsg_017jXErfLmkLcYLSb5FKAVcMLx4U5tTPgm8hyjLLh1ZmYv | | #45 | |
| FM-0b fixture sync | **merged** 6cb11c9 | Sonnet 5.5 / low | cmsg_017jXErfLmkLcYLSb5FKAVcM5ftpf5BqgSVQMmVoD8A8oa | | #41 | MAP-43 follow-up (brief §7) |
| FM-m mini worlds | in progress | Sonnet 5.5 / medium | cmsg_017jXErfLmkLcYLSb5FKAVcMJbVo1bafaL466vm4sX3MzM | | | |
| FM-8 show on map | in progress | Sonnet 5.5 / medium | cmsg_017jXErfLmkLcYLSb5FKAVcM3HsPrW1hpcGKQY5rEeZJfm | | | |
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
- 2026-11-15: FM-0b (brief §7 follow-up) syncs mock/client with MAP-43's §2 and fixtures and adds
  `src/lib/map/worlds.ts` (vanilla worlds arrive `order 0`, raw names: the site orders and labels them).
- 2026-11-15: FM-6 starts after FM-2 (it documents FM-2's env vars and Caddy block); FM-m starts after FM-4
  (it changes FM-4's world picker), both to keep file ownership disjoint.
- 2026-11-15 (FM-2): browser connects to `liveHref(server)+"?world=&epoch=&seq="`, reconnects on world change; positions-off
  comes from `live_players` in /v2/map (not in the snapshot); tile reset on `dropped > seq` (not ≥: nothing lost when
  equal), accepted; players on worlds no longer listed are dropped; env `MAP_SSE_MAX`; 4 streams per exact client
  address (IPv6 /64 not grouped: FM-7 to judge).
- Screenshots threads: "Map screenshots" is full; later stages go to "Map screenshots 2"
  (cmsg_017jXErfLmkLcYLSb5FKAVcMWkkENWXb2WqP27uo6Awu6E), at most 6 files per post.
- 2026-11-15 (FM-4): pages use `src/lib/map/liveClient.ts` (SSE, resumes after last tile event) and `pages.ts`;
  world list in `/map/[server]` `data.worlds` via worldLabel; `?follow=` written into share links but read by FM-8.
  FM-7 to look at: busy mock hub tile epoch differs from the page's change-log epoch (`mock-1`).
- 2026-11-15: FM-8 and FM-m run in parallel; both touch `/map/[server]/+page.svelte`. FM-m puts the grouped picker
  in a new `src/lib/map/WorldPicker.svelte` with a one-line swap in the page; FM-8 owns the `?follow=` handling;
  the second to merge rebases.

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
