<script lang="ts">
  // Rows × columns of acc-heat-1..4 cells: sunk for no data, a hairline for cells still to come
  // (undefined), the sunk ground with a hairline for zero. Hover and the arrow keys move the readout.
  import type { HeatmapProps } from "./types.ts";
  import ChartCard from "./ChartCard.svelte";
  import DataTable from "./DataTable.svelte";
  import { formatStat } from "#lib/format/stat-display.ts";
  import { heatLevel } from "./scale.ts";
  import "./charts.css";

  let { rows, columns, unit = "count", format, cellLabel, ...frame }: HeatmapProps = $props();
  const fmt = $derived(format ?? ((v: number) => formatStat(unit, v)));
  const label = $derived(cellLabel ?? ((r: string, c: string) => `${r} ${c}`));
  const empty = $derived(rows.every((r) => r.cells.every((c) => c === null || c === undefined)));
  const tableRows = $derived(rows.map((r) => Object.fromEntries([["row", r.label], ...columns.map((c, i) => [c, r.cells[i] == null ? "—" : fmt(r.cells[i] as number)])])));
  const max = $derived(Math.max(0, ...rows.flatMap((r) => r.cells.filter((c): c is number => typeof c === "number"))));

  // cells fill the measured width up to 24px each (the server renders at a default width; the
  // viewBox scales it until hydration measures the real one)
  let width = $state(560);
  const GAP = 2;
  const rowLabelW = $derived(Math.max(...rows.map((r) => r.label.length), 1) * 7 + 8);
  const colLabelH = 16;
  const CELL = $derived(Math.max(4, Math.min(24, Math.floor((width - rowLabelW) / Math.max(1, columns.length)) - GAP)));
  const w = $derived(rowLabelW + columns.length * (CELL + GAP));
  const h = $derived(colLabelH + rows.length * (CELL + GAP));
  const colEvery = $derived(Math.max(1, Math.ceil((Math.max(...columns.map((c) => c.length), 1) * 7 + 6) / (CELL + GAP))));

  // the active cell: the highest by default
  const best = $derived.by(() => {
    let b: [number, number] | null = null;
    let bv = -1;
    rows.forEach((r, ri) => r.cells.forEach((c, ci) => { if (typeof c === "number" && c > bv) { bv = c; b = [ri, ci]; } }));
    return b;
  });
  let hover = $state<[number, number] | null>(null);
  const active = $derived(hover ?? best);
  const activeValue = $derived.by(() => {
    if (!active) return undefined;
    const c = rows[active[0]]?.cells[active[1]];
    return c === undefined ? "—" : c === null ? "no data" : fmt(c);
  });
  const activeLabel = $derived(active ? label(rows[active[0]].label, columns[active[1]]) : undefined);

  let svg = $state<SVGSVGElement>();
  function pointAt(e: PointerEvent) {
    if (!svg || !rows.length || !columns.length) return;
    const r = svg.getBoundingClientRect();
    const scale = r.width / w;
    const x = (e.clientX - r.left) / scale - rowLabelW;
    const y = (e.clientY - r.top) / scale - colLabelH;
    if (x < 0 || y < 0) return;
    const ci = Math.floor(x / (CELL + GAP));
    const ri = Math.floor(y / (CELL + GAP));
    if (ri < rows.length && ci < columns.length) hover = [ri, ci];
  }
  function key(e: KeyboardEvent) {
    if (!rows.length || !columns.length) return;
    const [r, c] = active ?? [0, 0];
    const move: Record<string, [number, number]> = { ArrowUp: [r - 1, c], ArrowDown: [r + 1, c], ArrowLeft: [r, c - 1], ArrowRight: [r, c + 1], Home: [r, 0], End: [r, columns.length - 1] };
    if (e.key === "Escape") hover = null;
    else if (e.key in move) {
      e.preventDefault();
      const [nr, nc] = move[e.key];
      hover = [Math.max(0, Math.min(rows.length - 1, nr)), Math.max(0, Math.min(columns.length - 1, nc))];
    }
  }
  const summary = $derived(best ? `${frame.title}: ${rows.length} rows by ${columns.length} columns, highest ${fmt(rows[best[0]].cells[best[1]] as number)} at ${label(rows[best[0]].label, columns[best[1]])}` : frame.title);
</script>

<ChartCard {frame} {empty} readoutValue={activeValue} readoutLabel={activeLabel}>
  <div class="fp-heat" bind:clientWidth={width}>
      <!-- the chart is a figure whose readout follows the pointer and the arrow keys; the table twin is the accessible form -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <svg bind:this={svg} class="fp-plot fp-heat__plot" viewBox="0 0 {w} {h}" width={w} height={h} role="img" aria-label={summary} tabindex="0" onkeydown={key} onpointermove={pointAt} onpointerdown={pointAt} onpointerleave={() => (hover = null)} onblur={() => (hover = null)}>
      {#each columns as c, ci (ci)}
        {#if ci % colEvery === 0}
          <text class="fp-plot__tick" x={rowLabelW + ci * (CELL + GAP) + CELL / 2} y={colLabelH - 5} text-anchor="middle">{c}</text>
        {/if}
      {/each}
      {#each rows as r, ri (ri)}
        <text class="fp-plot__tick" x={rowLabelW - 6} y={colLabelH + ri * (CELL + GAP) + CELL / 2 + 4} text-anchor="end">{r.label}</text>
        {#each columns as c, ci (ci)}
          {@const v = r.cells[ci]}
          {@const cls = v === undefined ? "fp-plot__cell--future" : v === null ? "fp-plot__cell--none" : `fp-plot__cell--${heatLevel(v, max)}`}
          <rect
            class="fp-plot__cell {cls}"
            class:fp-plot__cell--active={active?.[0] === ri && active?.[1] === ci}
            x={rowLabelW + ci * (CELL + GAP) + 0.5}
            y={colLabelH + ri * (CELL + GAP) + 0.5}
            width={CELL - 1}
            height={CELL - 1}
            rx={Math.min(3, CELL / 4)}
          ><title>{label(r.label, c)}: {v === undefined ? "not yet" : v === null ? "no data" : fmt(v)}</title></rect>
        {/each}
      {/each}
    </svg>
    <div class="fp-plot__legend">
      <span>less</span>
      {#each [1, 2, 3, 4] as n (n)}<span><i class="fp-plot__key fp-heat__key--{n}"></i></span>{/each}
      <span>more</span>
    </div>
  </div>
  {#snippet table()}<DataTable columns={[{ key: "row", label: "" }, ...columns.map((c) => ({ key: c, label: c, num: true }))]} rows={tableRows} caption={frame.title} />{/snippet}
</ChartCard>

<style>
  .fp-heat { width: 100%; }
  .fp-heat__plot { width: auto; max-width: 100%; height: auto; }
  .fp-heat .fp-plot__legend { gap: var(--space-1); justify-content: flex-end; }
  .fp-heat__key--1 { background: var(--acc-heat-1); }
  .fp-heat__key--2 { background: var(--acc-heat-2); }
  .fp-heat__key--3 { background: var(--acc-heat-3); }
  .fp-heat__key--4 { background: var(--acc-heat-4); }
</style>
