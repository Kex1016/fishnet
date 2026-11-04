<script lang="ts">
  // The frame every chart shares: card header with title/sub/readout, the body (chart or its table
  // twin), a footer with "Recording since" and "as of". W0 stub: the final markup; W3 keeps it and
  // builds the charts inside it.
  import type { Snippet } from "svelte";
  import type { ChartFrame } from "./types.ts";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import { day } from "#lib/format/dates.ts";
  let {
    frame,
    empty = false,
    readoutValue,
    readoutLabel,
    children,
    table
  }: {
    frame: ChartFrame;
    /** nothing to draw: render the empty state in the body instead of the chart */
    empty?: boolean;
    readoutValue?: string;
    readoutLabel?: string;
    children: Snippet;
    /** the table twin, rendered when frame.view === "tables" */
    table?: Snippet;
  } = $props();
</script>

<section class="fp-card fp-chart">
  <header class="fp-card__head">
    <div>
      <h2 class="fp-card__title">{#if frame.href}<a href={frame.href}>{frame.title}</a>{:else}{frame.title}{/if}</h2>
      {#if frame.sub}<div class="fp-card__sub">{frame.sub}</div>{/if}
    </div>
    {#if readoutValue && !empty}
      <div class="fp-card__readout" aria-live="polite"><b>{readoutValue}</b>{#if readoutLabel}<span>{readoutLabel}</span>{/if}</div>
    {/if}
  </header>
  <div class="fp-card__body">
    {#if empty}
      <EmptyState title={frame.emptyTitle ?? "Nothing to show yet"} line={frame.emptyLine} since={frame.since} />
    {:else if frame.view === "tables" && table}
      {@render table()}
    {:else}
      {@render children()}
    {/if}
  </div>
  {#if (frame.since && !empty) || frame.asOf}
    <footer class="fp-card__foot">
      {#if frame.since && !empty}<span>Recording since {day(frame.since)}</span>{/if}
      {#if frame.asOf}<AsOf at={frame.asOf} stale={frame.stale} />{/if}
    </footer>
  {/if}
</section>

<style>
  /* the readout may carry a time and a second series; it wraps before it squeezes the title */
  .fp-chart .fp-card__readout { max-width: 55%; }
  .fp-chart .fp-card__readout span { display: block; white-space: normal; overflow-wrap: anywhere; }
  .fp-chart .fp-card__head > div:first-child { min-width: 0; }
</style>
