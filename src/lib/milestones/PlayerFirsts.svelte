<script lang="ts">
  // "First to": what the viewed player was first to reach. The player endpoint's rows carry no player.
  import type { PlayerFirstsProps } from "./types.ts";
  import MilestoneItem from "./MilestoneItem.svelte";
  import MilestoneStatus from "./MilestoneStatus.svelte";
  import { rowKey } from "./helpers.ts";
  import { group } from "#lib/format/stat-display.ts";
  let { result, playerName, limit = 10 }: PlayerFirstsProps = $props();
</script>

{#if result.ok || result.kind !== "off"}
  <section class="fp-section">
    <div class="fp-section__head">
      <h2 class="t-title-3">First to</h2>
      {#if result.ok && !result.empty}<span class="t-caption">{group(result.data.total)} in total</span>{/if}
    </div>
    <MilestoneStatus {result} emptyTitle="Not first to anything yet" emptyLine="{playerName} has not been the first to reach a milestone.">
      {#snippet children(data)}
        <ol class="fp-rows">
          {#each data.milestones.slice(0, limit) as m (rowKey(m))}
            <MilestoneItem {m} showPlayer={false} {playerName} />
          {/each}
        </ol>
      {/snippet}
    </MilestoneStatus>
  </section>
{/if}
