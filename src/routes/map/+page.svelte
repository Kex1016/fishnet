<script lang="ts">
  // /map (FM-4): the servers that share a map. With one, the page redirects to its map, so this list is for two or more.
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import { mapHref } from "#lib/map/links.ts";
  import { Map as MapIcon, Radio } from "@lucide/svelte";
  let { data } = $props();
  const r = $derived(data.servers);
</script>

<div class="fp-page">
  <header class="fp-hero">
    <span class="t-kicker">Maps</span>
    <h1 class="t-display">Map</h1>
    <p class="fp-lede">The worlds of the network from above, with who is where right now.</p>
  </header>

  {#if !r.ok && r.kind === "off"}
    <EmptyState icon={MapIcon} title="There is no map on this network" line="Maps show up here once a server shares one." />
  {:else if !r.ok}
    <Notice kind="warning"><b>cakeutils could not be reached.</b> The maps will be back when it is.</Notice>
  {:else}
    {#if r.stale}<Notice kind="warning"><b>cakeutils could not be reached.</b> This is the last list it gave, <AsOf at={r.asOf} stale />.</Notice>{/if}
    {#if data.list.length === 0}
      <EmptyState icon={MapIcon} title="No server has a map yet" line="A server's map shows up here as soon as it shares one." />
    {:else}
      <div class="fp-section__head">
        <p class="t-small t-muted"><span class="t-num">{data.list.length}</span> servers with a map</p>
        {#if !r.stale}<AsOf at={r.asOf} />{/if}
      </div>
      <ul class="fp-panels maps">
        {#each data.list as s (s.server)}
          <li class="fp-panel">
            <h2 class="t-title-3"><a href={mapHref(s.server)}>{s.display_name}</a></h2>
            <p class="t-small t-muted">{s.worlds.map((w) => w.name).join(", ")}</p>
            <p class="maps__tags">
              {#if !s.online}<span class="fp-tag fp-tag--warning">map offline</span>{/if}
              {#if s.live_players}<span class="fp-tag fp-tag--success"><Radio class="fp-ico fp-ico--sm" strokeWidth={1.6} /> live positions</span>{:else}<span class="fp-tag">no live positions</span>{/if}
            </p>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  ul { list-style: none; margin: 0; padding: 0; }
  .maps__tags { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-3); }
  .maps__tags :global(.fp-tag) { display: inline-flex; align-items: center; gap: var(--space-1); }
</style>
