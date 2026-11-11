<script lang="ts">
  import { page } from "$app/state";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import EventRow from "#lib/onesoul/EventRow.svelte";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();
  const SHOW = [
    ["deaths", "Deaths"],
    ["souls", "Souls"],
    ["graves", "Graves"],
    ["round", "The round"],
    ["ghosts", "Ghosts"]
  ];
</script>

<div class="fp-page">
  <section class="fp-section">
    <div class="fp-section__head">
      <h1 class="t-display">Timeline</h1>
      {#if data.events?.ok}<AsOf at={data.events.asOf} stale={data.events.stale} />{/if}
    </div>
    <div class="os-controls">
      {#if data.rounds.length > 1}
        <nav class="fp-seg" aria-label="Round">
          {#each data.rounds as r (r)}<a href={withParams(page.url, { round: String(r) })} aria-current={r === data.round ? "page" : undefined}>Round {r}</a>{/each}
        </nav>
      {/if}
      {#if data.osFeatures.tracking}
        <nav class="fp-seg" aria-label="Show">
          <a href={withParams(page.url, { show: null })} aria-current={data.show === null ? "page" : undefined}>Everything</a>
          {#each SHOW as [k, l] (k)}<a href={withParams(page.url, { show: k })} aria-current={data.show === k ? "page" : undefined}>{l}</a>{/each}
        </nav>
      {/if}
    </div>
  </section>
  {#if !data.events || !data.events.ok}
    <Notice kind="warning">The timeline could not be loaded right now.</Notice>
  {:else if data.events.data.events.length === 0}
    <EmptyState title="Nothing has happened yet" line="Sign-ups, souls, deaths and graves show up here as they happen." />
  {:else}
    <ul class="os-events">
      {#each data.events.data.events as e, i (i)}<EventRow {e} now={data.events.asOf} />{/each}
    </ul>
    <Pager url={page.url} total={data.events.data.total} limit={data.limit} offset={data.offset} what="events" />
  {/if}
</div>

<style>
  .os-controls {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .os-events {
    list-style: none;
    margin: 0;
    padding: 0;
  }
</style>
