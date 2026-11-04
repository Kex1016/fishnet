<script lang="ts">
  // W0 stub (W3 draws the acc-heat-1..4 grid with sunk empties and hairline future cells).
  import type { HeatmapProps } from "./types.ts";
  import ChartCard from "./ChartCard.svelte";
  import DataTable from "./DataTable.svelte";
  import { formatStat } from "#lib/format/stat-display.ts";
  let { rows, columns, unit = "count", format, cellLabel, ...frame }: HeatmapProps = $props();
  const fmt = $derived(format ?? ((v: number) => formatStat(unit, v)));
  const empty = $derived(rows.every((r) => r.cells.every((c) => c === null || c === undefined)));
  const tableRows = $derived(rows.map((r) => Object.fromEntries([["row", r.label], ...columns.map((c, i) => [c, r.cells[i] == null ? "—" : fmt(r.cells[i] as number)])])));
</script>

<ChartCard {frame} {empty}>
  <div class="fp-chart__stub" style="height: 160px" role="img" aria-label="{frame.title}: {rows.length} rows by {columns.length} columns">
    <span class="t-caption">Heatmap: W3</span>
  </div>
  {#snippet table()}<DataTable columns={[{ key: "row", label: "" }, ...columns.map((c) => ({ key: c, label: c, num: true }))]} rows={tableRows} caption={frame.title} />{/snippet}
</ChartCard>

<style>
  .fp-chart__stub { display: grid; place-items: center; background: var(--sunk); border-radius: var(--radius-lg); }
</style>
