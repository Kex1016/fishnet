<script lang="ts">
  // The list a feed's rows sit in (milestones, advancements, firsts, events): hairlines between FeedRows.
  import type { Snippet } from "svelte";
  let { label, children }: { label?: string; children: Snippet } = $props();
</script>

<div class="fx-feed" aria-label={label}>{@render children()}</div>
