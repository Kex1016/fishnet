<script lang="ts">
  // haiiro's Segmented: a choice of a few words, the current one on a pine band. Links that keep the page's
  // other search params are built by the caller (src/lib/url.ts withParams). An option without an href is
  // shown but cannot be chosen.
  import type { SegmentedOption } from "./types.ts";
  let {
    label,
    options
  }: { label: string; options: SegmentedOption[] } = $props();
</script>

<nav class="seg" aria-label={label}>
  {#each options as o (o.href ?? o.label)}
    {#if o.href}<a href={o.href} title={o.title} aria-current={o.current ? "page" : undefined}>{o.label}</a>{:else}<span title={o.title} aria-current={o.current ? "page" : undefined}>{o.label}</span>{/if}
  {/each}
</nav>
