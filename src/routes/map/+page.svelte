<script lang="ts">
  // /map (FM-4): the servers that share a map. With one, the page redirects to its map, so this list is for two or more.
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import { mapHref } from "#lib/map/links.ts";
  let { data } = $props();
  const r = $derived(data.servers);
</script>

<PageHead cmd="ls" args="~/map" title="map" lede="The worlds of the network from above, with who is where right now." />

{#if !r.ok && r.kind === "off"}
  <Window path="~/map" args="ls">
    <EmptyState title="There is no map on this network" line="Maps show up here once a server shares one." />
  </Window>
{:else if !r.ok}
  <Notice kind="warning">cakeutils could not be reached. The maps will be back when it is.</Notice>
{:else}
  {#if r.stale}<Notice kind="warning">cakeutils could not be reached. This is the last list it gave, <AsOf at={r.asOf} stale />.</Notice>{/if}
  {#if data.list.length === 0}
    <Window path="~/map" args="ls">
      <EmptyState title="No server has a map yet" line="A server's map shows up here as soon as it shares one." />
    </Window>
  {:else}
    <Window path="~/map" args="ls">
      <WindowHead title="Servers with a map">
        {#if !r.stale}<AsOf at={r.asOf} />{/if}
      </WindowHead>
      <div class="list maps">
        {#each data.list as s (s.server)}
          <a class="li" href={mapHref(s.server)}>
            <span class="mk">»</span>
            <span class="grow">
              <span class="maps__name">{s.display_name}</span>
              <span class="maps__worlds">{s.worlds.map((w) => w.name).join(", ")}</span>
            </span>
            <span class="meta maps__tags">
              {#if !s.online}<span class="chip maps__off">map offline</span>{/if}
              {#if s.live_players}<span class="chip on">live positions</span>{:else}<span class="chip">no live positions</span>{/if}
            </span>
          </a>
        {/each}
      </div>
    </Window>
  {/if}
{/if}

<style>
  .maps :global(.li) { align-items: flex-start; padding: 8px; }
  .maps :global(.li:hover) { background: var(--color-overlay); }
  .maps :global(.li:hover > .mk) { color: var(--color-rose); }
  .maps__name { display: block; color: var(--color-foam); }
  .maps__worlds { display: block; margin-top: 2px; font-size: 12px; color: var(--color-subtle); white-space: normal; }
  .maps__tags { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
  .maps__off { border-color: var(--color-gold); color: var(--color-gold); }
  @media (max-width: 720px) {
    .maps :global(.li) { flex-wrap: wrap; }
    .maps__tags { flex-basis: 100%; justify-content: flex-start; padding-left: calc(1ch + 12px); }
  }
</style>
