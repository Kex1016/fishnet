<script lang="ts">
  // The milestone feed: newest first, backfilled last (the API orders it). Renders nothing when the proxy
  // has no milestones (`off`), a Notice when cakeutils is down, and every null on purpose (PLAN §3.5).
  import type { MilestoneFeedProps } from "./types.ts";
  import MilestoneItem from "./MilestoneItem.svelte";
  import MilestoneStatus from "./MilestoneStatus.svelte";
  import { rowKey } from "./helpers.ts";
  let { result, title = "Latest milestones", href, showStat = true, showPlayer = true, limit = 10 }: MilestoneFeedProps = $props();
</script>

{#if result.ok || result.kind !== "off"}
  <section class="fp-section">
    <div class="fp-section__head"><h2 class="t-title-3">{#if href}<a {href}>{title}</a>{:else}{title}{/if}</h2></div>
    <MilestoneStatus {result}>
      {#snippet children(data)}
        <ol class="fp-rows">
          {#each data.milestones.slice(0, limit) as m (rowKey(m))}
            <MilestoneItem {m} {showStat} {showPlayer} />
          {/each}
        </ol>
      {/snippet}
    </MilestoneStatus>
  </section>
{/if}
