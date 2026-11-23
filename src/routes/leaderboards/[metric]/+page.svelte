<script lang="ts">
  import { page } from "$app/state";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import RankList from "#lib/design/RankList.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import { ColumnChart, LineChart } from "#lib/charts/index.ts";
  import { problemCode } from "#lib/api/result.ts";
  import { group } from "#lib/format/stat-display.ts";
  import { rankRows } from "#lib/boards.ts";
  import { playerRowLabel } from "#lib/players/names.ts";
  let { data } = $props();
  const board = $derived(data.board);
  const leader = $derived(board.ok ? (board.top[0]?.value ?? 0) : 0);
</script>

<PageHead path="~/leaderboards" cmd="sort" args="-r {data.id}" title={data.title} lede={data.about ?? undefined}>
  <div class="fx-filters">
    {#if board.ok && data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} minis={data.minis} />{/if}
    <span class="c1" style="font-size: 12px">{data.kicker}{data.subjectKey ? ` · ${data.subjectKey}` : ""}</span>
  </div>
</PageHead>

{#if !board.ok}
  {#if board.kind === "not_found"}
    <EmptyState title="Nobody has done this yet" line="{data.title} will have a board as soon as someone records it." />
  {:else if board.kind === "bad_request" && problemCode(board) === "mixed_units"}
    <EmptyState title="Custom stats have mixed units" line="Counts, distances and times cannot be added up. Pick one custom stat instead." />
  {:else if board.kind === "rate_limited"}
    <Notice kind="info"><b>The site is busy.</b> This board will load again in a moment.</Notice>
  {:else if board.kind === "bad_request"}
    <EmptyState title="This board does not exist" line="It is not a scope or a stat the network knows." />
  {:else}
    <Notice kind="warning"><b>cakeutils could not be reached.</b> This board will be back when it is.</Notice>
  {/if}
{:else}
  {#if board.stale}
    <Notice kind="warning"><b>cakeutils could not be reached.</b> Showing the last good data, <AsOf at={board.asOf} stale />.</Notice>
  {/if}

  {#if board.empty}
    <Window path="~/leaderboards" args="--stat">
      <EmptyState
        title={data.scope === "network" ? "No one has recorded this yet" : `No one in ${data.scopeName} has recorded this yet`}
        line="The board fills in as people play."
      />
    </Window>
  {:else}
    <Window path="~/leaderboards" args="--numbers">
      <WindowHead title="The numbers" asof={data.scopeName} />
      <div class="stat-panel fx-tiles">
        <div><span class="kv_label">Players ranked</span><span class="kv_value num">{group(board.ranked)}</span><span class="note">{data.scopeName}</span></div>
        <div>
          <span class="kv_label">Top score</span><span class="kv_value num">{board.topDisplay ?? "—"}</span>
          {#if board.top[0]}<span class="note">{playerRowLabel(board.top[0])}</span>{/if}
        </div>
        {#if board.medianDisplay}<div><span class="kv_label">Median player</span><span class="kv_value num">{board.medianDisplay}</span><span class="note">half have more, half less</span></div>{/if}
        {#if board.totalDisplay}<div><span class="kv_label">All players together</span><span class="kv_value num">{board.totalDisplay}</span><span class="note">players added up inside {data.scopeName}</span></div>{/if}
      </div>
    </Window>

    <div class="fx-grid wide" style="align-items: start">
      <Window path="~/leaderboards" args="--all" tag="section" label="All players">
        <WindowHead title="All players" id="all-players">
          <span class="num">{group(board.total)} ranked</span>{#if board.capped}{" "}· the first 1 000 are loaded{/if}
        </WindowHead>
        {#if board.tableFailed}
          <Notice kind="warning"><b>cakeutils could not be reached.</b> This page of the board will be back when it is.</Notice>
        {:else}
          <RankList rows={rankRows(board.rows, { leader })} label="{data.title} in {data.scopeName}, ranked" />
        {/if}
        <Pager url={page.url} total={board.total} limit={data.limit} offset={data.offset} what="players" />
      </Window>

      <div class="fx-stack" style="gap: 40px">
        {#if data.subjectKey || data.parts.length || data.typeKey}
          <Window path="~/stats" args={data.subjectKey ? "--subject" : "--type"} tag="section" label="About this board">
            <WindowHead title="About this stat" level={3} />
            {#if data.subjectKey}<div style="margin-bottom: 12px"><Slot icon={data.subjectIcon} size="lg" name={data.title} /></div>{/if}
            <div class="list">
              {#if data.subjectKey && !data.parts.length}<a class="li" href="/stats/subject/{encodeURIComponent(data.subjectKey)}"><span class="mk">»</span><span class="grow">About this stat</span></a>{/if}
              {#each data.parts as part (part.href)}<a class="li" href={part.href}><span class="mk">»</span><span class="grow">{part.label}</span></a>{/each}
              {#if data.typeKey}<a class="li" href="/stats/{encodeURIComponent(data.typeKey)}"><span class="mk">»</span><span class="grow">All {data.kicker.toLowerCase()} stats</span></a>{/if}
              <a class="li" href="/leaderboards"><span class="mk">»</span><span class="grow">All boards</span></a>
            </div>
          </Window>
        {/if}

        <ColumnChart
          title="How players spread out"
          sub="players by how much they have"
          points={board.histogram}
          unit="count"
          format={(v) => `${group(v)} ${v === 1 ? "player" : "players"}`}
          asOf={board.asOf}
          stale={board.stale}
          emptyTitle="Not enough players yet"
          emptyLine="The spread appears once players are in more than one step."
        />

        {#if data.history}
          <LineChart
            title="Top of the board over time"
            sub="{data.scopeName} · the leader's total at the end of each day, UTC"
            points={data.history.points}
            unit={board.unit}
            zero={false}
            asOf={data.history.asOf}
            stale={data.history.stale}
            emptyTitle="No history yet"
            emptyLine="The line fills in a day at a time."
          />
        {/if}
      </div>
    </div>
  {/if}
{/if}
