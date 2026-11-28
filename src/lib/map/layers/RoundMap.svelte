<script lang="ts">
  // A One Soul round on its tiles (FM-5, brief §6; TH-31: the round in play too, design §8.1). The map fills its frame;
  // the worlds, rounds and layers are popouts over it (David, 15 Nov 2026). Marks and trails are drawn by MapCanvas at
  // the raw block coordinates the API gave, one dimension at a time (only the world shown). `stage` fills the content
  // area beside the nav; `card` is the same map in a frame of its own inside a page (the round's page, a soul's turn).
  // With `liveHref` (the round in play) the living soul's dot is polled from the site while the page is visible.
  import { onMount } from "svelte";
  import MapCanvas from "../MapCanvas.svelte";
  import MapPopout from "../MapPopout.svelte";
  import type { DimMap } from "#lib/onesoul/map.ts";
  import type { MapWorldView, PlayerDot } from "../types.ts";
  import LayersPopout from "./LayersPopout.svelte";
  import { roundLayers } from "./onesoul.ts";

  type Props = {
    world: MapWorldView;
    /** the layers of the dimension this world shows (undefined: nothing marked) */
    map: DimMap | undefined;
    worlds: { id: string; label: string; href: string }[];
    /** the round switcher (stage only) */
    rounds?: { cycle: number; href: string }[];
    cycle: number;
    /** the table twin of the map */
    tableHref?: string;
    /** a link to the full-size map (card only) */
    openHref?: string;
    mode?: "stage" | "card";
    /** the round in play: where the living soul's position is polled (/one-soul/map/live.json) */
    liveHref?: string | null;
  };
  let { world, map, worlds, rounds = [], cycle, tableHref, openHref, mode = "stage", liveHref = null }: Props = $props();

  /** round-live.server.ts LIVE_POLL_MS (a server module cannot be imported here) */
  const POLL_MS = 3_000;
  let players = $state<PlayerDot[]>([]);
  /** an answer has come (the server render does not know yet) */
  let polled = $state(false);
  const soul = $derived(players[0] ?? null);
  const soulWorld = $derived(soul && soul.world !== world.id ? (worlds.find((w) => w.id === soul.world) ?? null) : null);

  onMount(() => {
    if (!liveHref) return;
    const href = liveHref;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (stop) return;
      if (!document.hidden) {
        try {
          const r = await fetch(href, { headers: { accept: "application/json" } });
          const j = r.ok ? await r.json() : null;
          // the site's answer is the soul or nobody; anything that is not a well-formed dot is not drawn
          const list: unknown[] = j && j.cycle === cycle && Array.isArray(j.players) ? j.players : [];
          players = list.filter(isDot).slice(0, 1);
          polled = true;
        } catch {
          // offline for a moment: keep the last dot, the next poll decides
        }
      }
      if (!stop) timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  });

  function isDot(p: unknown): p is PlayerDot {
    const d = p as PlayerDot;
    return !!d && typeof d.uuid === "string" && typeof d.name === "string" && typeof d.world === "string" && [d.x, d.z, d.yaw].every((v) => typeof v === "number" && Number.isFinite(v));
  }

  let on = $state<Record<string, boolean>>({});
  const layers = $derived(roundLayers(map, on));
  const toggle = (id: string) => (on[id] = !(on[id] ?? true));
  const label = $derived(`Map of round ${cycle}, ${world.name}`);
</script>

<div class="mc-stage rm-{mode}">
  <h2 class="visually-hidden">{label}</h2>
  {#key `${world.cycle}/${world.id}`}
    <MapCanvas {world} {players} glideMs={liveHref ? POLL_MS : 0} {layers} {label} />
  {/key}
  <div class="mc-over">
    <div class="mc-over__row">
      <section class="mc-bar window" aria-label={label}>
        <span class="section-header" aria-hidden="true">fish: <b>~/round/{cycle}</b></span>
        <div class="mc-bar__row">
          {#if worlds.length > 1}
            <MapPopout label="Worlds" value={world.name} path="~/round/{cycle}" cmd="ls">
              <div class="mc-pop__list">
                {#each worlds as w (w.id)}
                  <a class="mc-pop__item" href={w.href} aria-current={w.id === world.id ? "page" : undefined}><span class="mc-pop__grow">{w.label}</span></a>
                {/each}
              </div>
            </MapPopout>
          {/if}
          {#if rounds.length > 1}
            <MapPopout label="Rounds" value="round {cycle}" path="~/round/{cycle}" cmd="rounds">
              <div class="mc-pop__list">
                {#each rounds as r (r.cycle)}
                  <a class="mc-pop__item" href={r.href} aria-current={r.cycle === cycle ? "page" : undefined}><span class="mc-pop__grow">Round {r.cycle}</span></a>
                {/each}
              </div>
            </MapPopout>
          {/if}
          <LayersPopout {layers} ontoggle={toggle} hint={liveHref ? "Marks sit on the block they were recorded at. The trail and the dot follow the living soul." : "Marks sit on the block they were recorded at."} path="~/round/{cycle}" />
          {#if liveHref}
            <span class="rm-live" aria-live="polite">
              {#if !soul}{polled ? "The living soul is not online." : "Looking for the living soul."}{:else if soulWorld}{soul.name} is in <a href={soulWorld.href}>{soulWorld.label}</a>.{:else if soul.world === world.id}{soul.name} is here, live.{:else}{soul.name} is in another world.{/if}
            </span>
          {/if}
          {#if tableHref}<a href={tableHref}>table view</a>{/if}
          {#if openHref}<a href={openHref}>open the map</a>{/if}
        </div>
      </section>
    </div>
  </div>
</div>

<style>
  /* under the One Soul header and tabs the stage takes the rest of the content area, down to its edge (the
     One Soul layout makes its frame a column for this; a guessed header height left a strip under the map) */
  .rm-stage { flex: 1 1 0; height: auto; min-height: 420px; }
  /* in a card the windows must fit the card: the stage's overflow would cut them */
  .rm-card :global(.mc-pop__panel.window) { max-height: 200px; }
  .rm-card { height: clamp(320px, 52vh, 480px); border: var(--border-window) double var(--color-pine); }
  .rm-live { color: var(--color-subtle); }
  /* the landmarks of design §8.1, their own glyphs over the layer's shape (never colour alone): a portal frame and
     the End portal's light pillar, on the map and beside the toggle */
  :global([data-layer="portals"] .mc-mark__glyph) { width: 9px; height: 13px; background: transparent; box-shadow: inset 0 0 0 2px var(--color-iris); outline: 2px solid var(--color-base); clip-path: none; filter: none; }
  :global([data-layer="end-portals"] .mc-mark__glyph) {
    width: 12px; height: 18px; background: var(--color-gold); outline: 0;
    clip-path: polygon(35% 0, 65% 0, 65% 70%, 100% 70%, 100% 100%, 0 100%, 0 70%, 35% 70%);
    filter: drop-shadow(1px 0 0 var(--color-base)) drop-shadow(-1px 0 0 var(--color-base)) drop-shadow(0 1px 0 var(--color-base)) drop-shadow(0 -1px 0 var(--color-base));
  }
</style>
