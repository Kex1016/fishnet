<script lang="ts">
  // W0 stub (W3 draws the 2px line with ringed end dots).
  import type { LineChartProps } from "./types.ts";
  import ChartCard from "./ChartCard.svelte";
  import DataTable from "./DataTable.svelte";
  import { formatStat } from "#lib/format/stat-display.ts";
  import { dateTime } from "#lib/format/dates.ts";
  let { points, unit = "count", format, height = 160, zero = true, shadow, ...frame }: LineChartProps = $props();
  const fmt = $derived(format ?? ((v: number) => formatStat(unit, v)));
  const rows = $derived(points.map((p) => ({ when: p.label ?? dateTime(p.t), value: fmt(p.v) })));
  const empty = $derived(points.length < 2);
  const last = $derived(rows.at(-1));
</script>

<ChartCard {frame} {empty} readoutValue={last?.value} readoutLabel={last?.when}>
  <div class="fp-chart__stub" style="height: {height}px" role="img" aria-label="{frame.title}: {points.length} points">
    <span class="t-caption">Line chart: W3</span>
  </div>
  {#snippet table()}<DataTable columns={[{ key: "when", label: "When" }, { key: "value", label: frame.title, num: true }]} {rows} caption={frame.title} />{/snippet}
</ChartCard>

<style>
  .fp-chart__stub { display: grid; place-items: center; background: var(--sunk); border-radius: var(--radius-lg); }
</style>
