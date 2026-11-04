<script lang="ts">
  // W0 stub: an inline SVG box the size the sparkline will take (W3 draws the 2px line).
  import type { SparklineProps } from "./types.ts";
  let { points, width = 120, height = 28, label }: SparklineProps = $props();
</script>

<svg class="fp-spark" {width} {height} viewBox="0 0 {width} {height}" role="img" aria-label="{label}: {points.length} points">
  {#if points.length >= 2}
    <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="var(--line-soft)" />
  {:else}
    <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="var(--line-soft)" stroke-dasharray="2 3" />
  {/if}
</svg>
