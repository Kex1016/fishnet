<script lang="ts">
  // The map canvas (FM-3, brief §5; David, 15 Nov 2026: the map fills the whole view and everything else floats
  // over it as overlays, popouts and hover popups, see map.css `mc-stage`, `mc-over`, MapPopout): squaremap tiles on Leaflet's flat CRS, player dots that glide, follow mode,
  // the layers handed in, and its own controls in the Fishnet look. The server renders a still frame of the same
  // view (tiles and dots as plain images) so the map is a picture before, and without, JavaScript; Leaflet is
  // loaded with a dynamic import on mount, so no other page carries it.
  //
  // Besides the frozen props (types.ts) the instance has methods for the page around it:
  //   follow(uuid), unfollow()       follow mode from outside (the player list)
  //   applyTiles(event)              a `tiles` event of the live stream (tiles.ts)
  //   setView(view), view()          move the map, read where it looks
  //   pointOf(block)                 where a raw block coordinate is inside the frame, in px
  //   showMarker(id, {focus})        centre on a map marker (fit its box) and open its popup (FMK-2)
  import { onMount, untrack } from "svelte";
  import type * as Leaflet from "leaflet";
  import { Home, Minus, Plus, X } from "@lucide/svelte";
  import "./map.css";
  import "./markers/markers.css";
  import { centreLatLng, clampZoom, faceSrc, maxZoom, openingView, readout, stillOffset, stillTiles, toBlock, toLatLng } from "./crs.ts";
  import { tilePath, tileVersion } from "./links.ts";
  import { drawLayers } from "./overlays.ts";
  import { createPlayers, type MapPlayers } from "./players.ts";
  import { createTiles, type MapTiles } from "./tiles.ts";
  import { createMarkerLayer, type MarkerLayer } from "./markers/layer.ts";
  import type { MapCanvasMarkers } from "./markers/types.ts";
  import type { Block, MapCanvasProps, MapView, TilesEvent } from "./types.ts";

  let { world, players, glideMs, view: viewProp, follow: followProp = null, layers = [], label, onview, onfollow, onpick, markers }: MapCanvasProps & { /** the world's markers (FMK-2, markers/layer.ts) */ markers?: MapCanvasMarkers } = $props();

  // ---- the still frame (server and first paint)
  const opening = $derived(openingView(world, viewProp));
  const still = $derived(
    stillTiles(world, opening).map((t) => {
      const ver = world.tiles.epoch !== null ? tileVersion(world.tiles.epoch, world.tiles.versions[t.key] ?? 0) : null;
      // a finished round's template has no `?v=`; a live world's URL is the one Leaflet asks for, so the browser loads it once
      const src = world.tiles.frozen ? world.tiles.template.replace("{z}", String(t.z)).replace("{x}", String(t.x)).replace("{y}", String(t.y)) : tilePath(world.server, world.id, t, ver);
      return { ...t, src };
    })
  );
  const here = $derived(players.filter((p) => p.world === world.id));

  // ---- live state
  let host: HTMLDivElement;
  let live = $state(false);
  let zoom = $state(untrack(() => opening.zoom));
  let at = $state<Block>(untrack(() => ({ x: opening.x, z: opening.z })));
  let pointer = $state<Block | null>(null);
  let following = $state<string | null>(untrack(() => followProp));
  let unmapped = $state(false);

  let L: typeof Leaflet | null = null;
  let map: Leaflet.Map | null = null;
  let tiles: MapTiles | null = null;
  let dots: MapPlayers | null = null;
  let marks: Leaflet.LayerGroup | null = null;
  let markerLayer: MarkerLayer | null = null;
  let ready = $state(false);

  const max = $derived(world.zoom.max);
  const top = $derived(maxZoom(world.zoom));
  const followed = $derived(following ? (players.find((p) => p.uuid === following) ?? null) : null);
  const followedFace = $derived(followed ? faceSrc(followed.uuid) : null);
  const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function currentView(): MapView {
    return { world: world.id, x: at.x, z: at.z, zoom };
  }

  let viewTimer: ReturnType<typeof setTimeout> | null = null;
  function moved(): void {
    if (!map) return;
    const c = map.getCenter();
    at = toBlock(max, c.lat, c.lng);
    zoom = map.getZoom();
    // follow recentres every frame: the page hears about the view at most four times a second
    if (onview && !viewTimer)
      viewTimer = setTimeout(() => {
        viewTimer = null;
        onview?.(currentView());
      }, 250);
  }

  function checkCoverage(): void {
    if (!tiles) return;
    const c = tiles.coverage();
    unmapped = c.total > 0 && c.drawn === 0 && !tiles.layer.isLoading();
    if (!live && (c.drawn > 0 || !tiles.layer.isLoading())) live = true;
  }

  /** Build everything that belongs to one world; called on mount and when the world changes. */
  function mountWorld(): void {
    if (!L || !map) return;
    tiles?.destroy();
    dots?.destroy();
    const o = openingView(world, viewProp);
    map.setMinZoom(world.zoom.min);
    map.setMaxZoom(top);
    map.setView(centreLatLng(max, o), o.zoom, { animate: false });
    tiles = createTiles(L, world, checkCoverage);
    tiles.layer.addTo(map);
    dots = createPlayers(L, map, {
      max,
      world: world.id,
      worldName: world.name,
      glideMs: () => glideMs,
      reduced,
      onpick: (uuid) => onpick?.(uuid),
      onfollow: (uuid) => {
        following = uuid;
        onfollow?.(uuid);
      }
    });
    dots.set(players);
    if (following) dots.follow(following);
    drawLayers(L, map, marks!, layers, { max });
    moved();
  }

  onMount(() => {
    let gone = false;
    let ro: ResizeObserver | null = null;
    void import("leaflet").then((mod) => {
      if (gone) return;
      L = (mod as unknown as { default?: typeof Leaflet }).default ?? mod;
      const calm = reduced();
      map = L.map(host, {
        crs: L.CRS.Simple,
        zoomControl: false,
        attributionControl: false,
        zoomSnap: 1,
        zoomDelta: 1,
        keyboard: true,
        keyboardPanDelta: 96,
        bounceAtZoomLimits: false,
        inertia: !calm,
        zoomAnimation: !calm,
        fadeAnimation: !calm,
        markerZoomAnimation: !calm,
        maxBoundsViscosity: 0
      });
      marks = L.layerGroup().addTo(map);
      map.on("move zoomend", moved);
      map.on("mousemove", (e: Leaflet.LeafletMouseEvent) => (pointer = toBlock(max, e.latlng.lat, e.latlng.lng)));
      map.on("mouseout", () => (pointer = null));
      mountWorld();
      ro = new ResizeObserver(() => map?.invalidateSize({ animate: false }));
      ro.observe(host);
      ready = true;
      // nothing mapped here and nothing loading: the still frame must not linger
      setTimeout(() => (live = true), 1500);
    });
    return () => {
      gone = true;
      ro?.disconnect();
      if (viewTimer) clearTimeout(viewTimer);
      tiles?.destroy();
      dots?.destroy();
      markerLayer?.destroy();
      markerLayer = null;
      map?.remove();
      map = null;
    };
  });

  // a different world (or round): new tiles, new dots, the world's opening view
  let shown = untrack(() => `${world.server}/${world.cycle ?? ""}/${world.id}`);
  $effect(() => {
    const id = `${world.server}/${world.cycle ?? ""}/${world.id}`;
    if (!ready || id === shown) return;
    shown = id;
    untrack(mountWorld);
  });
  $effect(() => {
    const list = players;
    if (ready) untrack(() => dots?.set(list));
  });
  $effect(() => {
    const uuid = followProp;
    if (!ready) {
      following = uuid;
      return;
    }
    untrack(() => {
      if (uuid === dots?.following()) return;
      following = uuid;
      if (uuid) dots?.follow(uuid);
      else dots?.unfollow();
    });
  });
  $effect(() => {
    const list = layers;
    if (ready && L && map && marks) drawLayers(L, map, marks, list, { max: untrack(() => max) });
  });
  // the markers (FMK-2): the layer is made once Leaflet is up and the world's view is set, then handed every change
  $effect(() => {
    const m = markers ? { ...markers, reveal: undefined } : null;
    const reveal = markers?.reveal ?? null;
    const w = max;
    if (!ready || !L || !map) return;
    untrack(() => {
      if (!m) return markerLayer?.update({ markers: [], selected: null });
      if (!markerLayer) {
        markerLayer = createMarkerLayer(L!, map!, { max: w, ...m });
        if (reveal !== null) showMarker(reveal, { animate: false });
      } else markerLayer.update({ max: w, ...m });
    });
  });
  // the page changed the tile source (a new epoch or versions from a reload): same as a `tiles` event
  let source = untrack(() => world.tiles);
  $effect(() => {
    const src = world.tiles;
    if (!ready || src === source) return;
    source = src;
    if (src.epoch !== null)
      untrack(() => tiles?.apply({ world: world.id, epoch: src.epoch!, reset: false, tiles: Object.entries(src.versions).map(([k, seq]) => [tileVersion(src.epoch!, seq), ...(k.split("/").map(Number) as [number, number, number])]) }));
  });

  // ---- for the page around the map
  export function follow(uuid: string): void {
    following = uuid;
    dots?.follow(uuid);
  }
  export function unfollow(): void {
    following = null;
    dots?.unfollow();
  }
  export function applyTiles(ev: TilesEvent): void {
    tiles?.apply(ev);
  }
  export function view(): MapView {
    return currentView();
  }
  export function setView(v: Partial<Omit<MapView, "world">>, animate = true): void {
    if (!map) return;
    const o = openingView(world, { x: v.x ?? at.x, z: v.z ?? at.z, zoom: v.zoom ?? zoom });
    map.setView(centreLatLng(max, o), o.zoom, { animate: animate && !reduced() });
  }
  /** Where a raw block coordinate (its north-west corner for a whole block) is inside the frame, in px. */
  export function pointOf(b: Block): { x: number; y: number } | null {
    if (!map) return null;
    const p = map.latLngToContainerPoint(toLatLng(max, b.x, b.z));
    return { x: p.x, y: p.y };
  }

  /** Centres the map on a marker (an area: the zoom that fits its box; a point: the world's default zoom) and opens its popup. */
  export function showMarker(id: number, o: { focus?: boolean; view?: boolean; animate?: boolean } = {}): boolean {
    const v = markers?.markers.find((m) => m.id === id);
    if (!v || !map || !L || !markerLayer) return false;
    if (o.view !== false) {
      const animate = o.animate !== false && !reduced();
      if (v.point) map.setView(centreLatLng(max, v.point), clampZoom(world.zoom, world.zoom.default), { animate });
      else {
        const b = L.latLngBounds(toLatLng(max, v.bbox.minX, v.bbox.maxZ), toLatLng(max, v.bbox.maxX, v.bbox.minZ));
        map.setView(b.getCenter(), map.getBoundsZoom(b, false, L.point(48, 48)), { animate });
      }
    }
    markerLayer.open(id, { focus: o.focus, pan: false }); // the view was just set: the popup is already in the middle
    return true;
  }

  function stopFollowing(): void {
    unfollow();
    onfollow?.(null);
  }
  function toSpawn(): void {
    if (following) stopFollowing();
    setView({ x: Math.floor(world.spawn.x), z: Math.floor(world.spawn.z), zoom: world.zoom.default });
    host.focus({ preventScroll: true });
  }
  const hintId = $props.id();
