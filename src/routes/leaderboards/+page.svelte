<script lang="ts">
  import { page } from "$app/state";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import RankList from "#lib/design/RankList.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import { group } from "#lib/format/stat-display.ts";
  import { rankRows } from "#lib/boards.ts";
  let { data } = $props();
</script>

<PageHead
  path="~/leaderboards"
  cmd="sort"
  args="-r --top 10"
  title="leaderboards"
  lede="Who is ahead, and by how much."
  note="Playtime and the featured boards, top ten each. A board appears once someone has recorded its stat. Any other stat is in the catalogue."
>
  <div class="fx-filters">
    {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} minis={data.minis} />{/if}
    <form action="/stats" method="get" role="search" style="display: contents">
      <label class="fx-search"><span class="c4">»</span><input type="search" name="q" placeholder="find any stat" aria-label="Find any stat" maxlength="64" autocomplete="off" /></label>
    </form>
    <a class="ink c5" href="/stats">catalogue</a>
  </div>
</PageHead>

{#if data.allDown}
  <Notice kind="warning"><b>cakeutils could not be reached.</b> The boards will be back when it is.</Notice>
{:else}
  <div class="fx-grid">
    {#each data.cards as b (b.id)}
      {@const r = b.result}
      <Window path="~/leaderboards/{b.id}" args={data.scope === "network" ? undefined : `--scope ${data.scope}`} tag="section" label={b.label}>
        {#if r.ok}
          <WindowHead title={b.label} href={b.href} level={2}>
            {#if r.stale}<AsOf at={r.asOf} stale />{:else if r.data.entries.length}<span class="num">top {r.data.entries.length} of {group(r.data.total)}</span>{/if}
          </WindowHead>
          {#if r.data.entries.length === 0}
            <EmptyState
              title={b.id === "playtime" ? "No one has played here yet" : "No one has recorded this here yet"}
              line={data.scope === "network" ? "Boards fill in as people play." : `Nothing recorded in ${data.scopeName} so far.`}
            />
          {:else}
            <RankList rows={rankRows(r.data.entries, { limit: 10 })} label="{b.label} in {data.scopeName}" />
          {/if}
        {:else}
          <WindowHead title={b.label} href={b.href} level={2} />
          <Notice kind="warning"><b>{b.label}</b> could not be loaded right now.</Notice>
        {/if}
      </Window>
    {/each}
  </div>
  {#if data.noStatBoards}
    <EmptyState title="No stat boards yet" line="They show up here as soon as someone records blocks mined, kills, deaths and the like." />
  {/if}
{/if}
