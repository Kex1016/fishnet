<script lang="ts">
  // Square columns on one hairline base (≤ 24px wide, one hue). The readout above the plot follows the pointer and
  // the arrow keys; the current bucket (the highlight) is gold; the table twin lists every column.
  import type { ColumnChartProps, CategoryPoint, TimePoint } from "./types.ts";
  import ChartCard from "./ChartCard.svelte";
  import DataTable from "./DataTable.svelte";
  import { formatStat } from "#lib/format/stat-display.ts";
  import { axisIndices, axisTop, labelEvery, maxValue, tickLabel, timeLabel, timeReadout } from "./scale.ts";
  import { nearestChild } from "./dom.ts";

  let { points, unit = "count", format, height = 160, highlight, ...frame }: ColumnChartProps = $props();
  const fmt = $derived(format ?? ((v: number) => formatStat(unit, v)));

  const isTime = $derived(points.length > 0 && !("key" in points[0]));
  const span = $derived(isTime ? (points as TimePoint[]).at(-1)!.t - (points as TimePoint[])[0].t : 0);
  type Col = { key: string; label: string; short: string; v: number; display: string; href?: string };
  const cols = $derived<Col[]>(
    points.map((p) =>
      "key" in p
        ? { key: p.key, label: p.label, short: p.label, v: (p as CategoryPoint).v, display: p.display ?? fmt(p.v), href: p.href }
        : { key: String(p.t), label: p.label ?? timeReadout(p.t, span), short: p.label ?? timeLabel(p.t, span), v: p.v, display: fmt(p.v) }
    )
  );
  const empty = $derived(cols.length < 2);
  const rows = $derived(cols.map((c) => ({ label: c.label, value: c.display, key: c.key })));

  // the plot is measured after hydration (the server renders at a default width) so the axis labels thin out to fit
  let width = $state(560);
  const top = $derived(axisTop(maxValue(cols), 4, unit));
  const slot = $derived(cols.length ? width / cols.length : 0);
  const every = $derived(labelEvery(cols.length, slot, Math.max(...cols.map((c) => c.short.length), 1) * 7.5 + 16));
  const labelAt = $derived(axisIndices(cols.length, every));
  const pct = (v: number) => (top > 0 ? Math.max(0, Math.min(100, (v / top) * 100)) : 0);

  // the active column: hover and keyboard move it; it starts on the highlight, else the last column
  const hiIndex = $derived(highlight ? cols.findIndex((c) => c.key === highlight) : -1);
  let hover = $state<number | null>(null);
  const active = $derived(hover ?? (hiIndex >= 0 ? hiIndex : cols.length - 1));
  const current = $derived(cols[active]);

  let colsEl = $state<HTMLElement>();
  function pointAt(e: PointerEvent) {
    const i = nearestChild(colsEl, e.clientX);
    if (i >= 0) hover = i;
  }
  function key(e: KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      hover = Math.max(0, Math.min(cols.length - 1, active + (e.key === "ArrowLeft" ? -1 : 1)));
    } else if (e.key === "Home") hover = 0;
    else if (e.key === "End") hover = cols.length - 1;
    else if (e.key === "Escape") hover = null;
  }
  const summary = $derived.by(() => {
    if (!cols.length) return frame.title;
    const best = cols.reduce((a, b) => (b.v > a.v ? b : a));
    return `${frame.title}: ${cols.length} columns, highest ${best.display} at ${best.label}`;
  });
</script>

<ChartCard {frame} {empty} readoutValue={current?.display} readoutLabel={current?.label}>
  <!-- the chart is a figure whose readout follows the pointer and the arrow keys; the table twin is the accessible form -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="fx-plot"
    style="--plot-h: {height}px"
    bind:clientWidth={width}
    role="img"
    aria-label={summary}
    tabindex="0"
    onpointermove={pointAt}
    onpointerdown={pointAt}
    onpointerleave={() => (hover = null)}
    onblur={() => (hover = null)}
    onkeydown={key}
  >
    <div class="fx-cols" bind:this={colsEl}>
      {#each cols as c, i (c.key)}
        <i class:now={i === hiIndex} class:on={i === hover} style="height: {pct(c.v).toFixed(2)}%{c.v > 0 ? '; min-height: 2px' : ''}"></i>
      {/each}
    </div>
    <div class="fx-axis at" aria-hidden="true">
      {#each labelAt as i (i)}<span class:first={i === 0} class:last={i === cols.length - 1} style="--x: {(((i + 0.5) / cols.length) * 100).toFixed(2)}%">{cols[i].short}</span>{/each}
    </div>
    <p class="cap">scale 0 to {tickLabel(unit, top)}</p>
  </div>
  {#snippet table()}<DataTable columns={[{ key: "label", label: "" }, { key: "value", label: frame.title, num: true }]} {rows} caption={frame.title} />{/snippet}
</ChartCard>
