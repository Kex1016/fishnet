<script lang="ts">
  // Face + name as a link to the profile. Names are text: Svelte escapes them.
  import Face from "./Face.svelte";
  let { uuid, name, size = "sm", online }: { uuid: string; name: string; size?: "sm" | "md"; online?: boolean } = $props();
</script>

<a class="fp-player" href="/players/{encodeURIComponent(name)}">
  <Face {uuid} {name} {size} />
  <span class="t-truncate">{name}</span>
  {#if online}<span class="fp-dot fp-dot--on" title="Online"></span>{/if}
</a>

<style>
  .fp-player { display: inline-flex; align-items: center; gap: var(--space-2); color: inherit; min-width: 0; font-weight: 500; }
  .fp-player:hover { color: var(--acc-ink); text-decoration: none; }
</style>
