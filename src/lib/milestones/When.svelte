<script lang="ts">
  // Internal: the right-hand moment of a row. A time (hover for the full date), "Reached before tracking
  // began" (backfilled, no time), or "Not reached yet". Imported times are tagged: live tracking did not see them.
  import { dateTime, ago, iso } from "#lib/format/dates.ts";
  import type { When } from "./helpers.ts";
  let { when, imported = false }: { when: When; imported?: boolean } = $props();
</script>

<span class="when">
  {#if when.state === "at"}<time datetime={iso(when.at)} title={dateTime(when.at)}>{ago(when.at)}</time>
  {:else if when.state === "before"}<span class="long">Reached before tracking began</span>
  {:else}<span class="long">Not reached yet</span>{/if}
  {#if imported}<span class="chip" title="The time comes from the server's world files: this was done before live tracking began.">imported</span>{/if}
</span>

<style>
  .when { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; max-width: 18ch; }
  .long { white-space: normal; }
</style>
