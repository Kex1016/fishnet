<script lang="ts">
  // The advancement feed: who completed each advancement first, newest first (the API orders it). Renders
  // nothing when the proxy has no advancement milestones (`off`), a Notice when cakeutils is down, and every
  // empty state on purpose (PLAN §3.5).
  import type { AdvancementFeedProps } from "./types.ts";
  import Feed from "#lib/design/Feed.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import AdvancementItem from "./AdvancementItem.svelte";
  import MilestoneStatus from "./MilestoneStatus.svelte";
  import { advKey } from "./advancements.ts";
  let { result, title = "Latest advancements", href, showPlayer = true, showServer = true, serverNames = {}, limit = 10 }: AdvancementFeedProps = $props();
</script>

{#if result.ok || result.kind !== "off"}
  <Window path="~/advancements" args="| tail">
    <WindowHead {title} {href} asof="newest first" />
    <MilestoneStatus {result} what="advancements" emptyTitle="No advancements yet" emptyLine="The first player to complete an advancement shows up here.">
      {#snippet children(data)}
        <Feed label={title}>
          {#each data.milestones.slice(0, limit) as m (advKey(m))}
            <AdvancementItem {m} {showPlayer} {showServer} {serverNames} />
          {/each}
        </Feed>
      {/snippet}
    </MilestoneStatus>
  </Window>
{/if}
