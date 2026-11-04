<script lang="ts">
  // An inline 2px line with a ringed end dot: no frame, no axes, the tile's note says what it is.
  import type { SparklineProps } from "./types.ts";
  import { areaPath, cleanTime, linePath, maxValue, xByTime, yOf } from "./scale.ts";
  import "./charts.css";
  let { points, width = 120, height = 28, label }: SparklineProps = $props();
  const pts = $derived(cleanTime(points));
  const max = $derived(maxValue(pts));
  const min = $derived(pts.length ? Math.min(...pts.map((p) => p.v)) : 0);
  const xs = $derived(xByTime(pts, 1, width - 5));
  const ys = $derived(pts.map((p) => (max > min ? yOf(p.v - min, max - min, 3, height - 3) : height / 2)));
</script>

<svg class="fp-spark" {width} {height} viewBox="0 0 {width} {height}" role="img" aria-label="{label}: {pts.length} points{pts.length ? `, latest ${pts[pts.length - 1].v}` : ''}">
  {#if pts.length >= 2}
    <path class="fp-spark__area" d={areaPath(xs, ys, height - 1)} />
    <path class="fp-spark__line" d={linePath(xs, ys)} />
    <circle class="fp-spark__dot" cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" />
  {:else}
    <line class="fp-spark__flat" x1="0" y1={height / 2} x2={width} y2={height / 2} />
  {/if}
</svg>
