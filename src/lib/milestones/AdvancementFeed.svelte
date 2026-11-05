<script lang="ts">
  // The advancement feed: who completed each advancement first, newest first (the API orders it). Renders
  // nothing when the proxy has no advancement milestones (`off`), a Notice when cakeutils is down, and every
  // empty state on purpose (PLAN §3.5).
  import type { AdvancementFeedProps } from "./types.ts";
  import AdvancementItem from "./AdvancementItem.svelte";
  import MilestoneStatus from "./MilestoneStatus.svelte";
  import { advKey } from "./advancements.ts";
  let { result, title = "Latest advancements", href, showPlayer = true, showServer = true, serverNames = {}, limit = 10 }: AdvancementFeedProps = $props();
</script>

{#if result.ok || result.kind !== "off"}
  <section class="fp-section">
    <div class="fp-section__head"><h2 class="t-title-3">{#if href}<a {href}>{title}</a>{:else}{title}{/if}</h2></div>
    <MilestoneStatus {result} what="advancements" emptyTitle="No advancements yet" emptyLine="The first player to complete an advancement shows up here.">
      {#snippet children(data)}
        <ol class="fp-rows">
          {#each data.milestones.slice(0, limit) as m (advKey(m))}
            <AdvancementItem {m} {showPlayer} {showServer} {serverNames} />
          {/each}
        </ol>
      {/snippet}
    </MilestoneStatus>
  </section>
{/if}
