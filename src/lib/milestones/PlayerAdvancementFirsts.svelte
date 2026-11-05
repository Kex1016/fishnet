<script lang="ts">
  // "First to complete": the advancements the viewed player completed before anyone else. The player
  // endpoint's rows carry no player; in the network scope each row says on which server it happened.
  import type { PlayerAdvancementFirstsProps } from "./types.ts";
  import AdvancementItem from "./AdvancementItem.svelte";
  import MilestoneStatus from "./MilestoneStatus.svelte";
  import { advKey } from "./advancements.ts";
  import { group } from "#lib/format/stat-display.ts";
  let { result, playerName, showServer = true, serverNames = {}, limit = 10 }: PlayerAdvancementFirstsProps = $props();
</script>

{#if result.ok || result.kind !== "off"}
  <section class="fp-section">
    <div class="fp-section__head">
      <h2 class="t-title-3">First to complete</h2>
      {#if result.ok && !result.empty}<span class="t-caption">{group(result.data.total)} advancement{result.data.total === 1 ? "" : "s"}</span>{/if}
    </div>
    <MilestoneStatus {result} what="advancements" emptyTitle="Not first to any advancement yet" emptyLine="{playerName} has not been the first to complete an advancement.">
      {#snippet children(data)}
        <ol class="fp-rows">
          {#each data.milestones.slice(0, limit) as m (advKey(m))}
            <AdvancementItem {m} showPlayer={false} {showServer} {serverNames} />
          {/each}
        </ol>
      {/snippet}
    </MilestoneStatus>
  </section>
{/if}
