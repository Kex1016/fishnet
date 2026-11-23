<script lang="ts">
  import { page } from "$app/state";
  import AsOf from "#lib/design/AsOf.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Segmented from "#lib/design/Segmented.svelte";
  import { BarList, ColumnChart, Heatmap, LineChart } from "#lib/charts/index.ts";
  import OsTabs from "#lib/onesoul/OsTabs.svelte";
  import { life } from "#lib/onesoul/format.ts";
  import { osHref } from "#lib/onesoul/links.ts";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();
  const hours = (ms: number) => life(ms);
</script>

<PageHead
  path="~/one-soul"
  cmd="plot"
  args={data.ok && data.round !== null ? `round-${data.round}` : "--all"}
  title={data.ok && data.round !== null ? `round ${data.round} in charts` : "every round in charts"}
  note={data.ok && data.playing ? "The soul who is playing now joins these charts when their turn ends." : undefined}
>
  <OsTabs />
  {#if data.ok}
    <div class="fx-filters">
      <Segmented
        label="Round"
        options={[{ href: withParams(page.url, { round: "all" }), label: "all rounds", current: data.round === null }, ...data.rounds.map((r: number) => ({ href: withParams(page.url, { round: String(r) }), label: `round ${r}`, current: r === data.round }))]}
      />
      {#if data.asOf}<span class="c1 os-asof"><AsOf at={data.asOf} stale={data.stale} /></span>{/if}
    </div>
  {/if}
</PageHead>

{#if !data.ok}
  <Notice kind="warning">The charts could not be loaded right now.</Notice>
{:else}
  <div class="fx-grid os-charts">
    <div class="os-wide">
      <ColumnChart
        title="How long each soul lived"
        sub={data.round === null ? "every finished life, by round and turn" : "by turn"}
        points={data.survival}
        unit="ms"
        format={hours}
        highlight={data.record ?? undefined}
        emptyTitle="No life has ended yet"
        emptyLine="A bar appears for each soul once their turn is over."
      />
    </div>
    {#if data.perRound}
      <ColumnChart title="Souls per round" points={data.perRound.map((r) => ({ key: String(r.cycle), label: `Round ${r.cycle}`, v: r.souls, href: osHref.round(r.cycle) }))} unit="count" emptyTitle="No round yet" />
      <ColumnChart title="Time lived per round" sub="all finished lives added up" points={data.perRound.map((r) => ({ key: String(r.cycle), label: `Round ${r.cycle}`, v: r.total, href: osHref.round(r.cycle) }))} unit="ms" format={hours} emptyTitle="No round yet" />
      <ColumnChart title="Longest life per round" points={data.perRound.map((r) => ({ key: String(r.cycle), label: `Round ${r.cycle}`, v: r.longest, href: osHref.round(r.cycle) }))} unit="ms" format={hours} emptyTitle="No round yet" />
    {/if}
    {#if data.signups}
      <LineChart title="Sign-ups over time" sub="how many had signed up, never who or in which order" points={data.signups} unit="count" emptyTitle="Nobody has signed up yet" />
    {/if}
    <ColumnChart title="Deaths per day" sub="final deaths, UTC days" points={data.deaths} unit="count" emptyTitle="Nobody has died yet" />
    <BarList title="Causes of death" sub="grouped; anything unusual is Other" rows={data.causes} unit="count" emptyTitle="Nobody has died yet" />
    {#if data.graves}
      <BarList title="Graves" sub="{data.graves.total} in all" rows={data.graves.status} unit="count" emptyTitle="No graves yet" />
      <ColumnChart title="Time until a grave was claimed" points={data.graves.claim} unit="count" emptyTitle="No grave has been claimed yet" />
    {/if}
    <BarList title="Second chances" sub="finished lives" rows={data.secondChances} unit="count" emptyTitle="No life has ended yet" />
    {#if data.pranks}
      <div class="os-wide">
        <Heatmap title="Ghost pranks by day" sub="finished round only" rows={data.pranks.rows} columns={data.pranks.columns} unit="count" emptyTitle="No pranks this round" />
      </div>
    {/if}
  </div>
{/if}

<style>
  .os-charts > :global(*) {
    min-width: 0;
  }
  .os-wide {
    grid-column: 1 / -1;
    min-width: 0;
  }
  .os-asof {
    background: var(--color-base);
  }
</style>
