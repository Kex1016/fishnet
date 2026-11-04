<script lang="ts">
  // "as of 17:44 UTC": when the data was fetched. Pages show it beside anything served stale.
  import { asOf, iso } from "#lib/format/dates.ts";
  let { at, stale = false }: { at: number; stale?: boolean } = $props();
</script>

<time class="fp-asof" datetime={iso(at)} title={stale ? "cakeutils could not be reached; this is the last good answer" : undefined}>{stale ? "last good data " : ""}{asOf(at)}</time>
