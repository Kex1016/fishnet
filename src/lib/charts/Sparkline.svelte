<script lang="ts">
  // A row of squares (haiiro: charts made of squares, never lines): no frame, no axes, the tile's note says what
  // it is. Heights run from the lowest to the highest value; the last bar is the current one, in gold.
  import type { SparklineProps } from "./types.ts";
  import { cleanTime, resample } from "./scale.ts";
  import "./charts.css";
  let { points, width = 120, height = 28, label }: SparklineProps = $props();
  const pts = $derived(cleanTime(points));
  // at most one bar per 3px: a 30 day series at 120px keeps every day, a year is averaged down
  const bars = $derived(resample(pts.map((p) => p.v), Math.floor(width / 3)));
  const max = $derived(bars.length ? Math.max(...bars) : 0);
  const min = $derived(bars.length ? Math.min(...bars) : 0);
  const px = (v: number) => (max > min ? 2 + ((v - min) / (max - min)) * (height - 2) : height / 2);
</script>

<span class="spark sized last{pts.length < 2 ? ' flat' : ''}" style="--sw: {width}px; height: {height}px" role="img" aria-label="{label}: {pts.length} points{pts.length ? `, latest ${pts[pts.length - 1].v}` : ''}">
  {#if pts.length >= 2}{#each bars as v, i (i)}<i style="height: {px(v).toFixed(1)}px"></i>{/each}{/if}
</span>
