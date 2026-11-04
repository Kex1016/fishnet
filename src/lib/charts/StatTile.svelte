<script lang="ts">
  // A number that is the point (reki: t-stat, not a chart). Final markup; W3 adds the sparkline.
  import type { StatTileProps } from "./types.ts";
  import Sparkline from "./Sparkline.svelte";
  let { label, value, unit, note, href, spark, sparkLabel }: StatTileProps = $props();
</script>

<svelte:element this={href ? "a" : "div"} class="fp-tile" {href}>
  <span class="fp-tile__label">{label}</span>
  <span class="fp-tile__value">{value}{#if unit}<small>{unit}</small>{/if}</span>
  {#if note}<span class="fp-tile__note">{note}</span>{/if}
  {#if spark}<span class="fp-tile__spark"><Sparkline points={spark} label={sparkLabel ?? label} /></span>{/if}
</svelte:element>

<style>
  a.fp-tile { color: inherit; }
  a.fp-tile:hover { text-decoration: none; border-color: var(--line); background: var(--raised); }
</style>
