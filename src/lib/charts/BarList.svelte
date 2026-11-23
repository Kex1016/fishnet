<script lang="ts">
  // Ranked rows with bars (top 10 of a board), drawn by haiiro's RankList: a star and gold, iris or foam for the
  // top three, the bar against the leader, the value on the right. The highlighted row (the viewed player) is
  // marked. The readout shows the top row. The bar is the share of the leader inside this one list.
  import type { BarListProps } from "./types.ts";
  import ChartCard from "./ChartCard.svelte";
  import DataTable from "./DataTable.svelte";
  import RankList from "#lib/design/RankList.svelte";
  import type { RankRow } from "#lib/design/types.ts";
  import "./charts.css";
  let { rows, unit: _unit, faces = false, highlight, ...frame }: BarListProps = $props();
  const empty = $derived(rows.length === 0);
  const top = $derived(rows[0]);
  const max = $derived(Math.max(0, ...rows.map((r) => r.v)));
  const ranked = $derived<RankRow[]>(
    rows.map((r) => ({
      key: r.key,
      rank: r.rank,
      label: r.label,
      href: r.href,
      uuid: faces ? r.uuid : undefined,
      share: max > 0 ? Math.max(0, Math.min(1, r.v / max)) : 0,
      value: r.display,
      current: highlight === r.key
    }))
  );
</script>

<ChartCard {frame} {empty} readoutValue={top?.display} readoutLabel={top?.label}>
  <RankList rows={ranked} label={frame.title} />
  {#snippet table()}<DataTable columns={[{ key: "rank", label: "#", num: true }, { key: "label", label: "Player" }, { key: "display", label: frame.title, num: true }]} {rows} caption={frame.title} />{/snippet}
</ChartCard>
