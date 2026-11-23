<script lang="ts">
  // Face + name as a link to the profile. Names are text: Svelte escapes them.
  import Face from "./Face.svelte";
  import { playerHref, playerRowLabel } from "#lib/players/names.ts";
  let { uuid, name, size = "sm", online }: { uuid: string; name: string; size?: "sm" | "md"; online?: boolean } = $props();
  const label = $derived(playerRowLabel({ uuid, name }));
</script>

<a class="fx-player" href={playerHref({ uuid, name })}>
  <Face {uuid} name={label} {size} />
  <span class="who">{label}</span>
  {#if online}<span class="on" title="Online"><span class="visually-hidden">online</span></span>{/if}
</a>
