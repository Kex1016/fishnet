<script lang="ts">
  // W0 stub (W3 draws the real columns): the frame, the readout, the empty state and the table twin.
  import type { ColumnChartProps } from "./types.ts";
  import ChartCard from "./ChartCard.svelte";
  import DataTable from "./DataTable.svelte";
  import { formatStat } from "#lib/format/stat-display.ts";
  import { day } from "#lib/format/dates.ts";
  let { points, unit = "count", format, height = 160, highlight, ...frame }: ColumnChartProps = $props();
  const fmt = $derived(format ?? ((v: number) => formatStat(unit, v)));
  const rows = $derived(points.map((p) => ("key" in p ? { label: p.label, value: p.display ?? fmt(p.v), key: p.key } : { label: p.label ?? day(p.t), value: fmt(p.v), key: String(p.t) })));
  const empty = $derived(points.length < 2);
  const last = $derived(rows.at(-1));
</script>

<ChartCard {frame} {empty} readoutValue={last?.value} readoutLabel={last?.label}>
  <div class="fp-chart__stub" style="height: {height}px" role="img" aria-label="{frame.title}: {rows.length} columns">
    <span class="t-caption">Column chart: W3</span>
  </div>
  {#snippet table()}<DataTable columns={[{ key: "label", label: "" }, { key: "value", label: frame.title, num: true }]} {rows} caption={frame.title} />{/snippet}
</ChartCard>

<style>
  .fp-chart__stub { display: grid; place-items: center; background: var(--sunk); border-radius: var(--radius-lg); }
</style>
