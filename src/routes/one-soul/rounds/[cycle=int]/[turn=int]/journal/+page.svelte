<script lang="ts">
  // Plain reading view of a journal: one API page is one page here. Every page is raw player text and is
  // rendered as text only.
  import { BookOpen } from "@lucide/svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import { osHref } from "#lib/onesoul/links.ts";
  import { dateTime } from "#lib/format/dates.ts";
  let { data } = $props();
  const j = $derived(data.journal);
</script>

<div class="fp-page">
  {#if !j}
    <Notice kind="warning">This journal could not be loaded right now.</Notice>
  {:else}
    <section class="fp-section">
      <div class="fp-section__head">
        <div>
          <span class="t-kicker">Journal · round {data.cycle}, turn {data.turn}</span>
          <h1 class="t-display os-title">{j.title ?? "Untitled journal"}</h1>
          <div class="t-small t-muted">by <a href={osHref.soul(data.cycle, data.turn)}>{j.soul.name}</a> · published {dateTime(j.published_at)}</div>
        </div>
        {#if data.asOf}<AsOf at={data.asOf} stale={data.stale} />{/if}
      </div>
    </section>
    {#if j.pages.length === 0}
      <EmptyState icon={BookOpen} title="The pages are blank" />
    {:else}
      <ol class="os-pages">
        {#each j.pages as text, i (i)}
          <li class="fp-card os-page">
            <span class="t-caption os-page__no">Page {i + 1} of {j.pages.length}</span>
            <p class="os-page__text">{text}</p>
          </li>
        {/each}
      </ol>
    {/if}
  {/if}
</div>

<style>
  .os-title {
    margin: var(--space-1) 0;
    overflow-wrap: anywhere;
  }
  .os-pages {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-4);
  }
  .os-page {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .os-page__no {
    color: var(--faint);
  }
  .os-page__text {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font: 400 15px/24px var(--font-text);
  }
</style>
