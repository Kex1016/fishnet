<script lang="ts">
  import { page } from "$app/state";
  import { Skull } from "@lucide/svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import { BarList } from "#lib/charts/index.ts";
  import { dimLabel } from "#lib/onesoul/format.ts";
  import { posText } from "#lib/network/words.ts";
  import { ago, dateTime, iso } from "#lib/format/dates.ts";
  import { playerHref, playerRowLabel } from "#lib/players/names.ts";
  let { data } = $props();
  const sub = $derived(data.counted < data.total ? `the newest ${data.counted} of ${data.total} deaths` : "every death so far");
</script>

<div class="fp-page">
  <header class="fp-hero">
    <h1 class="t-display">Deaths</h1>
    <p class="fp-lede">Every death on the network, newest first, in the game's own words. One Soul deaths have their own section.</p>
  </header>
  <div class="dx-bar">
    {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} />{/if}
  </div>

  {#if data.mini}
    <p class="t-small t-muted">Deaths are kept per server and for the whole network, not per mini-server. Pick a server or the network above.</p>
  {:else if !data.feed || !data.feed.ok}
    <Notice kind="warning">Deaths could not be loaded right now.</Notice>
  {:else if data.feed.data.deaths.length === 0}
    <EmptyState icon={Skull} title="Nobody has died yet" line="A death shows up here a moment after it happens." />
  {:else}
    <div class="fp-two">
      <div>
        <section class="fp-card dx-feed">
          <div class="fp-section__head"><h2 class="t-title-4">Latest</h2><AsOf at={data.feed.asOf} stale={data.feed.stale} /></div>
          <ol class="dx-list">
            {#each data.feed.data.deaths as d, i (`${d.uuid}-${d.at}-${i}`)}
              <li class="dx-row">
                <Face uuid={d.uuid} name={playerRowLabel(d)} size="sm" />
                <div class="dx-body">
                  <q class="dx-cause">{d.cause ?? `${playerRowLabel(d)} died`}</q>
                  <div class="t-caption dx-meta">
                    <a href={playerHref(d)}>{playerRowLabel(d)}</a>{#if d.killer_player}, by <a href={playerHref(d.killer_player)}>{playerRowLabel(d.killer_player)}</a>{/if}
                    {#if data.scope === "network"} · {data.serverNames[d.server] ?? d.server}{/if}
                    {#if d.dim} · {dimLabel(d.dim)}{/if}
                    {#if d.pos} · {posText(d.pos)}{/if}
                  </div>
                </div>
                <time class="t-caption dx-when" datetime={iso(d.at)} title={dateTime(d.at)}>{ago(d.at)}</time>
              </li>
            {/each}
          </ol>
        </section>
        <Pager url={page.url} total={data.feed.data.total} limit={data.limit} offset={data.offset} what="deaths" />
      </div>
      <div class="dx-side">
        <BarList title="How they died" {sub} rows={data.causes.map(([k, v], i) => ({ rank: i + 1, key: k, label: k, v, display: String(v) }))} emptyTitle="Nobody has died yet" />
        <BarList title="Died most" {sub} faces rows={data.who.map((w, i) => ({ rank: i + 1, key: w.uuid, label: playerRowLabel(w), v: w.n, display: String(w.n), href: playerHref(w), uuid: w.uuid }))} emptyTitle="Nobody has died yet" />
      </div>
    </div>
  {/if}
</div>

<style>
  .dx-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .dx-feed {
    padding: var(--space-4);
  }
  .dx-list {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
  }
  .dx-row {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) auto;
    gap: var(--space-3);
    align-items: start;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--line-soft);
  }
  .dx-row:last-child {
    border-bottom: 0;
  }
  .dx-cause {
    font: 400 14px/20px var(--font-text);
    overflow-wrap: anywhere;
    quotes: none;
  }
  .dx-meta {
    color: var(--muted);
  }
  .dx-when {
    color: var(--faint);
    white-space: nowrap;
  }
  .dx-side {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  @media (max-width: 520px) {
    .dx-row {
      grid-template-columns: 24px minmax(0, 1fr);
    }
    .dx-when {
      grid-column: 2;
    }
  }
</style>
