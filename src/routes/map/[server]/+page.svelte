<script lang="ts">
  // One server's map (FM-4), full bleed (David, 15 Nov 2026): the map fills the whole area beside the site nav and
  // everything else floats over it: popouts for the worlds (and the other servers), the players and the share link,
  // a status line when something is off, and hover popups on the dots (MapCanvas). The popouts are <details>, so the
  // world and player lists work without JavaScript; the server renders the map as a still picture of the same view.
  // Live: an EventSource on /map/<server>/live with a players.json poll as the fallback (liveClient.ts).
  // The share link (?world=&x=&z=&zoom=) follows the view, so the address bar is always a link to what you see.
  // ?follow= from other pages (FM-8) fills `follow` from data.link.
  import { onMount, untrack } from "svelte";
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import MapCanvas from "#lib/map/MapCanvas.svelte";
  import WorldPicker from "#lib/map/WorldPicker.svelte";
  import MapPopout from "#lib/map/MapPopout.svelte";
  import { readout } from "#lib/map/crs.ts";
  import { connectLive } from "#lib/map/liveClient.ts";
  import { mapHref } from "#lib/map/links.ts";
  import { groupPlayers } from "#lib/map/pages.ts";
  import type { LiveState, MapView, PlayerDot, TilesEvent } from "#lib/map/types.ts";
  import { asOf } from "#lib/format/dates.ts";
  import { Check, Copy, Crosshair, Globe, Link2, Map as MapIcon, Radio, TriangleAlert, Users } from "@lucide/svelte";
  let { data } = $props();

  let players = $state<PlayerDot[]>(untrack(() => data.players));
  let follow = $state<string | null>(null);
  let at = $state<MapView | null>(null);
  let liveState = $state<LiveState>("live");
  let liveAt = $state<number | null>(null);
  let canvas = $state<ReturnType<typeof MapCanvas> | null>(null);
  let mounted = $state(false);
  let copied = $state(false);

  const v = $derived(data.view);
  const groups = $derived(v ? groupPlayers(players, v.id) : { here: [], elsewhere: [] });
  const worldName = $derived(new Map<string, string>(data.worlds.map((w: { id: string; name: string }) => [w.id, w.name])));

  // a navigation (another world or server) brings a new snapshot; the live feed reconnects below
  let shownServer = untrack(() => data.server);
  $effect(() => {
    players = data.players;
    at = null;
    liveState = "live";
    liveAt = null;
    if (data.server !== shownServer) {
      shownServer = data.server;
      follow = null;
    }
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
      onStatus: (s, t) => {
        liveState = s;
        liveAt = t;
      }
    });
    return () => conn.close();
  });

  // the share link: the view as the address bar
  const here = $derived(v && at ? mapHref(v.server, { world: v.id, x: at.x, z: at.z, zoom: at.zoom, follow }) : v ? mapHref(v.server, { world: v.id }) : "");
  const absolute = $derived(here ? page.url.origin + here : "");
  $effect(() => {
    const to = at ? here : null;
    if (!to) return;
    const t = setTimeout(() => {
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
        <!-- layers of the live map (none yet; FM-5's LayersPopout serves finished rounds) join this row -->
        <MapPopout label="Share" icon={Link2}>
          <span class="mc-pop__line">This link opens the map as you see it now.</span>
          <input class="fp-field mp-url t-mono" type="text" readonly value={absolute} aria-label="Link to this view" onfocus={(e) => e.currentTarget.select()} />
          {#if mounted}
            <button type="button" class="fp-btn" onclick={copy}>
              {#if copied}<Check class="fp-ico fp-ico--sm" aria-hidden="true" /> Copied{:else}<Copy class="fp-ico fp-ico--sm" aria-hidden="true" /> Copy link{/if}
            </button>
          {/if}
        </MapPopout>
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
  .mp-url { width: 100%; min-width: 0; font-size: 12px; text-overflow: ellipsis; }
  .mp-status { align-self: center; display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
  .mp-status > :global(li) { height: 24px; box-shadow: var(--shadow-pill); background: var(--surface); border: 1px solid var(--line); }
  .mp-status > :global(li.fp-tag--warning) { background: var(--warning-soft); border-color: transparent; }
</style>
