<script lang="ts">
  // The milestone feed: newest first, backfilled last (the API orders it). Renders nothing when the proxy
  // has no milestones (`off`), a Notice when cakeutils is down, and every null on purpose (PLAN §3.5).
  import type { MilestoneFeedProps } from "./types.ts";
  import Feed from "#lib/design/Feed.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import MilestoneItem from "./MilestoneItem.svelte";
  import MilestoneStatus from "./MilestoneStatus.svelte";
  import { rowKey } from "./helpers.ts";
  let { result, title = "Latest milestones", href, showStat = true, showPlayer = true, limit = 10 }: MilestoneFeedProps = $props();
</script>

{#if result.ok || result.kind !== "off"}
  <Window path="~/milestones" args="| tail">
    <WindowHead {title} {href} asof="newest first" />
    <MilestoneStatus {result}>
      {#snippet children(data)}
        <Feed label={title}>
          {#each data.milestones.slice(0, limit) as m (rowKey(m))}
            <MilestoneItem {m} {showStat} {showPlayer} />
          {/each}
        </Feed>
      {/snippet}
    </MilestoneStatus>
  </Window>
{/if}
