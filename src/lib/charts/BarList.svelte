<script lang="ts">
  // Ranked rows with bars (top 10 of a board). W0 renders the rows without bars; W3 adds the bars.
  import type { BarListProps } from "./types.ts";
  import ChartCard from "./ChartCard.svelte";
  import DataTable from "./DataTable.svelte";
  import Face from "#lib/design/Face.svelte";
  let { rows, unit = "count", faces = false, highlight, ...frame }: BarListProps = $props();
  const empty = $derived(rows.length === 0);
  const top = $derived(rows[0]);
</script>

<ChartCard {frame} {empty} readoutValue={top?.display} readoutLabel={top?.label}>
  <ol class="fp-rows">
    {#each rows as r (r.key)}
      <svelte:element this={r.href ? "a" : "li"} href={r.href} class="fp-row" aria-current={highlight === r.key ? "true" : undefined}>
        <span class="fp-row__rank" class:fp-row__rank--top={r.rank <= 3}>{r.rank}</span>
        {#if faces && r.uuid}<Face uuid={r.uuid} name={r.label} />{:else}<span></span>{/if}
        <span class="fp-row__name">{r.label}</span>
        <span class="fp-row__value">{r.display}</span>
      </svelte:element>
    {/each}
  </ol>
  {#snippet table()}<DataTable columns={[{ key: "rank", label: "#", num: true }, { key: "label", label: "Player" }, { key: "display", label: frame.title, num: true }]} {rows} caption={frame.title} />{/snippet}
</ChartCard>