</script>

<div class="mc" class:mc--live={live} data-over={zoom > max ? "" : undefined} data-ready={ready ? "" : undefined} data-zoom={zoom}>
  <div class="mc__still" aria-hidden="true">
    {#each still as t (t.key)}
      <img class="mc-still__tile" src={t.src} alt="" width={t.size} height={t.size} loading="lazy" decoding="async" style:left="calc(50% + {t.left}px)" style:top="calc(50% + {t.top}px)" />
    {/each}
    {#each here as p (p.uuid)}
      {@const o = stillOffset(world, opening, p)}
      {@const src = faceSrc(p.uuid)}
      <span class="mc-dot mc-dot--still" style:left="calc(50% + {o.left}px)" style:top="calc(50% + {o.top}px)">
        <span class="mc-dot__nose" style:transform="rotate({p.yaw}deg)"></span>
        {#if src}<img class="mc-dot__face" {src} alt="" width="24" height="24" />{:else}<span class="mc-dot__face"></span>{/if}
      </span>
    {/each}
  </div>

  <!-- svelte-ignore a11y_no_noninteractive_tabindex: Leaflet makes this element the keyboard target of the map -->
  <div class="mc__map" bind:this={host} role="application" aria-roledescription="map" aria-label={label} aria-describedby="{hintId}-hint"></div>
  <p id="{hintId}-hint" class="visually-hidden">Arrow keys move the map, plus and minus zoom. The player list holds the same players.</p>

  {#if ready}
    {#if following && followed}
      <button type="button" class="fp-chip mc__follow" aria-pressed="true" onclick={stopFollowing} title="Stop following">
        {#if followedFace}<img class="fp-face" src={followedFace} alt="" width="16" height="16" />{/if}
        <span>Following {followed.name}</span>
        <X class="fp-ico fp-ico--sm" aria-hidden="true" />
      </button>
    {/if}
    <div class="mc__controls" role="group" aria-label="Map controls">
      <button type="button" class="fp-ibtn" aria-label="Zoom in" title="Zoom in" disabled={zoom >= top} onclick={() => map?.zoomIn()}><Plus class="fp-ico" aria-hidden="true" /></button>
      <button type="button" class="fp-ibtn" aria-label="Zoom out" title="Zoom out" disabled={zoom <= world.zoom.min} onclick={() => map?.zoomOut()}><Minus class="fp-ico" aria-hidden="true" /></button>
      <hr />
      <button type="button" class="fp-ibtn" aria-label="Back to spawn" title="Back to spawn" onclick={toSpawn}><Home class="fp-ico" aria-hidden="true" /></button>
    </div>
    {#if unmapped}
      <div class="mc__empty fp-rise">
        <p>This area is not mapped yet</p>
        <button type="button" class="fp-btn" onclick={toSpawn}>Back to spawn</button>
      </div>
    {/if}
  {/if}
  <div class="mc__foot">
    <output class="mc__readout" aria-label="Coordinates">{readout(pointer ?? at)}</output>
    <span class="mc__credit">Tiles by squaremap</span>
  </div>
</div>
