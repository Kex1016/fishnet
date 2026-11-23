<script lang="ts">
  // Ranked rows (leaderboards, bar lists): rank, face, name, a bar for the share of the leader, the value.
  // The top three carry a star and their own ink (gold, iris, foam). `share` is 0..1 of the widest bar; the
  // caller computes it inside one scope (never across scopes). `compact` drops the bar; a phone always does.
  import type { RankRow } from "./types.ts";
  import Face from "./Face.svelte";
  let { rows, compact = false, label }: { rows: RankRow[]; compact?: boolean; label?: string } = $props();
  const faces = $derived(rows.some((r) => r.uuid));
  const posClass = (rank: number) => (rank === 1 ? "pos g" : rank === 2 ? "pos i" : rank === 3 ? "pos f" : "pos");
  const posText = (rank: number) => (rank <= 0 ? "" : rank <= 3 ? `★${rank}` : String(rank));
  const width = (share: number | undefined) => `${Math.round(Math.max(0, Math.min(1, share ?? 0)) * 1000) / 10}%`;
</script>

{#snippet cells(r: RankRow)}
  <span class="{posClass(r.rank)} num">{posText(r.rank)}</span>
  {#if faces}{#if r.uuid}<Face uuid={r.uuid} size="sm" />{:else}<span></span>{/if}{/if}
  <span class="who">{r.label}{#if r.sub}<span class="sub">{r.sub}</span>{/if}</span>
  {#if !compact}<span class="bar"><i style="width: {width(r.share)}"></i></span>{/if}
  <span class="val">{r.value}</span>
{/snippet}

<div class="fx-rank{compact ? ' compact' : ''}{faces ? '' : ' bare'}" aria-label={label}>
  {#each rows as r (r.key)}
    {#if r.href}
      <a class="row" href={r.href} aria-current={r.current ? "true" : undefined}>{@render cells(r)}</a>
    {:else}
      <div class="row" aria-current={r.current ? "true" : undefined}>{@render cells(r)}</div>
    {/if}
  {/each}
</div>
