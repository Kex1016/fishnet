<script lang="ts">
  // W0 stub: states and rows; W7 draws the ladder (reached rungs, the next one, backfilled marks).
  import type { MilestoneLadderProps } from "./types.ts";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import { day } from "#lib/format/dates.ts";
  let { result, statName }: MilestoneLadderProps = $props();
</script>

{#if !result.ok}
  {#if result.kind === "not_found"}<EmptyState title="Nobody has done this yet" line={statName ? `${statName} has no milestones until someone records it.` : undefined} />
  {:else if result.kind === "down"}<Notice kind="warning"><b>cakeutils could not be reached.</b> The ladder will be back when it is.</Notice>
  {:else if result.kind !== "off"}<EmptyState title="No milestones for this stat" />{/if}
{:else if !result.data.tracked}
  <EmptyState title="No milestones for this stat" line="Time and damage stats have no ladder." />
{:else}
  <ol class="fp-rows">
    {#each result.data.milestones as m (m.threshold)}
      <li class="fp-row" style="grid-template-columns: 90px minmax(0, 1fr) auto">
        <span class="fp-row__value">{m.display}</span>
        <span class="fp-row__name">{m.name ?? (m.backfilled ? "Reached before tracking began" : m.reached_at ? "First player unknown" : "Not reached yet")}</span>
        <span class="fp-row__sub">{m.reached_at ? day(m.reached_at) : ""}</span>
      </li>
    {/each}
  </ol>
{/if}
