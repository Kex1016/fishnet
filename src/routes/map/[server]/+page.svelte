<script lang="ts">
  // One server's map (FM-4), full bleed (David, 15 Nov 2026): the map fills the whole area beside the site nav and
  // everything else floats over it: popouts for the worlds (and the other servers), the players and the share link,
  // a status line when something is off, and hover popups on the dots (MapCanvas). The popouts are <details>, so the
  // world and player lists work without JavaScript; the server renders the map as a still picture of the same view.
  // Live: an EventSource on /map/<server>/live with a players.json poll as the fallback (liveClient.ts).
  // The share link (?world=&x=&z=&zoom=) follows the view, so the address bar is always a link to what you see.
  // ?follow= (FM-8, "Show on map" on a profile) opens the player's world centred on them and follows them; when they
  // are not here a Notice says why and links to the server they are on. A followed player who changes world keeps the
  // follow: the page switches world with them.
  // Markers (FMK-2): the world's pins and areas are drawn by the canvas (markers/layer.ts), listed in the Places popout
  // (the keyboard twin) and toggled in the Layers popout. `?marker=<id>` opens the map on one with its popup, in
  // whichever world holds it (the load finds it); the link follows the open popup. A `markers` live event (FMK-3)
  // refetches this world's list from markers.json and redraws it without moving the view.
  import { onMount, untrack } from "svelte";
  import { goto, replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import MapCanvas from "#lib/map/MapCanvas.svelte";
  import WorldPicker from "#lib/map/WorldPicker.svelte";
  import MapPopout from "#lib/map/MapPopout.svelte";
  import LayersPopout from "#lib/map/layers/LayersPopout.svelte";
  import PlacesPopout from "#lib/map/markers/PlacesPopout.svelte";
  import { drawOrder, markerViews } from "#lib/map/markers/view.ts";
  import type { MarkersLoad } from "#lib/map/markers/types.ts";
  import type { MapLayer } from "#lib/map/types.ts";
  import { readout } from "#lib/map/crs.ts";
  import { connectLive } from "#lib/map/liveClient.ts";
  import { mapHref, markersJsonHref } from "#lib/map/links.ts";
  import { followText } from "#lib/map/showOnMap.ts";
  import { groupPlayers } from "#lib/map/pages.ts";
  import type { LiveState, MapView, PlayerDot, TilesEvent } from "#lib/map/types.ts";
  import { asOf } from "#lib/format/dates.ts";
  import { Check, Copy, Crosshair, Globe, Link2, Map as MapIcon, Radio, TriangleAlert, Users } from "@lucide/svelte";
  let { data } = $props();

  let players = $state<PlayerDot[]>(untrack(() => data.players));
  let follow = $state<string | null>(untrack(() => data.follow));
  let at = $state<MapView | null>(null);
  let liveState = $state<LiveState>("live");
  let liveAt = $state<number | null>(null);
  let canvas = $state<ReturnType<typeof MapCanvas> | null>(null);
  let mounted = $state(false);
  let copied = $state(false);
  let mk = $state<MarkersLoad>(untrack(() => data.markers));
  let uni = $state(untrack(() => data.uni));
  let selected = $state<number | null>(untrack(() => data.markerId));
  let markersOn = $state(true);
  let placesOpen = $state(false);

  const v = $derived(data.view);
  const views = $derived(markerViews(mk.markers));
  const places = $derived(drawOrder(views));
  const layerList = $derived<MapLayer[]>(mk.state === "ok" && views.length > 0 ? [{ id: "markers", label: "Markers", shape: "circle", on: markersOn, data: { marks: [], paths: [] }, count: views.length }] : []);
  const markerLink = (id: number) => (v ? mapHref(v.server, { world: v.id, marker: id }) : "");
  const groups = $derived(v ? groupPlayers(players, v.id) : { here: [], elsewhere: [] });
  const worldName = $derived(new Map<string, string>(data.worlds.map((w: { id: string; name: string }) => [w.id, w.name])));

  // a navigation (another world or server) brings a new snapshot; the live feed reconnects below
  let shownServer = untrack(() => data.server);
  $effect(() => {
    players = data.players;
    mk = data.markers;
    uni = data.uni;
    selected = data.markerId;
    at = null;
    liveState = "live";
    liveAt = null;
    if (data.server !== shownServer) shownServer = data.server;
    // every load decides: a link with ?follow= follows (the world switch below keeps it), any other opens unfollowed
    follow = data.follow;
  });

  // a followed player changes world: go with them (the follow stays in the link; the load centres on them)
  let switching = "";
  let moving = false; // a world switch is on its way: the share link must not write the old world back meanwhile
  $effect(() => {
    const cur = data.view;
    if (!cur || !follow) return;
    const p = players.find((x) => x.uuid === follow);
    if (!p || p.world === cur.id || !data.worlds.some((w: { id: string }) => w.id === p.world)) return;
    const key = `${cur.server}/${p.world}/${follow}`;
    if (key === switching) return;
    switching = key;
    moving = true;
    untrack(() => goto(mapHref(cur.server, { world: p.world, follow }), { replaceState: true }).finally(() => (moving = false)));
  });

  // the live feed: one connection per server and world; positions off and no change log means nothing to listen for
  $effect(() => {
    const cur = data.view;
    if (!cur || (data.positions === "off" && cur.tiles.epoch === null)) return;
    const seqs = Object.values(cur.tiles.versions);
    const since = cur.tiles.epoch !== null ? { epoch: cur.tiles.epoch, seq: seqs.length ? Math.max(...seqs) : 0 } : null;
    const conn = connectLive(cur.server, cur.id, since, {
      onPlayers: (list) => (players = list),
      onTiles: (ev: TilesEvent) => {
        if (ev.world === cur.id) canvas?.applyTiles(ev);
      },
      onMarkers: (ev) => {
        if (ev.world === cur.id) void refetchMarkers(cur.server, cur.id);
      },
      onStatus: (s, t) => {
        liveState = s;
        liveAt = t;
      },
      // the hub's first `rev` for a world is only its baseline: a change between this page's load and the stream's open is
      // caught by asking once as the stream opens (FMK-3's note); later changes arrive as `markers` events
      onMode: (mode) => {
        if (mode === "stream") void refetchMarkers(cur.server, cur.id);
      }
    }, { markersRev: untrack(() => (mk.state === "ok" ? mk.rev : null)) });
    return () => conn.close();
  });

  // the world's markers again after a `markers` event: the last good list stays when the answer is not a good one
  let refetching: Promise<void> | null = null;
  function refetchMarkers(server: string, world: string): Promise<void> {
    return (refetching ??= (async () => {
      try {
        // `no-cache`: the browser revalidates (If-None-Match) instead of serving its 15 s copy of an older list
        const res = await fetch(markersJsonHref(server, world), { headers: { accept: "application/json" }, cache: "no-cache" });
        if (!res.ok || data.view?.id !== world) return;
        const body = await res.json();
        if (!body || !Array.isArray(body.markers) || typeof body.rev !== "number") return;
        if (mk.state === "ok" && mk.world === world && mk.rev === body.rev && !mk.stale && res.headers.get("x-stale") !== "1") return; // nothing new: nothing redrawn
        // a stale list keeps the time it was last good (x-as-of), so Places says how old it really is
        const stale = res.headers.get("x-stale") === "1";
        const kept = Number(res.headers.get("x-as-of"));
        mk = { world, state: "ok", rev: body.rev, markers: body.markers, asOf: stale && kept > 0 ? kept : Date.now(), stale };
        if (body.uni && typeof body.uni === "object") uni = body.uni;
        if (selected !== null && !mk.markers.some((m: { id: number }) => m.id === selected)) selected = null;
      } catch {
        /* offline or cakeutils down: what is drawn stays, the next event tries again */
      } finally {
        refetching = null;
      }
    })());
  }
  function pickPlace(id: number) {
    selected = id;
    canvas?.showMarker(id, { focus: true });
  }
  function toggleLayer(id: string) {
    if (id !== "markers") return;
    markersOn = !markersOn;
    if (!markersOn) selected = null;
  }

  // the share link: the view as the address bar
  const here = $derived(v && at ? mapHref(v.server, { world: v.id, x: at.x, z: at.z, zoom: at.zoom, follow, marker: selected ?? undefined }) : v ? mapHref(v.server, { world: v.id }) : "");
  const absolute = $derived(here ? page.url.origin + here : "");
  $effect(() => {
    const to = at ? here : null;
    if (!to) return;
    const t = setTimeout(() => {
      if (moving) return;
      try {
        replaceState(to, page.state);
      } catch {
        /* the router is not ready (or the browser refuses): the link in the Share popout is still right */
      }
    }, 350);
    return () => clearTimeout(t);
  });

  onMount(() => {
    mounted = true;
    // for scripts/map-pages-check.ts: the canvas instance of this page
    const w = window as unknown as { __fmap?: unknown };
    Object.defineProperty(w, "__fmap", { configurable: true, get: () => canvas });
    return () => {
      delete w.__fmap;
    };
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(absolute);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      /* the field in the popout is selectable */
    }
  }
  function centreOn(e: MouseEvent, p: PlayerDot) {
    if (!v || !canvas || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    canvas.setView({ x: p.x, z: p.z, zoom: v.zoom.max });
  }
  const problems = {
    offline: { title: "This map is not available right now", line: "The server's map could not be reached. It will be back when the server's web map is." },
    format: { title: "This server's map cannot be shown", line: "Its web map is too old for the network to read." },
    no_worlds: { title: "This server has no map yet", line: "Its worlds show up here as soon as it shares them." },
    missing: { title: "This world is not on the map", line: "It may have been renamed. The server's other worlds are in the list." }
  } as const;
</script>

{#if !v}
  <div class="fp-page">
    <header class="fp-hero">
      <span class="t-kicker">Map</span>
      <h1 class="t-display">{data.name}</h1>
    </header>
    {#if data.down}
      <Notice kind="warning"><b>cakeutils could not be reached.</b> The map will be back when it is.</Notice>
    {:else if data.problem}
      <EmptyState icon={MapIcon} title={problems[data.problem as keyof typeof problems].title} line={problems[data.problem as keyof typeof problems].line}>
        {#if data.worlds.length > 1}
          <p class="fp-chips">{#each data.worlds as w (w.id)}<a class="fp-chip" href={mapHref(data.server, { world: w.id })}>{w.name}</a>{/each}</p>
        {/if}
      </EmptyState>
    {/if}
    <p class="t-small"><a href="/map">All maps</a></p>
  </div>
{:else}
  <div class="mc-stage">
    <h1 class="visually-hidden">Map of {data.name}: {v.name}</h1>
    {#key `${v.server}/${v.id}`}
      <MapCanvas
        bind:this={canvas}
        world={v}
        {players}
        glideMs={data.pollMs}
        view={data.link}
        {follow}
        label="Map of {data.name}, {v.name}"
        onview={(m) => (at = m)}
        onfollow={(u) => (follow = u)}
        markers={{ markers: views, on: markersOn && mk.state === "ok", selected, uni, href: markerLink, onselect: (id) => (selected = id), reveal: data.markerFit ? data.markerId : null }}
      />
    {/key}
    <div class="mc-over">
      <div class="mc-over__row">
        <MapPopout label="Worlds" value={v.name} icon={Globe}>
          <WorldPicker server={v.server} worlds={data.worlds} current={v.id} />
          {#if data.others.length > 1}
            <span class="mc-pop__title">Servers</span>
            <div class="mc-pop__list">
              {#each data.others as s (s.server)}
                <a class="mc-pop__item" href={mapHref(s.server)} aria-current={s.server === v.server ? "page" : undefined}><span class="mc-pop__grow">{s.name}</span></a>
              {/each}
            </div>
          {/if}
        </MapPopout>
        <MapPopout label="Players" count={data.positions === "on" ? players.length : undefined} icon={Users}>
          {#if data.positions === "off"}
            <span class="mc-pop__line">Live positions are off on this server.</span>
          {:else if data.positions === "down"}
            <span class="mc-pop__line">Positions could not be read right now.</span>
          {:else if players.length === 0}
            <span class="mc-pop__line">No one is online.</span>
          {:else}
            {#if groups.here.length}
              <div class="mc-pop__list">
                {#each groups.here as p (p.uuid)}
                  <div class="mp-row">
                    <a class="mc-pop__item" href={mapHref(v.server, { world: v.id, x: p.x, z: p.z, zoom: v.zoom.max })} onclick={(e) => centreOn(e, p)}>
                      <Face uuid={p.uuid} size="sm" />
                      <span class="mc-pop__grow">{p.name}</span>
                      <span class="mc-pop__note">{readout(p)}</span>
                    </a>
                    {#if mounted}
                      <button type="button" class="fp-ibtn" aria-pressed={follow === p.uuid} aria-label="{follow === p.uuid ? 'Stop following' : 'Follow'} {p.name}" title={follow === p.uuid ? "Stop following" : "Follow"} onclick={() => (follow = follow === p.uuid ? null : p.uuid)}>
                        <Crosshair class="fp-ico" aria-hidden="true" />
                      </button>
                    {/if}
                  </div>
                {/each}
              </div>
            {:else}
              <span class="mc-pop__line">No one is in this world right now.</span>
            {/if}
            {#if groups.elsewhere.length}
              <span class="mc-pop__title">In other worlds</span>
              <div class="mc-pop__list">
                {#each groups.elsewhere as p (p.uuid)}
                  <a class="mc-pop__item" href={mapHref(v.server, { world: p.world, x: p.x, z: p.z })}>
                    <Face uuid={p.uuid} size="sm" />
                    <span class="mc-pop__grow">{p.name}</span>
                    <span class="mc-pop__note">{worldName.get(p.world) ?? p.world}</span>
                  </a>
                {/each}
              </div>
            {/if}
          {/if}
        </MapPopout>
        <PlacesPopout markers={places} state={mk.state} {selected} asOf={mk.asOf} stale={mk.stale} worldName={v.name} onpick={pickPlace} form={{ action: mapHref(v.server), world: v.id }} bind:open={placesOpen} />
        {#if layerList.length}
          <LayersPopout layers={layerList} ontoggle={toggleLayer} hint="Pins and named areas that players placed in game." />
        {/if}
        <MapPopout label="Share" icon={Link2}>
          <span class="mc-pop__line">This link opens the map as you see it now.</span>
          <input class="fp-field mp-url t-mono" type="text" readonly value={absolute} aria-label="Link to this view" onfocus={(e) => e.currentTarget.select()} />
          {#if mounted}
            <button type="button" class="fp-btn" onclick={copy}>
              {#if copied}<Check class="fp-ico fp-ico--sm" aria-hidden="true" /> Copied{:else}<Copy class="fp-ico fp-ico--sm" aria-hidden="true" /> Copy link{/if}
            </button>
          {/if}
        </MapPopout>
        {#if data.markerMissing}
          <div class="mp-note">
            <Notice kind="info">This marker is not on the map any more.</Notice>
          </div>
        {/if}
        {#if data.followNote}
          {@const n = data.followNote}
          <div class="mp-note">
            <Notice kind="info">
              {followText(n)}
              {#if n.elsewhere}<a href={n.elsewhere.href}>Open the {n.elsewhere.name} map</a>{/if}
            </Notice>
          </div>
        {/if}
        {#if data.down || data.stale || liveState !== "live" || data.positions !== "on"}
          <ul class="mp-status" aria-label="Map status">
            {#if data.stale && data.asOf}
              <li class="fp-tag fp-tag--warning"><TriangleAlert class="fp-ico fp-ico--sm" aria-hidden="true" /> cakeutils could not be reached, {asOf(data.asOf)}</li>
            {/if}
            {#if liveState === "stale"}
              <li class="fp-tag fp-tag--warning"><TriangleAlert class="fp-ico fp-ico--sm" aria-hidden="true" /> Positions {liveAt ? asOf(liveAt) : "are out of date"}</li>
            {:else if liveState === "offline"}
              <li class="fp-tag fp-tag--warning"><TriangleAlert class="fp-ico fp-ico--sm" aria-hidden="true" /> The server's map is offline{liveAt ? `, ${asOf(liveAt)}` : ""}</li>
            {/if}
            {#if data.positions === "off"}
              <li class="fp-tag"><Radio class="fp-ico fp-ico--sm" aria-hidden="true" /> Live positions are off</li>
            {:else if data.positions === "down"}
              <li class="fp-tag fp-tag--warning"><TriangleAlert class="fp-ico fp-ico--sm" aria-hidden="true" /> Positions could not be read</li>
            {/if}
          </ul>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .mp-row { display: flex; align-items: center; gap: var(--space-1); }
  .mp-row > :global(.mc-pop__item) { flex: 1 1 auto; min-width: 0; }
  .mp-row > :global(.fp-ibtn) { flex: none; }
  .mp-row > :global(.fp-ibtn[aria-pressed="true"]) { background: var(--acc-soft); color: var(--acc-ink); }
  .mp-note { flex: 1 1 100%; max-width: 36rem; box-shadow: var(--shadow-pill); }
  .mp-url { width: 100%; min-width: 0; font-size: 12px; text-overflow: ellipsis; }
  .mp-status { align-self: center; display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
  .mp-status > :global(li) { height: 24px; box-shadow: var(--shadow-pill); background: var(--surface); border: 1px solid var(--line); }
  .mp-status > :global(li.fp-tag--warning) { background: var(--warning-soft); border-color: transparent; }
</style>
