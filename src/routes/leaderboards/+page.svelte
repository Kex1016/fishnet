<script lang="ts">
  import { page } from "$app/state";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import Stub from "#lib/design/Stub.svelte";
  import { BarList, ViewSwitch, viewParam } from "#lib/charts/index.ts";
  import { boardHref } from "#lib/api/metric.ts";
  let { data } = $props();
  const view = $derived(viewParam(page.url));
</script>

<div class="fp-page">
  <header class="fp-hero">
    <h1 class="t-display">Leaderboards</h1>
    <p class="fp-lede">Playtime and the featured boards. A board appears once someone has recorded its stat.</p>
    <Stub unit="W6" what="this page" />
  </header>
  <div class="fp-filters">
    {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} />{/if}
    <span style="margin-left: auto"><ViewSwitch url={page.url} {view} /></span>
  </div>
  <div class="fp-panels">
    {#each data.featured as b (b.id)}
      {#if b.result.ok}
        <BarList
          title={b.label}
          href={boardHref(b.metric, data.scope)}
          sub="{data.scope} · top 10 of {b.result.data.total}"
          {view}
          faces
          unit={b.result.data.unit}
          asOf={b.result.asOf}
          stale={b.result.stale}
          emptyTitle="No one has played here yet"
          rows={b.result.data.entries.map((e) => ({ rank: e.rank, key: e.uuid, uuid: e.uuid, label: e.name, v: e.value, display: e.display, href: `/players/${encodeURIComponent(e.name)}` }))}
        />
      {/if}
    {/each}
  </div>
</div>
