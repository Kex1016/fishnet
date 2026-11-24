<script lang="ts">
  import { page } from "$app/state";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import { BarList, Heatmap } from "#lib/charts/index.ts";
  import { AdvancementFeed, advHref, dayGrid } from "#lib/milestones/index.ts";
  import { group } from "#lib/format/stat-display.ts";
  import { playerHref, playerRowLabel } from "#lib/players/names.ts";
  import { scopeLabel } from "#lib/servers.ts";
  import { withParams } from "#lib/url.ts";
  import AdvancementItem from "#lib/milestones/AdvancementItem.svelte";
  import { advKey } from "#lib/milestones/advancements.ts";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Feed from "#lib/design/Feed.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  let { data } = $props();

  const scopeName = $derived(scopeLabel(data.scope, data.network.ok ? data.network.data.servers : []));
  const f = $derived(data.countedFrom);
  const grid = $derived(dayGrid(data.perDay.days, data.perDay.since, Date.now()));
</script>

<PageHead path="~/advancements" cmd="tail" args="firsts.log" title="advancements" lede="Someone always gets there first. The toast pops up, and the network remembers their name." note="Who completed each advancement first, per server and for the whole network, newest first.">
  <form method="get" class="fx-filters" role="search" aria-label="Find an advancement">
    {#if data.scope !== "network"}<input type="hidden" name="scope" value={data.scope} />{/if}
    {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} />{/if}
    <label class="fx-search">
      <span class="c4" aria-hidden="true">»</span>
      <input type="search" name="q" value={data.q} placeholder="find an advancement" aria-label="Find an advancement" maxlength="64" autocomplete="off" />
    </label>
    <button class="ink c5" type="submit">find</button>
    {#if data.q}<a class="ink c1" href={withParams(page.url, { q: null })}>clear</a>{/if}
  </form>
</PageHead>

{#if data.miniScope}
  <Notice kind="info">Advancements are kept per server and for the whole network, not per mini-server. Pick a server or the network above.</Notice>
{:else}
  <Heatmap
    title="Firsts per day"
    sub="{scopeName} · by week, UTC · imported completions on their own day"
    since={data.perDay.since}
    rows={grid.rows}
    columns={grid.columns}
    cellLabel={(row, column) => `${row}, week of ${column}`}
    emptyTitle="No firsts recorded yet"
    emptyLine="The days fill in as the site records advancement firsts."
  />

  <div class="fx-grid wide" style="align-items: start">
    <div class="fx-stack">
      {#if data.search}
        {@const sr = data.search.result}
        <Window path="~/advancements" args="--match {data.search.q}">
          <WindowHead title="Advancements matching “{data.search.q}”">
            {scopeName}{#if sr.ok}{" "}· {group(sr.data.total)} found{#if sr.stale}{" "}· <AsOf at={sr.asOf} stale />{/if}{/if}
          </WindowHead>
          {#if !sr.ok}
            <EmptyState title="Search is not available" line=" cakeutils could not be reached." />
          {:else if sr.data.total === 0}
            <EmptyState title="No advancement matches" line=" Only advancements someone has completed are listed. Titles and ids match on any part, so a word is enough." />
          {:else}
            <Feed label="Advancements matching {data.search.q}">
              {#each sr.data.milestones as m (advKey(m))}
                <AdvancementItem {m} serverNames={data.serverNames} showServer={data.scope === "network"} />
              {/each}
            </Feed>
          {/if}
        </Window>
        {#if sr.ok && sr.data.total > 0}<Pager url={page.url} total={sr.data.total} limit={data.limit} offset={data.offset} what="advancements" />{/if}
        {#if sr.ok && f.total > data.search.searched}<Notice kind="info">Searched the newest {group(data.search.searched)} of {group(f.total)} advancements.</Notice>{/if}
      {:else}
        <AdvancementFeed result={data.feed} title="Feed" limit={data.limit} serverNames={data.serverNames} showServer={data.scope === "network"} />
        {#if data.feed.ok}<Pager url={page.url} total={data.feed.data.total} limit={data.limit} offset={data.offset} what="advancements" prev="newer" next="older" />{/if}
      {/if}
    </div>

    <div class="fx-stack">
      <BarList
        title="Most firsts"
        sub="{scopeName} · advancements completed before anyone else"
        faces
        rows={data.firsts.map((p, i) => ({ rank: i + 1, key: p.uuid, label: playerRowLabel(p), v: p.count, display: group(p.count), href: playerHref(p), uuid: p.uuid }))}
        asOf={f.asOf ?? undefined}
        stale={f.stale}
        emptyTitle={f.ok ? "No firsts yet" : "Firsts are not available"}
        emptyLine={f.ok ? "Players show up here once they are the first to complete an advancement." : "cakeutils could not be reached."}
      />
      <BarList
        title="Most completed"
        sub="{scopeName} · players who have it"
        rows={data.completed.map((a, i) => ({ rank: i + 1, key: a.advancement, label: a.title, v: a.earners, display: group(a.earners), href: advHref(a.advancement) }))}
        asOf={f.asOf ?? undefined}
        stale={f.stale}
        emptyTitle={f.ok ? "No advancements yet" : "Advancements are not available"}
        emptyLine={f.ok ? "Advancements show up here once a player completes one." : "cakeutils could not be reached."}
      />
      {#if f.ok && f.total > f.read}
        <Notice kind="info">Counted over the newest {group(f.read)} of {group(f.total)} advancements.</Notice>
      {/if}
    </div>
  </div>
{/if}

<style>
  .fx-filters :global(.seg) { background: var(--color-base); }
</style>
