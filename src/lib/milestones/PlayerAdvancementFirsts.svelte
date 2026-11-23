<script lang="ts">
  // "First to complete": the advancements the viewed player completed before anyone else. The player
  // endpoint's rows carry no player; in the network scope each row says on which server it happened.
  import type { PlayerAdvancementFirstsProps } from "./types.ts";
  import Feed from "#lib/design/Feed.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import AdvancementItem from "./AdvancementItem.svelte";
  import MilestoneStatus from "./MilestoneStatus.svelte";
  import { advKey } from "./advancements.ts";
  import { group } from "#lib/format/stat-display.ts";
  let { result, playerName, showServer = true, serverNames = {}, limit = 10 }: PlayerAdvancementFirstsProps = $props();
</script>

{#if result.ok || result.kind !== "off"}
  <Window path="~/advancements" args="--first">
    <WindowHead title="First to complete" asof={result.ok && !result.empty ? `${group(result.data.total)} advancement${result.data.total === 1 ? "" : "s"}` : undefined} />
    <MilestoneStatus {result} what="advancements" emptyTitle="Not first to any advancement yet" emptyLine="{playerName} has not been the first to complete an advancement.">
      {#snippet children(data)}
        <Feed label="First to complete">
          {#each data.milestones.slice(0, limit) as m (advKey(m))}
            <AdvancementItem {m} showPlayer={false} {showServer} {serverNames} />
          {/each}
        </Feed>
      {/snippet}
    </MilestoneStatus>
  </Window>
{/if}
