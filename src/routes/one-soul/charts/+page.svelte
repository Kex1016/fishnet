<script lang="ts">
  import { page } from "$app/state";
  import AsOf from "#lib/design/AsOf.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import { BarList, ColumnChart, Heatmap, LineChart, ViewSwitch } from "#lib/charts/index.ts";
  import { life } from "#lib/onesoul/format.ts";
  import { osHref } from "#lib/onesoul/links.ts";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();
  const view = $derived(data.view);
  const hours = (ms: number) => life(ms);
</script>

<div class="fp-page">
  <section class="fp-section">
    <div class="fp-section__head">
      <h1 class="t-display">{data.ok && data.round === null ? "Every round in charts" : `Round ${data.ok ? data.round : ""} in charts`}</h1>
      {#if data.ok && data.asOf}<AsOf at={data.asOf} stale={data.stale} />{/if}
    </div>
    {#if data.ok}
      <div class="os-controls">
        <nav class="fp-seg" aria-label="Round">
          <a href={withParams(page.url, { round: "all" })} aria-current={data.round === null ? "page" : undefined}>All rounds</a>
          {#each data.rounds as r (r)}<a href={withParams(page.url, { round: String(r) })} aria-current={r === data.round ? "page" : undefined}>Round {r}</a>{/each}
        </nav>
        <ViewSwitch url={page.url} {view} />
      </div>
      {#if data.playing}<p class="t-small t-muted">The soul who is playing now joins these charts when their turn ends.</p>{/if}
    {/if}
  </section>

  {#if !data.ok}
    <Notice kind="warning">The charts could not be loaded right now.</Notice>
  {:else}
    <div class="os-charts">
      <div class="os-wide">
        <ColumnChart
          title="How long each soul lived"
          sub={data.round === null ? "every finished life, by round and turn" : "by turn"}
          points={data.survival}
          unit="ms"
          format={hours}
          highlight={data.record ?? undefined}
          {view}
          emptyTitle="No life has ended yet"
          emptyLine="A bar appears for each soul once their turn is over."
        />
      </div>
      {#if data.perRound}
        <ColumnChart title="Souls per round" points={data.perRound.map((r) => ({ key: String(r.cycle), label: `Round ${r.cycle}`, v: r.souls, href: osHref.round(r.cycle) }))} unit="count" {view} emptyTitle="No round yet" />
        <ColumnChart title="Time lived per round" sub="all finished lives added up" points={data.perRound.map((r) => ({ key: String(r.cycle), label: `Round ${r.cycle}`, v: r.total, href: osHref.round(r.cycle) }))} unit="ms" format={hours} {view} emptyTitle="No round yet" />
        <ColumnChart title="Longest life per round" points={data.perRound.map((r) => ({ key: String(r.cycle), label: `Round ${r.cycle}`, v: r.longest, href: osHref.round(r.cycle) }))} unit="ms" format={hours} {view} emptyTitle="No round yet" />
      {/if}
      {#if data.signups}
        <LineChart title="Sign-ups over time" sub="how many had signed up, never who or in which order" points={data.signups} unit="count" {view} emptyTitle="Nobody has signed up yet" />
      {/if}
      <ColumnChart title="Deaths per day" sub="final deaths, UTC days" points={data.deaths} unit="count" {view} emptyTitle="Nobody has died yet" />
      <BarList title="Causes of death" sub="grouped; anything unusual is Other" rows={data.causes} unit="count" {view} emptyTitle="Nobody has died yet" />
      {#if data.graves}
        <BarList title="Graves" sub="{data.graves.total} in all" rows={data.graves.status} unit="count" {view} emptyTitle="No graves yet" />
        <ColumnChart title="Time until a grave was claimed" points={data.graves.claim} unit="count" {view} emptyTitle="No grave has been claimed yet" />
      {/if}
      <BarList title="Second chances" sub="finished lives" rows={data.secondChances} unit="count" {view} emptyTitle="No life has ended yet" />
      {#if data.pranks}
        <div class="os-wide">
          <Heatmap title="Ghost pranks by day" sub="finished round only" rows={data.pranks.rows} columns={data.pranks.columns} unit="count" {view} emptyTitle="No pranks this round" />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .os-controls {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .os-charts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
    gap: var(--space-4);
  }
  .os-wide {
    grid-column: 1 / -1;
    min-width: 0;
  }
</style>
