<script lang="ts">
  import { page } from "$app/state";
  import { BookOpen } from "@lucide/svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import Outcome from "#lib/onesoul/Outcome.svelte";
  import { life, dimLabel } from "#lib/onesoul/format.ts";
  import { osHref } from "#lib/onesoul/links.ts";
  import { day } from "#lib/format/dates.ts";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();
  const souls = $derived(data.souls);
</script>

<div class="fp-page">
  <section class="fp-section">
    <div class="fp-section__head">
      <h1 class="t-display">Chronicle</h1>
      {#if souls?.ok}<AsOf at={souls.asOf} stale={souls.stale} />{/if}
    </div>
    <p class="t-body t-muted">Every soul that has had a turn, in the order they played. Who plays next is a secret, and stays one.</p>
    <div class="os-controls">
      {#if data.rounds.length > 1}
        <nav class="fp-seg" aria-label="Round">
          {#each data.rounds as r (r)}<a href={withParams(page.url, { round: String(r) })} aria-current={r === data.round ? "page" : undefined}>Round {r}</a>{/each}
        </nav>
      {/if}
      {#if data.osFeatures.tracking}
        <nav class="fp-seg" aria-label="Order">
          <a href={withParams(page.url, { sort: null })} aria-current={data.sort === "turn" ? "page" : undefined}>By turn</a>
          <a href={withParams(page.url, { sort: "duration" })} aria-current={data.sort === "duration" ? "page" : undefined}>Longest first</a>
        </nav>
      {/if}
    </div>
  </section>

  {#if !souls || !souls.ok}
    <Notice kind="warning">The chronicle could not be loaded right now.</Notice>
  {:else if souls.data.souls.length === 0}
    <EmptyState title="No soul has played in this round yet" line="The first soul's turn starts when the world opens." />
  {:else}
    <div class="os-table-wrap">
      <table class="fp-table os-table">
        <thead>
          <tr><th scope="col">Turn</th><th scope="col">Soul</th><th scope="col">Lived</th><th scope="col">Outcome</th><th scope="col">How it ended</th><th scope="col"><span class="visually-hidden">Journal</span></th></tr>
        </thead>
        <tbody>
          {#each souls.data.souls as s (`${s.cycle}-${s.turn}`)}
            <tr>
              <td class="t-num">{s.turn}</td>
              <td class="os-name"><a href={osHref.soul(s.cycle, s.turn)}>{s.name}</a><span class="t-caption">{day(s.started_at)}</span></td>
              <td class="t-num t-tabular">{s.duration_ms === null ? "playing" : life(s.duration_ms)}</td>
              <td><Outcome outcome={s.outcome} /></td>
              <td class="os-cause">
                {#if s.cause}<q>{s.cause}</q>{/if}
                {#if s.death && s.outcome !== "playing"}<span class="t-caption">{dimLabel(s.death.dim)}</span>{/if}
                {#if s.second_chance}<span class="t-caption">had a second chance</span>{/if}
              </td>
              <td>{#if s.has_journal}<a class="fp-chip" href={osHref.journal(s.cycle, s.turn)} aria-label="Read {s.name}'s journal"><BookOpen class="fp-ico fp-ico--sm" strokeWidth={1.4} />Journal</a>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <Pager url={page.url} total={souls.data.total} limit={data.limit} offset={data.offset} what="souls" />
  {/if}
</div>

<style>
  .os-controls {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .os-table-wrap {
    overflow-x: auto;
  }
  .os-table td {
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--line-soft);
    vertical-align: top;
  }
  .os-name,
  .os-cause {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-wrap: anywhere;
  }
  .os-name a {
    font-weight: 600;
    color: var(--text);
  }
  .os-cause q {
    font-style: italic;
    color: var(--muted);
  }
  @media (max-width: 640px) {
    .os-table thead {
      display: none;
    }
    .os-table tr {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr) auto;
      gap: 0 var(--space-2);
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--line-soft);
    }
    .os-table td {
      border: 0;
      padding: 2px 0;
    }
    .os-table td:nth-child(3) {
      grid-column: 3;
      grid-row: 1;
      text-align: right;
    }
    .os-table td:nth-child(4),
    .os-table td:nth-child(5),
    .os-table td:nth-child(6) {
      grid-column: 2 / 4;
    }
  }
</style>
