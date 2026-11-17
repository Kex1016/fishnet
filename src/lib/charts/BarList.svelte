<script lang="ts">
  // Ranked rows with bars (top 10 of a board): the longest bar is the top value, in one hue; the
  // highlighted row (the viewed player) takes acc-ink. The readout shows the top row. Every row is an
  // <li>; a row with a link holds the link, so the list stays a valid list.
  import type { BarListProps } from "./types.ts";
  import ChartCard from "./ChartCard.svelte";
  import DataTable from "./DataTable.svelte";
  import Face from "#lib/design/Face.svelte";
  import "./charts.css";
  let { rows, unit = "count", faces = false, highlight, ...frame }: BarListProps = $props();
  const empty = $derived(rows.length === 0);
  const top = $derived(rows[0]);
  const max = $derived(Math.max(0, ...rows.map((r) => r.v)));
  const pct = (v: number) => (max > 0 ? `${Math.max(0, Math.min(100, (v / max) * 100)).toFixed(1)}%` : "0%");
</script>

{#snippet row(r: BarListProps["rows"][number])}
  <span class="fp-row__rank" class:fp-row__rank--top={r.rank <= 3}>{r.rank}</span>
  {#if faces && r.uuid}<Face uuid={r.uuid} name={r.label} />{:else}<span></span>{/if}
  <span class="fp-row__name fp-row__name--bar"><span class="fp-row__text">{r.label}</span><span class="fp-bar" aria-hidden="true"><i style="width: {pct(r.v)}"></i></span></span>
  <span class="fp-row__value">{r.display}</span>
{/snippet}

<ChartCard {frame} {empty} readoutValue={top?.display} readoutLabel={top?.label}>
  <ol class="fp-rows" class:fp-rows--hi={highlight !== undefined && rows.some((r) => r.key === highlight)}>
    {#each rows as r (r.key)}
      {@const current = highlight === r.key ? "true" : undefined}
      {#if r.href}
        <li aria-current={current}><a class="fp-row" href={r.href}>{@render row(r)}</a></li>
      {:else}
        <li class="fp-row" aria-current={current}>{@render row(r)}</li>
      {/if}
    {/each}
  </ol>
  {#snippet table()}<DataTable columns={[{ key: "rank", label: "#", num: true }, { key: "label", label: "Player" }, { key: "display", label: frame.title, num: true }]} {rows} caption={frame.title} />{/snippet}
</ChartCard>

<style>
  :global(.fp-rows--hi .fp-bar > i) { opacity: 0.55; }
  :global(.fp-rows--hi [aria-current="true"] .fp-bar > i) { opacity: 1; }
  .fp-row__name--bar { display: flex; flex-direction: column; justify-content: center; }
  .fp-row__text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
