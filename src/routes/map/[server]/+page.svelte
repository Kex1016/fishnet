<script lang="ts">
  import Notice from "#lib/design/Notice.svelte";
  import Stub from "#lib/design/Stub.svelte";
  let { data } = $props();
</script>

<div class="fp-page">
  <header class="fp-hero">
    <h1 class="t-display">{data.entry?.display_name ?? data.server}</h1>
  </header>
  <Stub unit="FM-4" what="the server's map" />
  {#if data.down}
    <Notice kind="warning"><b>cakeutils could not be reached.</b> The map will be back when it is.</Notice>
  {:else if data.entry}
    <p class="t-small t-muted">Worlds: {data.entry.worlds.map((w) => w.name).join(", ")}</p>
  {/if}
</div>
