<script lang="ts">
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Stub from "#lib/design/Stub.svelte";
  import { mapHref } from "#lib/map/links.ts";
  import { Map as MapIcon } from "@lucide/svelte";
  let { data } = $props();
  const r = $derived(data.servers);
</script>

<div class="fp-page">
  <header class="fp-hero">
    <h1 class="t-display">Map</h1>
    <p class="fp-lede">The worlds of the network from above, with who is where right now.</p>
  </header>
  <Stub unit="FM-4" what="the map page" />

  {#if !r.ok && r.kind === "off"}
    <EmptyState icon={MapIcon} title="There is no map on this network" line="Maps show up here once a server shares one." />
  {:else if !r.ok}
    <Notice kind="warning"><b>cakeutils could not be reached.</b> The maps will be back when it is.</Notice>
  {:else if r.data.servers.length === 0}
    <EmptyState icon={MapIcon} title="No server has a map yet" line="A server's map shows up here as soon as it shares one." />
  {:else}
    <div class="fp-section__head">
      <p class="t-small t-muted"><span class="t-num">{r.data.servers.length}</span> server{r.data.servers.length === 1 ? "" : "s"} with a map</p>
      <AsOf at={r.asOf} stale={r.stale} />
    </div>
    <ul class="fp-panels">
      {#each r.data.servers as s (s.server)}
        <li class="fp-panel">
          <h2 class="t-title-3"><a href={mapHref(s.server)}>{s.display_name}</a></h2>
          <p class="t-small t-muted">{s.worlds.map((w) => w.name).join(", ")}</p>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  ul { list-style: none; margin: 0; padding: 0; }
</style>
