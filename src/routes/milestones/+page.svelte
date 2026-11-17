<script lang="ts">
  import { page } from "$app/state";
  import { Search, UserX } from "@lucide/svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import PlayerName from "#lib/design/PlayerName.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
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

<div class="fp-page">
  <header class="fp-hero">
    <h1 class="t-display">Milestones</h1>
    <p class="fp-lede">Who was first to each threshold of a stat, newest first.</p>
  </header>

  <div class="fp-ms-bar">
    {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} />{/if}
    <form method="get" class="fp-ms-filter" role="search" aria-label="Filter milestones">
      {#if data.scope !== "network"}<input type="hidden" name="scope" value={data.scope} />{/if}
      <TypeSelect options={data.typeOptions} value={data.type} />
      <label class="fp-field fp-search">
        <Search class="fp-ico fp-ico--sm" strokeWidth={1.4} />
        <input type="search" name="player" value={data.wanted ?? ""} placeholder="Player name" aria-label="Milestones of one player" maxlength="64" autocomplete="off" />
      </label>
      <button class="fp-btn" type="submit">Filter</button>
    </form>
  </div>

  {#if data.player}
    <p class="fp-ms-who">
      <span class="t-muted">Milestones first reached by</span>
      <PlayerName uuid={data.player.uuid} name={data.player.name} />
      <span class="fp-chips">
        <a class="fp-chip" href={playerHref(data.player)}>Profile</a>
        <a class="fp-chip" href={everyone}>Show everyone</a>
      </span>
    </p>
  {/if}

  <div class="fp-two">
    <div class="fp-ms-feed">
      {#if unknownPlayer}
        <section class="fp-section">
          <div class="fp-section__head"><h2 class="t-title-3">Feed</h2></div>
          <EmptyState icon={UserX} title="No player called {data.wanted}" line={data.suggestions.length ? "The filter takes a whole name. These names contain it:" : "The filter takes a whole name, as it is written in the game."}>
            <p class="fp-chips fp-ms-suggest">
              {#each data.suggestions as p (p.uuid)}<a class="fp-chip" href={playerFeedHref(p, data.scope, data.type)}>{playerRowLabel(p)}</a>{/each}
              <a class="fp-chip" href={everyone}>Show everyone</a>
            </p>
          </EmptyState>
        </section>
      {:else}
        <MilestoneFeed result={data.feed} title={data.player ? `${group(data.feed.ok ? data.feed.data.total : 0)} ${data.feed.ok && data.feed.data.total === 1 ? "milestone" : "milestones"}` : "Feed"} showPlayer={!data.player} limit={data.limit} />
        <HiddenServersNote scope={data.scope} />
        {#if data.feed.ok}<Pager url={page.url} total={data.feed.data.total} limit={data.limit} offset={data.offset} what="milestones" />{/if}
      {/if}
    </div>

    <div class="fp-ms-side">
      <div class="fp-ms-board">
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
            <p class="t-caption fp-ms-note"><a href={holdersHref(data.scope, data.type)}>All {group(b.players)} players with a milestone</a></p>
          {/if}
        {:else if b.ok && b.total > b.read}
          <p class="t-caption fp-ms-note">Counted over the newest {group(b.read)} of {group(b.total)} milestones. Every player's full total appears once the site has read them all.</p>
        {/if}
      </div>
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
    </div>
  </div>
</div>

<style>
  .fp-ms-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3) var(--space-4); }
  .fp-ms-filter { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
  .fp-ms-who { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-3); }
  .fp-ms-suggest { justify-content: center; margin-top: var(--space-3); }
  .fp-ms-feed { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
  .fp-ms-side { display: flex; flex-direction: column; gap: var(--space-5); min-width: 0; }
  .fp-ms-board { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
</style>
