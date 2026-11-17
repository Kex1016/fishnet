<script lang="ts">
  // Every player's milestone total as a table: place by count, the player, how many milestones they were
  // first to (a link to exactly those in the feed) and when the newest one was.
  import { page } from "$app/state";
  import { Hourglass, Search } from "@lucide/svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import { ago, dateTime, iso } from "#lib/format/dates.ts";
  import { group } from "#lib/format/stat-display.ts";
  import { playerHref, playerRowLabel } from "#lib/players/names.ts";
  import { scopeLabel } from "#lib/servers.ts";
  import { withParams } from "#lib/url.ts";
  import { SORTS, playerFeedHref } from "../holders.ts";
  import TypeSelect from "../TypeSelect.svelte";
  let { data } = $props();

  const scopeName = $derived(scopeLabel(data.scope, data.network.ok ? data.network.data.servers : []));
  const typeName = $derived(data.typeOptions.find((t) => t.key === data.type)?.label);
  const where = $derived(data.scope === "network" ? "on the network" : `on ${scopeName}`);
</script>

<div class="fp-page">
  <header class="fp-hero">
    <span class="t-kicker">Milestones</span>
    <h1 class="t-display">Milestones per player</h1>
    <p class="fp-lede">
      {#if data.complete && !data.mini}
        {#if data.players === 0}Nobody has been first to a milestone {where} yet.{:else}{group(data.players)} player{data.players === 1 ? " has" : "s have"} been first to a milestone {where}{#if typeName}, counting {typeName} only{/if}.{/if}
      {:else}
        How many milestones each player was first to reach.
      {/if}
    </p>
  </header>

  <div class="fp-msp-bar">
    {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} />{/if}
    <form method="get" class="fp-msp-filter" role="search" aria-label="Filter players">
      {#if data.scope !== "network"}<input type="hidden" name="scope" value={data.scope} />{/if}
      {#if data.sort !== "most"}<input type="hidden" name="sort" value={data.sort} />{/if}
      <TypeSelect options={data.typeOptions} value={data.type} />
      <label class="fp-field fp-search">
        <Search class="fp-ico fp-ico--sm" strokeWidth={1.4} />
        <input type="search" name="q" value={data.q} placeholder="Find a player" aria-label="Find a player" maxlength="64" autocomplete="off" />
      </label>
      <button class="fp-btn" type="submit">Filter</button>
    </form>
  </div>

  {#if data.mini}
    <p class="t-small t-muted">Milestones are kept per server and for the whole network, not per mini-server. Pick a server or the network above.</p>
  {:else if !data.complete}
    {#if data.recording}
      <EmptyState icon={Hourglass} title="The totals are being counted" line="The site is reading every milestone once. This table fills in when it has them all.">
        <p class="fp-chips fp-msp-more"><a class="fp-chip" href="/milestones">The milestone feed</a></p>
      </EmptyState>
    {:else}
      <EmptyState icon={Hourglass} title="Totals are not available" line="They are counted by the site's recorder, which is not running.">
        <p class="fp-chips fp-msp-more"><a class="fp-chip" href="/milestones">The milestone feed</a></p>
      </EmptyState>
    {/if}
  {:else if data.players === 0}
    <EmptyState title="No milestones yet" line="Players show up here once they are the first to reach a milestone." />
  {:else}
    <section class="fp-card fp-chart" aria-labelledby="holders">
      <header class="fp-card__head fp-msp-head">
        <div>
          <h2 class="fp-card__title" id="holders">{data.q ? `Players matching “${data.q}”` : "All players"}</h2>
          <div class="fp-card__sub">
            {scopeName}{#if typeName}{" "}· {typeName}{/if} · {group(data.counted)} milestone{data.counted === 1 ? "" : "s"}{#if data.asOf}{" "}· <AsOf at={data.asOf} />{/if}
          </div>
        </div>
        <nav class="fp-seg" aria-label="Order">
          {#each SORTS as s (s.id)}
            <a href={withParams(page.url, { sort: s.id === "most" ? null : s.id })} aria-current={data.sort === s.id ? "page" : undefined}>{s.label}</a>
          {/each}
        </nav>
      </header>
      <div class="fp-card__body">
        {#if data.matching === 0}
          <EmptyState title="No player by that name" line="Names match on any part, so a few letters are enough." />
        {:else}
          <div class="fp-table__wrap">
            <table class="fp-table">
              <caption class="visually-hidden">Milestones per player, {scopeName}{typeName ? `, ${typeName}` : ""}</caption>
              <thead>
                <tr><th class="num" scope="col">#</th><th scope="col">Player</th><th class="num" scope="col">Milestones</th><th class="num" scope="col">Newest</th></tr>
              </thead>
              <tbody>
                {#each data.rows as p (p.uuid)}
                  <tr>
                    <td class="num">{p.rank}</td>
                    <td><a class="msp-player" href={playerHref(p)}><Face uuid={p.uuid} name={playerRowLabel(p)} size="sm" /><span>{playerRowLabel(p)}</span></a></td>
                    <td class="num"><a href={playerFeedHref(p, data.scope, data.type)} title="The milestones of {playerRowLabel(p)}">{group(p.count)}</a></td>
                    <td class="num">
                      {#if p.latest !== null}<time datetime={iso(p.latest)} title={dateTime(p.latest)}>{ago(p.latest)}</time>{:else}<span class="t-muted" title="Reached before tracking began">before tracking</span>{/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
      <footer class="fp-card__foot" style="display: block">
        <Pager url={page.url} total={data.matching} limit={data.limit} offset={data.offset} what="players" />
      </footer>
    </section>
  {/if}
</div>

<style>
  .fp-msp-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3) var(--space-4); }
  .fp-msp-filter { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
  .fp-msp-head { flex-wrap: wrap; gap: var(--space-3); }
  .fp-msp-more { justify-content: center; margin-top: var(--space-3); }
  .msp-player { display: inline-flex; align-items: center; gap: var(--space-2); color: inherit; font-weight: 500; min-width: 0; }
  .msp-player:hover { color: var(--acc-ink); text-decoration: none; }
  .msp-player span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
