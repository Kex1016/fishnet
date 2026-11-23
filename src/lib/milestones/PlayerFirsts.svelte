<script lang="ts">
  // "First to": what the viewed player was first to reach. The player endpoint's rows carry no player.
  import type { PlayerFirstsProps } from "./types.ts";
  import Feed from "#lib/design/Feed.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import MilestoneItem from "./MilestoneItem.svelte";
  import MilestoneStatus from "./MilestoneStatus.svelte";
  import { rowKey } from "./helpers.ts";
  import { group } from "#lib/format/stat-display.ts";
  let { result, playerName, limit = 10 }: PlayerFirstsProps = $props();
</script>

{#if result.ok || result.kind !== "off"}
  <Window path="~/milestones" args="--first">
    <WindowHead title="First to" asof={result.ok && !result.empty ? `${group(result.data.total)} in total` : undefined} />
    <MilestoneStatus {result} emptyTitle="Not first to anything yet" emptyLine="{playerName} has not been the first to reach a milestone.">
      {#snippet children(data)}
        <Feed label="First to">
          {#each data.milestones.slice(0, limit) as m (rowKey(m))}
            <MilestoneItem {m} showPlayer={false} {playerName} />
          {/each}
        </Feed>
      {/snippet}
    </MilestoneStatus>
  </Window>
{/if}
