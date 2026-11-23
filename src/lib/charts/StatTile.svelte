<script lang="ts">
  // A number that is the point: a hairline tile with a label, the value in Jacquard 24, a note and an optional
  // sparkline of squares. Put tiles in `<div class="stat-panel fx-tiles">`; a tile also stands alone.
  import type { StatTileProps } from "./types.ts";
  import Sparkline from "./Sparkline.svelte";
  import "./charts.css";
  let { label, value, unit, note, href, off, spark, sparkLabel }: StatTileProps = $props();
</script>

<svelte:element this={href ? "a" : "div"} class="fx-tile{off ? ' off' : ''}" {href}>
  <span class="kv_label">{label}</span>
  <span class="kv_value num">{value}{#if unit}<small>{unit}</small>{/if}</span>
  {#if note}<span class="note">{note}</span>{/if}
  {#if spark}<span class="fx-tile-spark"><Sparkline points={spark} label={sparkLabel ?? label} /></span>{/if}
</svelte:element>
