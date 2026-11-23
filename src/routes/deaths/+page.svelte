<script lang="ts">
  import { page } from "$app/state";
  import { AsOf, EmptyState, Feed, FeedRow, Notice, PageHead, Pager, ScopeSwitch, Window, WindowHead } from "#lib/design/index.ts";
  import { BarList } from "#lib/charts/index.ts";
  import { dimLabel } from "#lib/onesoul/format.ts";
  import { posText } from "#lib/network/words.ts";
  import { ago } from "#lib/format/dates.ts";
  import { playerHref, playerRowLabel } from "#lib/players/names.ts";
  let { data } = $props();
  const sub = $derived(data.counted < data.total ? `the newest ${data.counted} of ${data.total} deaths` : "every death so far");
</script>

<PageHead cmd="cat" args="deaths" title="deaths" lede="Every death on the network, newest first, in the game's own words. One Soul deaths have their own section.">
  <div class="fx-filters">
    {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} />{/if}
  </div>
</PageHead>

{#if data.mini}
  <Notice kind="info">Deaths are kept per server and for the whole network, not per mini-server. Pick a server or the network above.</Notice>
{:else if !data.feed || !data.feed.ok}
  <Notice kind="warning">Deaths could not be loaded right now.</Notice>
{:else if data.feed.data.deaths.length === 0}
  <EmptyState title="Nobody has died yet" line="A death shows up here a moment after it happens." />
{:else}
  <div class="fx-grid wide">
    <div class="fx-stack">
      <Window path="~/deaths" args="--latest" tone="love">
        <WindowHead title="Latest"><AsOf at={data.feed.asOf} stale={data.feed.stale} /></WindowHead>
        <Feed label="Latest deaths">
          {#each data.feed.data.deaths as d, i (`${d.uuid}-${d.at}-${i}`)}
            <FeedRow uuid={d.uuid} when={ago(d.at)}>
              {d.cause ?? `${playerRowLabel(d)} died`}
              {#snippet sub()}
                <a href={playerHref(d)}>{playerRowLabel(d)}</a>{#if d.killer_player}, by <a href={playerHref(d.killer_player)}>{playerRowLabel(d.killer_player)}</a>{/if}{#if data.scope === "network"} · {data.serverNames[d.server] ?? d.server}{/if}{#if d.dim} · {dimLabel(d.dim)}{/if}{#if d.pos} · {posText(d.pos)}{/if}
              {/snippet}
            </FeedRow>
          {/each}
        </Feed>
      </Window>
      <Pager url={page.url} total={data.feed.data.total} limit={data.limit} offset={data.offset} what="deaths" />
    </div>
    <div class="fx-stack">
      <BarList title="How they died" {sub} rows={data.causes.map(([k, v], i) => ({ rank: i + 1, key: k, label: k, v, display: String(v) }))} emptyTitle="Nobody has died yet" />
      <BarList title="Died most" {sub} faces rows={data.who.map((w, i) => ({ rank: i + 1, key: w.uuid, label: playerRowLabel(w), v: w.n, display: String(w.n), href: playerHref(w), uuid: w.uuid }))} emptyTitle="Nobody has died yet" />
    </div>
  </div>
{/if}
