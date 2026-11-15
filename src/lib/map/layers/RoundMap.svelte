<script lang="ts">
  // A finished One Soul round on its tiles (FM-5, brief §6). The map fills its frame; the worlds, rounds and
  // layers are popouts over it (David, 15 Nov 2026). Marks and trails are drawn by MapCanvas at the raw block
  // coordinates the API gave, one dimension at a time (only the world shown). `stage` fills the content area beside
  // the nav; `card` is the same map in a frame of its own inside a page (the round's page).
  import { Globe, CalendarDays, Table2, Maximize2 } from "@lucide/svelte";
  import MapCanvas from "../MapCanvas.svelte";
  import MapPopout from "../MapPopout.svelte";
  import type { DimMap } from "#lib/onesoul/map.ts";
  import type { MapWorldView } from "../types.ts";
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
  };
  let { world, map, worlds, rounds = [], cycle, tableHref, openHref, mode = "stage" }: Props = $props();

  let on = $state<Record<string, boolean>>({});
  const layers = $derived(roundLayers(map, on));
  const toggle = (id: string) => (on[id] = !(on[id] ?? true));
  const label = $derived(`Map of round ${cycle}, ${world.name}`);
</script>

<div class="mc-stage rm-{mode}">
  <h2 class="visually-hidden">{label}</h2>
  {#key `${world.cycle}/${world.id}`}
    <MapCanvas {world} players={[]} glideMs={0} {layers} {label} />
  {/key}
  <div class="mc-over">
    <div class="mc-over__row">
      {#if worlds.length > 1}
        <MapPopout label="Worlds" value={world.name} icon={Globe}>
          <div class="mc-pop__list">
            {#each worlds as w (w.id)}
              <a class="mc-pop__item" href={w.href} aria-current={w.id === world.id ? "page" : undefined}><span class="mc-pop__grow">{w.label}</span></a>
            {/each}
          </div>
        </MapPopout>
      {/if}
      {#if rounds.length > 1}
        <MapPopout label="Rounds" value="Round {cycle}" icon={CalendarDays}>
          <div class="mc-pop__list">
            {#each rounds as r (r.cycle)}
              <a class="mc-pop__item" href={r.href} aria-current={r.cycle === cycle ? "page" : undefined}><span class="mc-pop__grow">Round {r.cycle}</span></a>
            {/each}
          </div>
        </MapPopout>
      {/if}
      <LayersPopout {layers} ontoggle={toggle} hint="Marks sit on the block they were recorded at." />
      {#if tableHref}<a class="fp-chip rm-chip" href={tableHref}><Table2 class="fp-ico fp-ico--sm" strokeWidth={1.6} /><span>Table view</span></a>{/if}
      {#if openHref}<a class="fp-chip rm-chip" href={openHref}><Maximize2 class="fp-ico fp-ico--sm" strokeWidth={1.6} /><span>Open the map</span></a>{/if}
    </div>
  </div>
</div>

<style>
  .rm-chip { color: var(--text); box-shadow: var(--shadow-float); text-decoration: none; }
  /* under the One Soul header and tabs the stage takes the rest of the content area, down to its edge (the
     One Soul layout makes its frame a column for this; a guessed header height left a strip under the map) */
  .rm-stage { flex: 1 1 0; height: auto; min-height: 420px; }
  .rm-card { height: clamp(320px, 52vh, 480px); border: 1px solid var(--line); border-radius: var(--radius-xl); }
</style>
