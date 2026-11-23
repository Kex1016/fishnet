<script lang="ts">
  // The heading line of a window: the heading on the left (Jacquard 24, foam), a small "as of" or count on
  // the right. `asof` is plain text; pass children instead for markup (an <AsOf>, a number in .num).
  import type { Snippet } from "svelte";
  let {
    title,
    href,
    level = 2,
    asof,
    id,
    children
  }: { title: string; href?: string; level?: 2 | 3; asof?: string; id?: string; children?: Snippet } = $props();
</script>

<div class="fx-wh">
  <svelte:element this={`h${level}`} {id}>{#if href}<a {href}>{title}</a>{:else}{title}{/if}</svelte:element>
  {#if children}<span class="asof">{@render children()}</span>{:else if asof}<span class="asof">{asof}</span>{/if}
</div>
