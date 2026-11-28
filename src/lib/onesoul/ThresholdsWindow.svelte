<script lang="ts">
  // One round's steps into the Nether and the End, as feed rows (EventRow). A running round shows who and when,
  // never where: the rows carry no place, and EventRow draws none.
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import EventRow from "./EventRow.svelte";
  import type { OsEvent } from "./types.ts";
  let { cycle, events, asOf, stale = false }: { cycle: number; events: OsEvent[]; asOf: number; stale?: boolean } = $props();
</script>

<Window path="~/one-soul/rounds/{cycle}" args="--thresholds">
  <WindowHead title="Nether and End"><AsOf at={asOf} {stale} /></WindowHead>
  {#if events.length === 0}
    <EmptyState title="Nobody has been past the Overworld yet" line="The first stable Nether portal, the first soul in the Nether, an open End portal and the first soul in the End show up here." />
  {:else}
    <div class="fx-feed">
      {#each events as e, i (i)}<EventRow {e} now={asOf} />{/each}
    </div>
  {/if}
</Window>
