<script lang="ts">
  // A 2px line with a soft area wash and a ringed end dot; an optional muted shadow series behind it
  // (waiting behind online). Hover and arrow keys move a cursor; the readout follows it.
  import type { LineChartProps } from "./types.ts";
  import ChartCard from "./ChartCard.svelte";
  import DataTable from "./DataTable.svelte";
  import { formatStat } from "#lib/format/stat-display.ts";
  import { areaPath, axisTop, cleanTime, labelEvery, linePath, maxValue, nearestIndex, niceFloor, niceTicks, tickLabel, timeLabel, timeReadout, xByTime, yOf } from "./scale.ts";
  import "./charts.css";

  let { points, unit = "count", format, height = 160, zero = true, shadow, ...frame }: LineChartProps = $props();
  const fmt = $derived(format ?? ((v: number) => formatStat(unit, v)));
  const pts = $derived(cleanTime(points));
  const sh = $derived(shadow ? cleanTime(shadow.points) : []);
  const empty = $derived(pts.length < 2);
  const span = $derived(pts.length ? pts[pts.length - 1].t - pts[0].t : 0);
  const labelOf = (t: number, label?: string) => label ?? timeReadout(t, span);
  const rows = $derived(
    pts.map((p, i) => {
      const r: Record<string, string> = { when: labelOf(p.t, p.label), value: fmt(p.v) };
      if (shadow) r.shadow = sh[i] ? fmt(sh[i].v) : "—";
      return r;
    })
  );

  let width = $state(560);
  const PAD = { top: 8, right: 10, bottom: 22, left: 0 };
  const max = $derived(Math.max(maxValue(pts), maxValue(sh)));
  const min = $derived(zero ? 0 : Math.min(...pts.map((p) => p.v), ...(sh.length ? sh.map((p) => p.v) : [])));
  // when the axis does not start at zero, values are offset by the floor and the ticks carry it back
  const floor = $derived(zero || !Number.isFinite(min) ? 0 : niceFloor(min, max));
  const top = $derived(axisTop(Math.max(0, max - floor), 4, unit));
  const ticks = $derived(niceTicks(Math.max(0, max - floor), 4, unit));
  const tickTexts = $derived(ticks.map((t) => tickLabel(unit, t + floor)));
  const axisW = $derived(Math.max(...tickTexts.map((t) => t.length)) * 7 + 8);
  const left = $derived(PAD.left + axisW);
  const right = $derived(width - PAD.right);
  const yTop = $derived(PAD.top);
  const yBase = $derived(height - PAD.bottom);
  const xs = $derived(xByTime(pts, left, right));
  const ys = $derived(pts.map((p) => yOf(p.v - floor, top, yTop, yBase)));
  const sxs = $derived(xByTime(sh, left, right));
  const sys = $derived(sh.map((p) => yOf(p.v - floor, top, yTop, yBase)));
  const xLabel = (p: { t: number; label?: string }) => p.label ?? timeLabel(p.t, span);
  const labelW = $derived(Math.max(...pts.map((p) => xLabel(p).length), 1) * 7 + 12);
  const labelAt = $derived(labelEvery(pts.length, pts.length > 1 ? (right - left) / (pts.length - 1) : right - left, labelW));

  let hover = $state<number | null>(null);
  const active = $derived(hover ?? pts.length - 1);
  const current = $derived(pts[active]);
  const shadowAt = $derived.by(() => {
    if (!shadow || !current) return undefined;
    const i = sh.findIndex((p) => p.t === current.t);
    return i >= 0 ? sh[i] : undefined;
  });
  const readoutLabel = $derived(current ? `${labelOf(current.t, current.label)}${shadowAt ? ` · ${shadow!.label} ${fmt(shadowAt.v)}` : ""}` : undefined);

  let svg = $state<SVGSVGElement>();
  function pointAt(e: PointerEvent) {
    if (!svg || !pts.length) return;
    const r = svg.getBoundingClientRect();
    hover = nearestIndex(xs, ((e.clientX - r.left) / r.width) * width);
  }
  function key(e: KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      hover = Math.max(0, Math.min(pts.length - 1, active + (e.key === "ArrowLeft" ? -1 : 1)));
    } else if (e.key === "Home") hover = 0;
    else if (e.key === "End") hover = pts.length - 1;
    else if (e.key === "Escape") hover = null;
  }
  const summary = $derived.by(() => {
    if (!pts.length) return frame.title;
    const best = pts.reduce((a, b) => (b.v > a.v ? b : a));
    return `${frame.title}: ${pts.length} points from ${labelOf(pts[0].t, pts[0].label)} to ${labelOf(pts[pts.length - 1].t, pts[pts.length - 1].label)}, highest ${fmt(best.v)} at ${labelOf(best.t, best.label)}`;
  });
</script>

<ChartCard {frame} {empty} readoutValue={current ? fmt(current.v) : undefined} {readoutLabel}>
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
        {@const y = yOf(t, top, yTop, yBase)}
        <line class={i === 0 ? "fp-plot__base" : "fp-plot__grid"} x1={left} x2={right} y1={y} y2={y} />
        <text class="fp-plot__tick" x={left - 6} y={y + 4} text-anchor="end">{tickTexts[i]}</text>
      {/each}
      {#each pts as p, i (p.t)}
        {#if i % labelAt === 0 && xs[i] <= right - labelW}
          <text class="fp-plot__tick" x={xs[i]} y={yBase + 15} text-anchor="middle">{xLabel(p)}</text>
        {/if}
      {/each}
      {#if pts.length > 1}
        <text class="fp-plot__tick" x={right} y={yBase + 15} text-anchor="end">{xLabel(pts[pts.length - 1])}</text>
      {/if}
      {#if sh.length > 1}
        <path class="fp-plot__line fp-plot__line--shadow" d={linePath(sxs, sys)} />
      {/if}
      <path class="fp-plot__area" d={areaPath(xs, ys, yBase)} />
      <path class="fp-plot__line" d={linePath(xs, ys)} />
      {#if hover !== null}
        <line class="fp-plot__cursor" x1={xs[hover]} x2={xs[hover]} y1={yTop} y2={yBase} />
        {#if shadowAt}
          {@const si = sh.indexOf(shadowAt)}
          <circle class="fp-plot__dot fp-plot__dot--shadow" cx={sxs[si]} cy={sys[si]} r="3.5" />
        {/if}
        <circle class="fp-plot__dot" cx={xs[hover]} cy={ys[hover]} r="4" />
      {:else if pts.length}
        <circle class="fp-plot__dot" cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="4" />
      {/if}
    </svg>
    {#if shadow}
      <div class="fp-plot__legend"><span><i class="fp-plot__key fp-plot__key--line"></i>{frame.title}</span><span><i class="fp-plot__key fp-plot__key--shadow"></i>{shadow.label}</span></div>
    {/if}
  </div>
  {#snippet table()}
    <DataTable columns={[{ key: "when", label: "When" }, { key: "value", label: frame.title, num: true }, ...(shadow ? [{ key: "shadow", label: shadow.label, num: true }] : [])]} {rows} caption={frame.title} />
  {/snippet}
</ChartCard>
