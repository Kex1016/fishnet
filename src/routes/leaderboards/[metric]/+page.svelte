<script lang="ts">
  import { page } from "$app/state";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import { BarList, ColumnChart, LineChart, StatTile, ViewSwitch, viewParam } from "#lib/charts/index.ts";
  import { problemCode } from "#lib/api/result.ts";
  import { group } from "#lib/format/stat-display.ts";
  import { barRows, playerHref, playerLabel } from "../board.ts";
  let { data } = $props();
  const view = $derived(viewParam(page.url));
  const board = $derived(data.board);
</script>

<div class="fp-page">
  <header class="fp-hero" style="flex-direction: row; align-items: center; gap: var(--space-4)">
    {#if data.subjectKey}<Slot icon={data.subjectIcon} kind={data.subjectKind as never} size="lg" name={data.title} />{/if}
    <div style="display: flex; flex-direction: column; gap: var(--space-2); min-width: 0">
      <span class="t-kicker">{data.typeKey ? "Leaderboard · " : ""}{data.kicker}</span>
      <h1 class="t-display">{data.title}</h1>
      {#if data.about}<p class="fp-lede">{data.about}</p>{/if}
      <p class="fp-chips">
        {#if data.subjectKey}<a class="fp-chip" href="/stats/subject/{encodeURIComponent(data.subjectKey)}">About this stat</a>{/if}
        {#if data.typeKey}<a class="fp-chip" href="/stats/{encodeURIComponent(data.typeKey)}">All {data.kicker.toLowerCase()} stats</a>{/if}
        <a class="fp-chip" href="/leaderboards">All boards</a>
      </p>
    </div>
  </header>

  {#if !board.ok}
    {#if board.kind === "not_found"}
      <EmptyState title="Nobody has done this yet" line="{data.title} will have a board as soon as someone records it." />
    {:else if board.kind === "bad_request" && problemCode(board) === "mixed_units"}
      <EmptyState title="Custom stats have mixed units" line="Counts, distances and times cannot be added up. Pick one custom stat instead." />
    {:else if board.kind === "rate_limited"}
      <Notice kind="warning"><b>The site is busy right now.</b> Try again in a moment.</Notice>
    {:else if board.kind === "bad_request"}
      <EmptyState title="This board does not exist" line="It is not a scope or a stat the network knows." />
    {:else}
      <Notice kind="warning"><b>cakeutils could not be reached.</b> This board will be back when it is.</Notice>
    {/if}
  {:else}
    <div class="fp-filters">
      {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} minis={data.minis} />{/if}
      <span style="margin-left: auto"><ViewSwitch url={page.url} {view} /></span>
    </div>

    {#if board.stale}
      <Notice kind="warning"><b>cakeutils could not be reached.</b> Showing the last good data, <AsOf at={board.asOf} stale />.</Notice>
    {/if}

    {#if board.empty}
      <EmptyState
        title={data.scope === "network" ? "No one has recorded this yet" : `No one in ${data.scopeName} has recorded this yet`}
        line="The board fills in as people play."
      />
    {:else}
      <div class="fp-tiles">
        <StatTile label="Players ranked" value={group(board.ranked)} note={data.scopeName} />
        <StatTile label="Top score" value={board.topDisplay ?? "—"} note={board.top[0] ? playerLabel(board.top[0]) : undefined} />
        {#if board.medianDisplay}<StatTile label="Median player" value={board.medianDisplay} note="half have more, half less" />{/if}
        {#if board.totalDisplay}<StatTile label="All players together" value={board.totalDisplay} note="players added up inside {data.scopeName}" />{/if}
      </div>

      <div class="fp-two">
        <BarList
          title="Top 10"
          sub="{data.scopeName} · {data.title}"
          {view}
          faces
          unit={board.unit}
          asOf={board.asOf}
          stale={board.stale}
          rows={barRows(board.top)}
        />
        <ColumnChart
          title="How players spread out"
          sub="players by how much they have"
          {view}
          points={board.histogram}
          unit="count"
          format={(v) => `${group(v)} ${v === 1 ? "player" : "players"}`}
          asOf={board.asOf}
          stale={board.stale}
          emptyTitle="Not enough players yet"
          emptyLine="The spread appears once players are in more than one step."
        />
      </div>

      {#if data.history}
        <LineChart
          title="Top of the board over time"
          sub="{data.scopeName} · the leader's total at the end of each day, UTC"
          {view}
          points={data.history.points}
          unit={board.unit}
          zero={false}
          asOf={data.history.asOf}
          stale={data.history.stale}
          emptyTitle="No history yet"
          emptyLine="The line fills in a day at a time."
        />
      {/if}

      <section class="fp-card fp-chart" aria-labelledby="all-players">
        <header class="fp-card__head">
          <div>
            <h2 class="fp-card__title" id="all-players">All players</h2>
            <div class="fp-card__sub">{data.scopeName} · {group(board.total)} ranked{#if board.capped} · the first 1 000 are loaded{/if}</div>
          </div>
        </header>
        <div class="fp-card__body">
          {#if board.tableFailed}
            <Notice kind="warning"><b>cakeutils could not be reached.</b> This page of the table will be back when it is.</Notice>
          {:else}
            <div class="fp-table__wrap">
              <table class="fp-table">
                <caption class="visually-hidden">{data.title} in {data.scopeName}, ranked</caption>
                <thead><tr><th class="num" scope="col">#</th><th scope="col">Player</th><th class="num" scope="col">{data.title}</th></tr></thead>
                <tbody>
                  {#each board.rows as e (e.uuid)}
                    <tr>
                      <td class="num">{e.rank}</td>
                      <td><a class="board-player" href={playerHref(e)}><Face uuid={e.uuid} name={playerLabel(e)} size="sm" /><span>{playerLabel(e)}</span></a></td>
                      <td class="num">{e.display}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
        <footer class="fp-card__foot" style="display: block">
          <Pager url={page.url} total={board.total} limit={data.limit} offset={data.offset} what="players" />
        </footer>
      </section>
    {/if}
  {/if}
</div>

<style>
  .board-player { display: inline-flex; align-items: center; gap: var(--space-2); color: inherit; font-weight: 500; min-width: 0; }
  .board-player:hover { color: var(--acc-ink); text-decoration: none; }
  .board-player span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
