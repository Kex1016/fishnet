<script lang="ts">
  // Columns on one baseline (reki: ≤ 24px wide, xs-radius tops, one hue). The readout in the card
  // header follows the pointer and the arrow keys; the table twin lists every column.
  import type { ColumnChartProps, CategoryPoint, TimePoint } from "./types.ts";
  import ChartCard from "./ChartCard.svelte";
  import DataTable from "./DataTable.svelte";
  import { formatStat } from "#lib/format/stat-display.ts";
  import { axisTop, columnPath, columnWidth, labelEvery, maxValue, nearestIndex, niceTicks, tickLabel, timeLabel, timeReadout, yOf } from "./scale.ts";
  import "./charts.css";

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

  // geometry: the SVG is measured after hydration; the server renders it at a default width and the
  // viewBox scales it until then
  let width = $state(560);
  const PAD = { top: 8, right: 8, bottom: 22, left: 0 };
  const top = $derived(axisTop(maxValue(cols), 4, unit));
  const ticks = $derived(niceTicks(maxValue(cols), 4, unit));
  const tickTexts = $derived(ticks.map((t) => tickLabel(unit, t)));
  const axisW = $derived(Math.max(...tickTexts.map((t) => t.length)) * 7 + 8);
  const left = $derived(PAD.left + axisW);
  const right = $derived(width - PAD.right);
  const yTop = $derived(PAD.top);
  const yBase = $derived(height - PAD.bottom);
  const slot = $derived(cols.length ? (right - left) / cols.length : 0);
  const colW = $derived(columnWidth(slot));
  const xs = $derived(cols.map((_, i) => left + slot * i + slot / 2));
  const every = $derived(labelEvery(cols.length, slot, Math.max(...cols.map((c) => c.short.length), 1) * 6.6 + 8));

  // the active column: hover and keyboard move it; it starts on the highlight, else the last column
  const hiIndex = $derived(highlight ? cols.findIndex((c) => c.key === highlight) : -1);
  let hover = $state<number | null>(null);
  const active = $derived(hover ?? (hiIndex >= 0 ? hiIndex : cols.length - 1));
  const current = $derived(cols[active]);

  let svg = $state<SVGSVGElement>();
  function pointAt(e: PointerEvent) {
    if (!svg || !cols.length) return;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * width;
    hover = nearestIndex(xs, x);
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
  <div class="fp-plot__wrap" bind:clientWidth={width}>
      <!-- the chart is a figure whose readout follows the pointer and the arrow keys; the table twin is the accessible form -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <svg
      bind:this={svg}
      class="fp-plot"
      viewBox="0 0 {width} {height}"
      {height}
      role="img"
      aria-label={summary}
      tabindex="0"
      onpointermove={pointAt}
      onpointerdown={pointAt}
      onpointerleave={() => (hover = null)}
      onblur={() => (hover = null)}
      onkeydown={key}
    >
      {#each ticks as t, i (t)}
        <line class={i === 0 ? "fp-plot__base" : "fp-plot__grid"} x1={left} x2={right} y1={yOf(t, top, yTop, yBase)} y2={yOf(t, top, yTop, yBase)} />
        <text class="fp-plot__tick" x={left - 6} y={yOf(t, top, yTop, yBase) + 4} text-anchor="end">{tickTexts[i]}</text>
      {/each}
      {#each cols as c, i (c.key)}
        {@const y = yOf(c.v, top, yTop, yBase)}
        <path
          class="fp-plot__col"
          class:fp-plot__col--hi={i === hiIndex || i === hover}
          class:fp-plot__col--dim={(hover !== null && i !== hover) || (hover === null && hiIndex >= 0 && i !== hiIndex)}
          d={columnPath(xs[i] - colW / 2, y, colW, yBase - y, 3)}
        />
        {#if i % every === 0}
          <text class="fp-plot__tick" x={xs[i]} y={yBase + 15} text-anchor="middle">{c.short}</text>
        {/if}
      {/each}
    </svg>
  </div>
  {#snippet table()}<DataTable columns={[{ key: "label", label: "" }, { key: "value", label: frame.title, num: true }]} {rows} caption={frame.title} />{/snippet}
</ChartCard>
