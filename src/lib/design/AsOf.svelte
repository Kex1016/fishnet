<script lang="ts">
  // "as of 17:44 CET": when the data was fetched. Pages show it beside anything served stale; it goes in a
  // WindowHead (as its children) or a window's foot.
  import { asOf, iso } from "#lib/format/dates.ts";
  let { at, stale = false }: { at: number; stale?: boolean } = $props();
</script>

<time class="asof{stale ? ' stale' : ''}" datetime={iso(at)} title={stale ? "cakeutils could not be reached; this is the last good answer" : undefined}>{stale ? "last good data " : ""}{asOf(at)}</time>
