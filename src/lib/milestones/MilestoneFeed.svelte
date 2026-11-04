<script lang="ts">
  // W0 stub: the states (off/empty/down/rows) with the final copy; W7 replaces the row markup.
  import type { MilestoneFeedProps } from "./types.ts";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import { ago } from "#lib/format/dates.ts";
  import { titleCase } from "#lib/players/names.ts";
  let { result, title = "Latest milestones", href, showStat = true, showPlayer = true, limit = 10 }: MilestoneFeedProps = $props();
</script>

{#if result.ok || (!result.ok && result.kind !== "off")}
  <section class="fp-section">
    <div class="fp-section__head"><h2 class="t-title-3">{#if href}<a {href}>{title}</a>{:else}{title}{/if}</h2></div>
    {#if !result.ok}
      {#if result.kind === "down"}<Notice kind="warning"><b>cakeutils could not be reached.</b> Milestones will be back when it is.</Notice>
      {:else}<EmptyState title="No milestones yet" line="The first player to reach a threshold shows up here." />{/if}
    {:else if result.empty}
      <EmptyState title="No milestones yet" line="The first player to reach a threshold shows up here." />
    {:else}
      <ol class="fp-rows">
        {#each result.data.milestones.slice(0, limit) as m (m.metric + m.threshold)}
          <li class="fp-row" style="grid-template-columns: minmax(0, 1fr) auto">
            <span class="fp-row__name">
              {#if showPlayer}{m.name ?? (m.backfilled ? "Reached before tracking began" : "First player unknown")}{/if}
              {#if showStat}<span class="t-muted"> · {m.display} {m.stat_name ?? titleCase(m.subject)}</span>{/if}
            </span>
            <span class="fp-row__sub">{m.reached_at ? ago(m.reached_at) : m.backfilled ? "before tracking" : "—"}</span>
          </li>
        {/each}
      </ol>
    {/if}
  </section>
{/if}
