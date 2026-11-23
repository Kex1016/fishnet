<script lang="ts">
  // The "Show on map" button of a player's profile header (FM-8, brief §5.1). A plain link, so it works without
  // JavaScript. When it cannot work it stays on the page, disabled, with the reason beside it (text, not a tooltip
  // alone, so touch and keyboard users read it too). Nothing at all for a hidden player (their profile is a 404).
  import type { ShowOnMap } from "./showOnMap.ts";
  let { state }: { state: ShowOnMap } = $props();
  const id = $props.id();
</script>

{#if state?.kind === "link"}
  <a class="ink c6" href={state.href}>Show on map</a>
{:else if state?.kind === "disabled"}
  <span class="som">
    <button type="button" class="ink" disabled aria-describedby={id}>Show on map</button>
    <span class="som__why" {id}>{state.reason}</span>
  </span>
{/if}

<style>
  .som { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .som__why { font-size: 12px; color: var(--ink-muted); }
</style>
