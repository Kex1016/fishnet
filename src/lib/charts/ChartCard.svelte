<script lang="ts">
  // The frame every chart shares, now a haiiro window: the label notched into the frame, the heading line
  // (title, the quiet `sub` on the right), the readout in Jacquard 24, the body (chart or its table twin) and
  // a foot with "Recording since" and "as of". The charts draw inside it.
  import type { Snippet } from "svelte";
  import type { ChartFrame } from "./types.ts";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import { day } from "#lib/format/dates.ts";
  import { slug } from "./scale.ts";
  import "./charts.css";
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
  const path = $derived(frame.path ?? `~/${slug(frame.title)}`);
  const showFoot = $derived(Boolean((frame.since && !empty) || frame.asOf));
</script>

{#snippet footLine()}
  {#if frame.since && !empty}<span>Recording since {day(frame.since)}</span>{/if}
  {#if frame.asOf}<AsOf at={frame.asOf} stale={frame.stale} />{/if}
{/snippet}

<Window {path} foot={showFoot ? footLine : undefined}>
  <WindowHead title={frame.title} href={frame.href} level={frame.level ?? 2} asof={frame.sub} />
  {#if readoutValue && !empty}
    <div class="fx-read" aria-live="polite"><span class="big num">{readoutValue}</span>{#if readoutLabel}<p class="cap">{readoutLabel}</p>{/if}</div>
  {/if}
  {#if empty}
    <EmptyState title={frame.emptyTitle ?? "Nothing to show yet"} line={frame.emptyLine} since={frame.since} />
  {:else if frame.view === "tables" && table}
    {@render table()}
  {:else}
    {@render children()}
  {/if}
</Window>
