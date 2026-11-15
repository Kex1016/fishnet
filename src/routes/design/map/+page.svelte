<script lang="ts">
  // The map preview on the mock (FM-0, FM-3): one world on the real map canvas, full bleed (David, 15 Nov 2026:
  // the map fills the whole view; controls and information are popouts, overlays and hover popups), with live
  // dots, follow mode and a sample layer. The popouts hold what /v2/map lists (servers and worlds), the players
  // (the dots' accessible twin) and the layers. Not the map page (FM-4 builds that on the same layout): here to
  // check the canvas, the fixtures and the hide wrapper by eye and with Playwright (scripts/map-canvas-check.ts).
  import { onMount, untrack } from "svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import MapCanvas from "#lib/map/MapCanvas.svelte";
  import MapPopout from "#lib/map/MapPopout.svelte";
  import { readout } from "#lib/map/crs.ts";
  import { mapHref } from "#lib/map/links.ts";
  import type { MapLayer, MapView, PlayerDot, PlayersSnapshot, TilesEvent } from "#lib/map/types.ts";
  import { Globe, Layers, Map as MapIcon, Users } from "@lucide/svelte";
  let { data } = $props();

  // the load's snapshot seeds the live list; a navigation resets it below
  let players = $state<PlayerDot[]>(untrack(() => data.players));
  let follow = $state<string | null>(untrack(() => data.link.follow ?? null));
  let at = $state<MapView | null>(null);
  let sample = $state(false);
  const servers = $derived(data.servers.ok ? data.servers.data.servers : []);
  let canvas = $state<ReturnType<typeof MapCanvas> | null>(null);

  $effect(() => {
    players = data.players;
  });

  const v = $derived(data.view);
  const here = $derived(v ? players.filter((p) => p.world === v.id) : []);
  // a made-up layer on known blocks of the mock (the spawn block and the 128-block grid): preview only
  const layers = $derived.by((): MapLayer[] => {
    if (!v) return [];
    const dim = v.dimension ?? "unknown";
    const mark = (id: string, x: number, z: number, title: string, detail: string) => ({ id, kind: "other" as const, dim, x, z, y: null, title, detail, href: null });
    return [
      { id: "sample-spawn", label: "Spawn", shape: "diamond", on: sample, data: { marks: [mark("spawn", v.spawn.x, v.spawn.z, "Spawn", readout(v.spawn))], paths: [] } },
      {
        id: "sample-grid",
        label: "Grid",
        shape: "cross",
        on: sample,
        data: {
          marks: [mark("g", 128, 128, "Grid crossing", readout({ x: 128, z: 128 }))],
          paths: [{ id: "square", dim, points: [[0, 0], [128, 0], [128, 128], [0, 128], [0, 0]], title: "Grid square", detail: null, href: null }]
        }
      }
    ];
  });

  onMount(() => {
    // for scripts/map-canvas-check.ts: the canvas instance of this preview
    const w = window as unknown as { __fmap?: unknown };
    Object.defineProperty(w, "__fmap", { configurable: true, get: () => canvas });
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const cur = data.view;
      if (cur && !document.hidden) {
        try {
          const res = await fetch(`/design/map/live.json?server=${encodeURIComponent(cur.server)}&world=${encodeURIComponent(cur.id)}`);
          if (res.ok && !stop && data.view === cur) {
            const body = (await res.json()) as { snapshot: PlayersSnapshot; tiles: TilesEvent | null };
            players = body.snapshot.players;
            if (body.tiles) canvas?.applyTiles(body.tiles);
          }
        } catch {
          /* the next poll tries again */
        }
      }
      if (!stop) timer = setTimeout(poll, data.pollMs);
    };
    timer = setTimeout(poll, data.pollMs);
    return () => {
      stop = true;
      clearTimeout(timer);
      delete w.__fmap;
    };
  });
</script>

