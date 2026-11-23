<script lang="ts">
  import { page } from "$app/state";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import PlayerName from "#lib/design/PlayerName.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import { BarList, Heatmap } from "#lib/charts/index.ts";
  import { MilestoneFeed } from "#lib/milestones/index.ts";
  import HiddenServersNote from "#lib/milestones/HiddenServersNote.svelte";
  import { dayGrid } from "#lib/milestones/helpers.ts";
  import { group } from "#lib/format/stat-display.ts";
  import { playerHref, playerRowLabel } from "#lib/players/names.ts";
  import { scopeLabel } from "#lib/servers.ts";
  import { withParams } from "#lib/url.ts";
  import { holdersHref, playerFeedHref } from "./holders.ts";
  import TypeSelect from "./TypeSelect.svelte";
  let { data } = $props();

  const scopeName = $derived(scopeLabel(data.scope, data.network.ok ? data.network.data.servers : []));
  const grid = $derived(dayGrid(data.perDay.days, data.perDay.since, Date.now()));
  const typeLabel = $derived(data.typeOptions.find((t) => t.key === data.type)?.label);
  const sub = $derived(`${scopeName}${typeLabel ? ` · ${typeLabel}` : ""}`);
  const b = $derived(data.board);
  const everyone = $derived(withParams(page.url, { player: null }));
  /** the player filter found nobody: the feed's own "nobody has done this yet" would be the wrong answer */
  const unknownPlayer = $derived(!!data.wanted && !data.player && !data.feed.ok && data.feed.kind === "not_found");
</script>

<PageHead path="~/milestones" cmd="tail" args="feed.log" title="milestones" lede="Every so often the network rings a little bell. This is where the bells are written down." note="Who was first to each threshold of a stat, newest first.">
  <form method="get" class="fx-filters" role="search" aria-label="Filter milestones">
    {#if data.scope !== "network"}<input type="hidden" name="scope" value={data.scope} />{/if}
    {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} />{/if}
    <TypeSelect options={data.typeOptions} value={data.type} />
    <label class="fx-search">
      <span class="c4" aria-hidden="true">»</span>
      <input type="search" name="player" value={data.wanted ?? ""} placeholder="player" aria-label="Milestones of one player" maxlength="64" autocomplete="off" />
    </label>
    <button class="ink c5" type="submit">filter</button>
  </form>
</PageHead>

<Heatmap
  title="Milestones per day"
  sub="{scopeName} · by week, UTC"
  since={data.perDay.since}
  rows={grid.rows}
  columns={grid.columns}
  cellLabel={(row, column) => `${row}, week of ${column}`}
  emptyTitle="No milestones recorded yet"
  emptyLine="The days fill in as the site records milestones."
/>

{#if data.player}
  <Window path="~/milestones" args="--player" tone="foam">
    <p class="who">
      <span class="c1">Milestones first reached by</span>
      <PlayerName uuid={data.player.uuid} name={data.player.name} />
      <a class="ink c5" href={playerHref(data.player)}>profile</a>
      <a class="ink flat" href={everyone}>show everyone</a>
    </p>
  </Window>
{/if}

<div class="fx-grid wide" style="align-items: start">
  <div class="fx-stack">
    {#if unknownPlayer}
      <Window path="~/milestones" args="--player">
        <WindowHead title="Feed" />
        <EmptyState title="No player called {data.wanted}" line={data.suggestions.length ? " The filter takes a whole name. These names contain it:" : " The filter takes a whole name, as it is written in the game."}>
          <p class="more">
            {#each data.suggestions as p (p.uuid)}<a class="chip" href={playerFeedHref(p, data.scope, data.type)}>{playerRowLabel(p)}</a>{/each}
            <a class="chip on" href={everyone}>Show everyone</a>
          </p>
        </EmptyState>
      </Window>
    {:else}
      <MilestoneFeed result={data.feed} title={data.player ? `${group(data.feed.ok ? data.feed.data.total : 0)} ${data.feed.ok && data.feed.data.total === 1 ? "milestone" : "milestones"}` : "Feed"} showPlayer={!data.player} limit={data.limit} />
      <HiddenServersNote scope={data.scope} />
      {#if data.feed.ok}<Pager url={page.url} total={data.feed.data.total} limit={data.limit} offset={data.offset} what="milestones" prev="newer" next="older" />{/if}
    {/if}
  </div>

  <div class="fx-stack">
    <BarList
      title="Most milestones"
      href={b.exact ? holdersHref(data.scope, data.type) : undefined}
      sub="{sub} · first to reach them"
      faces
      rows={b.rows.map((p, i) => ({ rank: i + 1, key: p.uuid, label: playerRowLabel(p), v: p.count, display: group(p.count), href: playerFeedHref(p, data.scope, data.type), uuid: p.uuid }))}
      highlight={data.player?.uuid}
      asOf={b.asOf ?? undefined}
      stale={b.stale}
      emptyTitle={b.ok ? "No milestones yet" : "Totals are not available"}
      emptyLine={b.ok ? "Players show up here once they are the first to reach a milestone." : "cakeutils could not be reached."}
    />
    {#if b.exact}
      {#if b.players > b.rows.length}
        <Notice kind="info"><a href={holdersHref(data.scope, data.type)}>All {group(b.players)} players with a milestone</a></Notice>
      {/if}
    {:else if b.ok && b.total > b.read}
      <Notice kind="info">Counted over the newest {group(b.read)} of {group(b.total)} milestones. Every player's full total appears once the site has read them all.</Notice>
    {/if}
  </div>
</div>

<style>
  .who { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin: 0; }
  .more { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 12px 0 0; }
  form.fx-filters :global(.seg) { background: var(--color-base); }
</style>
