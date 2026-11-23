<script lang="ts">
  // Every player's milestone total as a table: place by count, the player, how many milestones they were
  // first to (a link to exactly those in the feed) and when the newest one was.
  import { page } from "$app/state";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import PlayerName from "#lib/design/PlayerName.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import Segmented from "#lib/design/Segmented.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import { ago, dateTime, iso } from "#lib/format/dates.ts";
  import { group } from "#lib/format/stat-display.ts";
  import { playerRowLabel } from "#lib/players/names.ts";
  import { scopeLabel } from "#lib/servers.ts";
  import { withParams } from "#lib/url.ts";
  import { SORTS, playerFeedHref } from "../holders.ts";
  import TypeSelect from "../TypeSelect.svelte";
  let { data } = $props();

  const scopeName = $derived(scopeLabel(data.scope, data.network.ok ? data.network.data.servers : []));
  const typeName = $derived(data.typeOptions.find((t) => t.key === data.type)?.label);
  const where = $derived(data.scope === "network" ? "on the network" : `on ${scopeName}`);
  const lede = $derived(
    data.complete && !data.mini
      ? data.players === 0
        ? `Nobody has been first to a milestone ${where} yet.`
        : `${group(data.players)} player${data.players === 1 ? " has" : "s have"} been first to a milestone ${where}${typeName ? `, counting ${typeName} only` : ""}.`
      : "How many milestones each player was first to reach."
  );
</script>

<PageHead path="~/milestones" cmd="sort" args="players" title="per player" {lede}>
  <form method="get" class="fx-filters" role="search" aria-label="Filter players">
    {#if data.scope !== "network"}<input type="hidden" name="scope" value={data.scope} />{/if}
    {#if data.sort !== "most"}<input type="hidden" name="sort" value={data.sort} />{/if}
    {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} />{/if}
    <TypeSelect options={data.typeOptions} value={data.type} />
    <label class="fx-search">
      <span class="c4" aria-hidden="true">»</span>
      <input type="search" name="q" value={data.q} placeholder="find a player" aria-label="Find a player" maxlength="64" autocomplete="off" />
    </label>
    <button class="ink c5" type="submit">filter</button>
  </form>
</PageHead>

{#if data.mini}
  <Notice kind="info">Milestones are kept per server and for the whole network, not per mini-server. Pick a server or the network above.</Notice>
{:else if !data.complete}
  <Window path="~/milestones/players">
    {#if data.recording}
      <EmptyState title="The totals are being counted" line=" The site is reading every milestone once. This table fills in when it has them all.">
        <p class="more"><a class="ink c5" href="/milestones">the milestone feed</a></p>
      </EmptyState>
    {:else}
      <EmptyState title="Totals are not available" line=" They are counted by the site's recorder, which is not running.">
        <p class="more"><a class="ink c5" href="/milestones">the milestone feed</a></p>
      </EmptyState>
    {/if}
  </Window>
{:else if data.players === 0}
  <Window path="~/milestones/players">
    <EmptyState title="No milestones yet" line=" Players show up here once they are the first to reach a milestone." />
  </Window>
{:else}
  <Window path="~/milestones/players" args={data.q ? `--match ${data.q}` : undefined}>
    <WindowHead title={data.q ? `Players matching “${data.q}”` : "All players"}>
      {scopeName}{#if typeName}{" "}· {typeName}{/if}{" "}· {group(data.counted)} milestone{data.counted === 1 ? "" : "s"}{#if data.asOf}{" "}· <AsOf at={data.asOf} />{/if}
    </WindowHead>
    <div class="order">
      <Segmented label="Order" options={SORTS.map((s) => ({ href: withParams(page.url, { sort: s.id === "most" ? null : s.id }), label: s.label, current: data.sort === s.id }))} />
    </div>
    {#if data.matching === 0}
      <EmptyState title="No player by that name" line=" Names match on any part, so a few letters are enough." />
    {:else}
      <div class="fx-scroll">
        <table class="fx-table">
          <caption class="visually-hidden">Milestones per player, {scopeName}{typeName ? `, ${typeName}` : ""}</caption>
          <thead>
            <tr><th class="r" scope="col">#</th><th scope="col">Player</th><th class="r" scope="col">Milestones</th><th class="r" scope="col">Newest</th></tr>
          </thead>
          <tbody>
            {#each data.rows as p (p.uuid)}
              <tr>
                <td class="r">{p.rank}</td>
                <td><PlayerName uuid={p.uuid} name={p.name} /></td>
                <td class="r"><a href={playerFeedHref(p, data.scope, data.type)} title="The milestones of {playerRowLabel(p)}">{group(p.count)}</a></td>
                <td class="r">
                  {#if p.latest !== null}<time datetime={iso(p.latest)} title={dateTime(p.latest)}>{ago(p.latest)}</time>{:else}<span class="c1" title="Reached before tracking began">before tracking</span>{/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
    {#snippet foot()}
      <Pager url={page.url} total={data.matching} limit={data.limit} offset={data.offset} what="players" />
    {/snippet}
  </Window>
{/if}

<style>
  .more { display: flex; justify-content: center; margin: 12px 0 0; }
  .order { margin-bottom: 12px; }
  form.fx-filters :global(.seg) { background: var(--color-base); }
</style>