{#if !v}
  <div class="fp-page">
    {#if !data.servers.ok && data.servers.kind === "off"}
      <EmptyState icon={MapIcon} title="There is no map on this network" />
    {:else if !data.servers.ok}
      <Notice kind="warning"><b>cakeutils could not be reached.</b></Notice>
    {:else}
      <EmptyState icon={MapIcon} title="No server has a map yet" line="A server's map shows up here as soon as it shares one." />
    {/if}
  </div>
{:else}
  <div class="mc-stage">
    <h1 class="visually-hidden">Map preview: {v.name} of {v.server}</h1>
    {#key `${v.server}/${v.id}`}
      <MapCanvas
        bind:this={canvas}
        world={v}
        {players}
        glideMs={data.pollMs}
        view={data.link}
        {follow}
        {layers}
        label="Map of {v.server}, {v.name}"
        onview={(m) => (at = m)}
        onfollow={(u) => (follow = u)}
      />
    {/key}
    <div class="mc-over">
      <div class="mc-over__row">
        <MapPopout label="Worlds" value={v.name} icon={Globe}>
          {#each servers as s (s.server)}
            <div class="mc-pop__list">
              <span class="mc-pop__line">{s.display_name}{s.live_players ? "" : " · live positions are off"}</span>
              {#each s.worlds as w (w.id)}
                <a class="mc-pop__item" href="?server={s.server}&world={w.id}" aria-current={s.server === v.server && w.id === v.id ? "page" : undefined}>
                  <span class="mc-pop__grow">{w.name}</span>
                  <span class="mc-pop__note">{w.dimension ?? "unknown"}</span>
                </a>
              {/each}
            </div>
          {/each}
          <span class="mc-pop__line t-mono">zoom {v.zoom.min}..{v.zoom.max} (+{v.zoom.extra}) · spawn {readout(v.spawn)} · change log {v.tiles.epoch !== null ? "yes" : "no"}</span>
          {#if at}<code class="mp-link">{mapHref(v.server, { ...at, follow })}</code>{/if}
        </MapPopout>
        <MapPopout label="Players" count={data.positions === "on" ? here.length : undefined} icon={Users}>
          {#if data.positions === "off"}
            <span class="mc-pop__line">Live positions are off</span>
          {:else if data.positions === "down"}
            <span class="mc-pop__line">Positions could not be read</span>
          {:else if here.length === 0}
            <span class="mc-pop__line">No one is in this world right now</span>
          {:else}
            <div class="mc-pop__list">
              {#each here as p (p.uuid)}
                <button type="button" class="mc-pop__item mp-follow" aria-pressed={follow === p.uuid} aria-label="{follow === p.uuid ? 'Stop following' : 'Follow'} {p.name}" onclick={() => (follow = follow === p.uuid ? null : p.uuid)}>
                  <Face uuid={p.uuid} size="sm" />
                  <span class="mc-pop__grow">{p.name}</span>
                  <span class="mc-pop__note">{readout(p)}</span>
                </button>
              {/each}
            </div>
            <span class="mc-pop__line">Pick a player to follow them.</span>
          {/if}
        </MapPopout>
        <MapPopout label="Layers" icon={Layers}>
          <div class="mc-pop__list">
            <button type="button" class="mc-pop__item mp-sample" aria-pressed={sample} onclick={() => (sample = !sample)}>
              <span class="mc-pop__shape mc-mark" data-shape="cross"><span class="mc-mark__glyph"></span></span>
              <span class="mc-pop__grow">Sample layer</span>
              <span class="mc-pop__note">{sample ? "on" : "off"}</span>
            </button>
          </div>
          <span class="mc-pop__line">A made-up layer on the mock's spawn block and grid, preview only.</span>
        </MapPopout>
      </div>
    </div>
  </div>
{/if}

<style>
  .mp-link { display: block; overflow-wrap: anywhere; white-space: normal; max-width: 100%; }
  .mc-pop__shape.mc-mark { position: relative; left: 0; top: 0; }
</style>
