<script lang="ts">
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import RoundCard from "#lib/onesoul/RoundCard.svelte";
  let { data } = $props();
</script>

<div class="fp-page">
  <section class="fp-section">
    <div class="fp-section__head">
      <h1 class="t-display">Rounds</h1>
      {#if data.rounds?.asOf}<AsOf at={data.rounds.asOf} stale={data.rounds.stale} />{/if}
    </div>
    <p class="t-body t-muted">Each round is a new world. When the souls run out, the old world is archived and a new round begins with sign-ups.</p>
    {#if data.rounds && !data.rounds.full}<Notice kind="info">These cards are counted from the souls alone. Graves and sign-ups per round show once the server sends round summaries.</Notice>{/if}
  </section>
  {#if !data.rounds || data.rounds.rounds.length === 0}
    <EmptyState title="No round has started yet" />
  {:else}
    <div class="os-rounds">
      {#each data.rounds.rounds as r (r.cycle)}<RoundCard {r} current={r.cycle === data.os?.cycle} />{/each}
    </div>
  {/if}
</div>

<style>
  .os-rounds {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-4);
  }
</style>
