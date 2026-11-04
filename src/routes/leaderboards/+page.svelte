<script lang="ts">
  import { page } from "$app/state";
  import { Search } from "@lucide/svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import { BarList, ViewSwitch, viewParam } from "#lib/charts/index.ts";
  import { barRows } from "./board.ts";
  let { data } = $props();
  const view = $derived(viewParam(page.url));
</script>

<div class="fp-page">
  <header class="fp-hero">
    <h1 class="t-display">Leaderboards</h1>
    <p class="fp-lede">Playtime and the featured boards, top ten each. A board appears once someone has recorded its stat. Any other stat is in the <a href="/stats">catalogue</a>.</p>
  </header>

  <div class="fp-filters">
    {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} minis={data.minis} />{/if}
    <form action="/stats" method="get" role="search" style="display: contents">
      <label class="fp-field fp-search" style="margin-left: auto">
        <Search class="fp-ico fp-ico--sm" strokeWidth={1.4} />
        <input type="search" name="q" placeholder="Find any stat" aria-label="Find any stat" maxlength="64" autocomplete="off" />
      </label>
    </form>
    <ViewSwitch url={page.url} {view} />
  </div>

  {#if data.allDown}
    <Notice kind="warning"><b>cakeutils could not be reached.</b> The boards will be back when it is.</Notice>
  {:else}
    <div class="fp-panels">
      {#each data.cards as b (b.id)}
        {#if b.result.ok}
          <BarList
            title={b.label}
            href={b.href}
            sub="{data.scopeName} · top {Math.min(10, b.result.data.entries.length || 10)} of {b.result.data.total}"
            {view}
            faces
            unit={b.result.data.unit}
            asOf={b.result.asOf}
            stale={b.result.stale}
            emptyTitle={b.id === "playtime" ? "No one has played here yet" : "No one has recorded this here yet"}
            emptyLine={data.scope === "network" ? "Boards fill in as people play." : `Nothing recorded in ${data.scopeName} so far.`}
            rows={barRows(b.result.data.entries)}
          />
        {:else}
          <Notice kind="warning"><b>{b.label}</b> could not be loaded right now.</Notice>
        {/if}
      {/each}
    </div>
    {#if data.noStatBoards}
      <EmptyState title="No stat boards yet" line="They show up here as soon as someone records blocks mined, kills, deaths and the like." />
    {/if}
  {/if}
</div>
