<script lang="ts">
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import OsTabs from "#lib/onesoul/OsTabs.svelte";
  import RoundCard from "#lib/onesoul/RoundCard.svelte";
  let { data } = $props();
</script>

<PageHead path="~/one-soul" cmd="ls" args="rounds/" title="rounds" lede="Each round is a new world. When the souls run out, the old world is archived and a new round begins with sign-ups.">
  <OsTabs />
</PageHead>

{#if data.rounds && !data.rounds.full}<Notice kind="info">These cards are counted from the souls alone. Graves and sign-ups per round show once the server sends round summaries.</Notice>{/if}
{#if !data.rounds || data.rounds.rounds.length === 0}
  <EmptyState title="No round has started yet" />
{:else}
  <div class="os-cards">
    {#each data.rounds.rounds as r (r.cycle)}<RoundCard {r} current={r.cycle === data.os?.cycle} />{/each}
  </div>
{/if}

<style>
  .os-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    gap: 40px 32px;
  }
</style>
