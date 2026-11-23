<script lang="ts">
  // A step line: each sample holds its value until the next one (haiiro draws charts in squares, not polylines).
  // A step is as wide as the time it covers, so uneven samples keep their place. An optional dashed second series
  // sits behind the first (waiting behind online). Hover and arrow keys move the readout.
  import type { LineChartProps } from "./types.ts";
  import ChartCard from "./ChartCard.svelte";
  import DataTable from "./DataTable.svelte";
  import { formatStat } from "#lib/format/stat-display.ts";
  import { axisIndices, axisTop, cleanTime, labelEvery, maxValue, niceFloor, tickLabel, timeLabel, timeReadout } from "./scale.ts";
  import { nearestChild } from "./dom.ts";

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

  const max = $derived(Math.max(maxValue(pts), maxValue(sh)));
  const min = $derived(zero ? 0 : Math.min(...pts.map((p) => p.v), ...(sh.length ? sh.map((p) => p.v) : [])));
  // when the axis does not start at zero, values are offset by the floor and the scale line says where it starts
  const floor = $derived(zero || !Number.isFinite(min) ? 0 : niceFloor(min, max));
  const top = $derived(axisTop(Math.max(0, max - floor), 4, unit));
  const pct = (v: number) => (top > 0 ? Math.max(0, Math.min(100, ((v - floor) / top) * 100)) : 0);

  // a step covers the time up to the next sample; the last one is as wide as the mean step
  type Step = { t: number; v: number; w: number; at: number };
  function steps(list: { t: number; v: number }[]): Step[] {
    if (!list.length) return [];
    const n = list.length;
    const t0 = list[0].t;
    const total = list[n - 1].t - t0;
    const last = n > 1 ? total / (n - 1) : 1;
    const whole = Math.max(1, total + last);
    return list.map((p, i) => {
      const w = i < n - 1 ? list[i + 1].t - p.t : last;
      return { t: p.t, v: p.v, w: Math.max(w, 0.0001) / whole, at: (p.t - t0) / whole };
    });
  }
  const ss = $derived(steps(pts));
  const sss = $derived(steps(sh));

  let width = $state(560);
  const xLabel = (p: { t: number; label?: string }) => p.label ?? timeLabel(p.t, span);
  const labelW = $derived(Math.max(...pts.map((p) => xLabel(p).length), 1) * 7.5 + 16);
  // labels sit at their step's left edge (the moment the value starts), thinned by the narrowest slot
  const slot = $derived(pts.length > 1 ? width / pts.length : width);
  const labelAt = $derived(axisIndices(pts.length, labelEvery(pts.length, slot, labelW)));

  let hover = $state<number | null>(null);
  const active = $derived(hover ?? pts.length - 1);
  const current = $derived(pts[active]);
  const shadowAt = $derived.by(() => {
    if (!shadow || !current) return undefined;
    return sh.find((p) => p.t === current.t);
  });
  const readoutLabel = $derived(current ? `${labelOf(current.t, current.label)}${shadowAt ? ` · ${shadow!.label} ${fmt(shadowAt.v)}` : ""}` : undefined);

  let stepsEl = $state<HTMLElement>();
  function pointAt(e: PointerEvent) {
    const i = nearestChild(stepsEl, e.clientX);
    if (i >= 0) hover = i;
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
    {#if sh.length > 1}
      <div class="fx-steps shadow{ss.length > 60 ? ' dense' : ''}" aria-hidden="true">
        {#each sss as s (s.t)}<i style="flex-grow: {s.w.toFixed(5)}; height: {pct(s.v).toFixed(2)}%"></i>{/each}
      </div>
    {/if}
    <div class="fx-steps{ss.length > 60 ? ' dense' : ''}" bind:this={stepsEl}>
      {#each ss as s, i (s.t)}
        <i class:now={hover === null && i === ss.length - 1} class:on={i === hover} style="flex-grow: {s.w.toFixed(5)}; height: {pct(s.v).toFixed(2)}%"></i>
      {/each}
    </div>
    <div class="fx-axis at" aria-hidden="true">
      {#each labelAt as i (i)}<span class:first={i === 0} class:last={i === pts.length - 1} style="--x: {(ss[i].at * 100).toFixed(2)}%">{xLabel(pts[i])}</span>{/each}
    </div>
    <p class="cap">scale {tickLabel(unit, floor)} to {tickLabel(unit, top + floor)}</p>
    {#if shadow}
      <div class="fx-legend"><i class="k-main"></i><span>{frame.title}</span><i class="k-second"></i><span>{shadow.label}</span></div>
    {/if}
  </div>
  {#snippet table()}
    <DataTable columns={[{ key: "when", label: "When" }, { key: "value", label: frame.title, num: true }, ...(shadow ? [{ key: "shadow", label: shadow.label, num: true }] : [])]} {rows} caption={frame.title} />
  {/snippet}
</ChartCard>
