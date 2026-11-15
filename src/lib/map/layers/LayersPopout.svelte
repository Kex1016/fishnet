<script lang="ts">
  // The layers popout (FM-5; David, 15 Nov 2026: controls are popouts over the map). One button per layer, each
  // with its mark's own shape beside the name (never colour alone) and `aria-pressed`; a <details> underneath, so
  // Tab, Enter/Space and Escape work with nothing added. The count is what the layer draws in this world.
  import { Layers } from "@lucide/svelte";
  import MapPopout from "../MapPopout.svelte";
  import type { MapLayer } from "../types.ts";
  import { layerCount } from "./onesoul.ts";

  let { layers, ontoggle, hint }: { layers: MapLayer[]; ontoggle: (id: string) => void; hint?: string } = $props();
  const shown = $derived(layers.filter((l) => l.on).length);
</script>

<MapPopout label="Layers" count={layers.length ? shown : undefined} icon={Layers}>
  {#if layers.length === 0}
    <span class="mc-pop__line">Nothing is marked in this world.</span>
  {:else}
    <div class="mc-pop__list">
      {#each layers as l (l.id)}
        <button type="button" class="mc-pop__item" data-layer={l.id} aria-pressed={l.on} onclick={() => ontoggle(l.id)}>
          <span class="mc-pop__shape mc-mark lp-shape" data-shape={l.shape} aria-hidden="true"><span class="mc-mark__glyph"></span></span>
          <span class="mc-pop__grow">{l.label}</span>
          <span class="mc-pop__note">{layerCount(l)} · {l.on ? "on" : "off"}</span>
        </button>
      {/each}
    </div>
    {#if hint}<span class="mc-pop__line">{hint}</span>{/if}
  {/if}
</MapPopout>

<style>
  .lp-shape { position: relative; left: 0; top: 0; pointer-events: none; }
  .lp-shape[data-shape="line"] :global(.mc-mark__glyph) { width: 16px; height: 3px; border-radius: 2px; box-shadow: none; background: var(--acc-viz); }
</style>
