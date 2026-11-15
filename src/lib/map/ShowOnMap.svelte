<script lang="ts">
  // The "Show on map" button of a player's profile header (FM-8, brief §5.1). A plain link, so it works without
  // JavaScript. When it cannot work it stays on the page, disabled, with the reason beside it (text, not a tooltip
  // alone, so touch and keyboard users read it too). Nothing at all for a hidden player (their profile is a 404).
  import { MapPin } from "@lucide/svelte";
  import type { ShowOnMap } from "./showOnMap.ts";
  let { state }: { state: ShowOnMap } = $props();
  const id = $props.id();
</script>

{#if state?.kind === "link"}
  <a class="fp-btn" href={state.href}><MapPin class="fp-ico fp-ico--sm" aria-hidden="true" /> Show on map</a>
{:else if state?.kind === "disabled"}
  <span class="som">
    <button type="button" class="fp-btn" disabled aria-describedby={id}><MapPin class="fp-ico fp-ico--sm" aria-hidden="true" /> Show on map</button>
    <span class="t-caption t-muted" {id}>{state.reason}</span>
  </span>
{/if}

<style>
  .som { display: inline-flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
</style>
