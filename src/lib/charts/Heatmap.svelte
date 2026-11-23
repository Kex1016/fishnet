<script lang="ts">
  // Rows × columns of squares in four steps of lightness (haiiro's .fx-heat), so it reads without hue. Zero is the
  // plain overlay, no data a dither, a cell still to come (undefined) a dashed outline. Hover and the arrow keys
  // move the readout.
  import type { HeatmapProps } from "./types.ts";
  import ChartCard from "./ChartCard.svelte";
  import DataTable from "./DataTable.svelte";
  import { formatStat } from "#lib/format/stat-display.ts";
  import { heatLevel } from "./scale.ts";

  let { rows, columns, unit = "count", format, cellLabel, ...frame }: HeatmapProps = $props();
  const fmt = $derived(format ?? ((v: number) => formatStat(unit, v)));
  const label = $derived(cellLabel ?? ((r: string, c: string) => `${r} ${c}`));
  const empty = $derived(rows.every((r) => r.cells.every((c) => c === null || c === undefined)));
  const tableRows = $derived(rows.map((r) => Object.fromEntries([["row", r.label], ...columns.map((c, i) => [c, r.cells[i] == null ? "—" : fmt(r.cells[i] as number)])])));
  const max = $derived(Math.max(0, ...rows.flatMap((r) => r.cells.filter((c): c is number => typeof c === "number"))));
  const has = $derived({
    none: rows.some((r) => r.cells.some((c) => c === null)),
    future: rows.some((r) => r.cells.some((c) => c === undefined) || r.cells.length < columns.length)
  });

  // the label column is as wide as its longest label; columns thin their labels to what the measured width fits
  let width = $state(560);
  const rowCh = $derived(Math.max(...rows.map((r) => r.label.length), 1) + 1);
  const cell = $derived(Math.max(4, Math.min(24, (width - rowCh * 8) / Math.max(1, columns.length))));
  const colEvery = $derived(Math.max(1, Math.ceil((Math.max(...columns.map((c) => c.length), 1) * 6.5 + 6) / (cell + 2))));
  const colSpan = $derived(Math.max(1, Math.ceil((Math.max(...columns.map((c) => c.length), 1) * 6.5) / (cell + 2))));
  const showCol = (ci: number) => ci % colEvery === 0 && ci + colSpan <= columns.length + 1;
  const cellAt = (r: number, c: number) => rows[r]?.cells[c];
  const levelOf = (v: number | null | undefined) => (v === undefined ? "future" : v === null ? "none" : heatLevel(v, max) === 0 ? "" : `h${heatLevel(v, max)}`);

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
    const c = cellAt(active[0], active[1]);
    return c === undefined ? "—" : c === null ? "no data" : fmt(c);
  });
  const activeLabel = $derived(active ? label(rows[active[0]].label, columns[active[1]]) : undefined);

  let grid = $state<HTMLElement>();
  function pointAt(e: PointerEvent) {
    const t = (e.target as HTMLElement | null)?.closest?.("i[data-r]") as HTMLElement | null;
    if (t && grid?.contains(t)) hover = [Number(t.dataset.r), Number(t.dataset.c)];
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
  <!-- the chart is a figure whose readout follows the pointer and the arrow keys; the table twin is the accessible form -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div class="fx-plot" bind:clientWidth={width} role="img" aria-label={summary} tabindex="0" onkeydown={key} onpointermove={pointAt} onpointerdown={pointAt} onpointerleave={() => (hover = null)} onblur={() => (hover = null)}>
    <div class="fx-heat plot" bind:this={grid} style="--cols: {columns.length}; --rw: {rowCh}ch">
      <span></span>
      {#each columns as c, ci (ci)}<span class="hx" aria-hidden="true">{showCol(ci) ? c : ""}</span>{/each}
      {#each rows as r, ri (ri)}
        <span>{r.label}</span>
        {#each columns as c, ci (ci)}
          {@const v = r.cells[ci]}
          <i class={levelOf(v)} class:on={active?.[0] === ri && active?.[1] === ci && hover !== null} data-r={ri} data-c={ci} title="{label(r.label, c)}: {v === undefined ? 'not yet' : v === null ? 'no data' : fmt(v)}"></i>
        {/each}
      {/each}
    </div>
    <div class="fx-legend">
      <span>fewer</span><i></i><i class="h1"></i><i class="h2"></i><i class="h3"></i><i class="h4"></i><span>more</span>
      {#if has.none}<i class="none gap"></i><span>no data</span>{/if}
      {#if has.future}<i class="future gap"></i><span>not yet</span>{/if}
    </div>
  </div>
  {#snippet table()}<DataTable columns={[{ key: "row", label: "" }, ...columns.map((c) => ({ key: c, label: c, num: true }))]} rows={tableRows} caption={frame.title} />{/snippet}
</ChartCard>
