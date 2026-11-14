# Live map — progress (coordinator-owned)

Line: the `/map` page on squaremap tiles via cakeutils `/v2/map` (brief: cakeutils `v2/map/FISHNET-BRIEF.md`).
Integration branch: `claude/fishnet-map` (off `main` at `dd1267d`). PR `claude/fishnet-map` → `main` is opened for
David at GFM2 and not merged by the coordinator. Unit PRs target `claude/fishnet-map`.

Start rule (David, 2026-11-14): FM-0, FM-1, FM-3 once cakeutils MAP-C0 is merged (into cakeutils `claude/map`);
everything else after cakeutils GMAP2 (cakeutils `v2/map/PROGRESS.md` on `claude/map`).

| WU | Status | Model / effort | Thread | Branch | PR | Notes |
|---|---|---|---|---|---|---|
| FM-0 contracts | waiting (MAP-C0) | Opus 5.5 / high | | | | early |
| FM-1 tile proxy | waiting (FM-0) | Sonnet 5.5 / high | | | | early |
| FM-3 map canvas | waiting (FM-0) | Fable 5.2 / medium | | | | early |
| FM-2 live hub, SSE | waiting (GMAP2) | Opus 5.5 / high | | | | |
| FM-4 pages | waiting (GMAP2, FM-3) | Sonnet 5.5 / high | | | | |
| FM-5 layers, One Soul rounds | waiting (GMAP2, FM-3) | Sonnet 5.5 / medium | | | | |
| FM-6 deploy, docs | waiting (GMAP2, FM-1, FM-2) | Haiku 5.5 / low | | | | |
| FM-m mini worlds | waiting (GMAP2, MAP-31) | Sonnet 5.5 / medium | | | | |
| FM-8 show on map | waiting (FM-4) | Sonnet 5.5 / medium | | | | |
| FM-7 integration, QA, go-live | waiting (all) | Fable 5.2 / high | | | | |

Gates: GFM0 open, GFM1 open, GFM2 open. Screenshots thread ("Map screenshots"): cmsg_017jXErfLmkLcYLSb5FKAVcMADw8BDRoVvuMRhAtXTp9cP.

## Decisions

- 2026-11-14: "MAP-C0 merged" means merged into cakeutils `claude/map` (the map integration branch), not `main`.

## Log

- 2026-11-14 23:00Z: line started. cakeutils MAP-C0 in progress (not merged), GMAP2 open: no unit can start yet.
  `claude/fishnet-map` created. "Map screenshots" thread requested from the project coordinator.
