<script lang="ts">
  import { page } from "$app/state";
  import { Tombstone } from "@lucide/svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import { dimLabel, life, titleId } from "#lib/onesoul/format.ts";
  import { osHref } from "#lib/onesoul/links.ts";
  import { day } from "#lib/format/dates.ts";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();
</script>

<div class="fp-page">
  <section class="fp-section">
    <div class="fp-section__head">
      <h1 class="t-display">Graveyard</h1>
      {#if data.graves?.ok}<AsOf at={data.graves.asOf} stale={data.graves.stale} />{/if}
    </div>
    <p class="t-body t-muted">When a soul dies for good, a grave keeps their items until someone claims it.</p>
    <div class="os-controls">
      <nav class="fp-seg" aria-label="Round">
        <a href={withParams(page.url, { round: null })} aria-current={data.round === null ? "page" : undefined}>All rounds</a>
        {#each data.rounds as r (r)}<a href={withParams(page.url, { round: String(r) })} aria-current={r === data.round ? "page" : undefined}>Round {r}</a>{/each}
      </nav>
      <nav class="fp-seg" aria-label="Claimed">
        <a href={withParams(page.url, { claimed: null })} aria-current={data.claimed === null ? "page" : undefined}>All</a>
        <a href={withParams(page.url, { claimed: "false" })} aria-current={data.claimed === false ? "page" : undefined}>Open</a>
        <a href={withParams(page.url, { claimed: "true" })} aria-current={data.claimed === true ? "page" : undefined}>Claimed</a>
      </nav>
    </div>
  </section>
  {#if !data.graves || !data.graves.ok}
    <Notice kind="warning">The graveyard could not be loaded right now.</Notice>
  {:else if data.graves.data.graves.length === 0}
    <EmptyState icon={Tombstone} title={data.claimed === null ? "No graves yet" : data.claimed ? "No grave has been claimed" : "No grave is open"} line="A grave appears where a soul dies for good." />
  {:else}
    <div class="os-graves">
      {#each data.graves.data.graves as g (g.id)}
        <article class="fp-card os-grave" data-claimed={g.claimed_by ? "yes" : "no"}>
          <header class="os-grave__head">
            <Tombstone class="fp-ico" strokeWidth={1.4} aria-hidden="true" />
            <a class="os-grave__name" href={osHref.soul(g.cycle, g.soul.turn)}>{g.soul.name}</a>
            <span class="fp-tag {g.claimed_by ? '' : 'fp-tag--acc'}">{g.claimed_by ? "Claimed" : "Open"}</span>
          </header>
          <div class="t-small t-muted">Round {g.cycle}, turn {g.soul.turn} · {day(g.created_at)}</div>
          <div class="t-small">{g.items} item{g.items === 1 ? "" : "s"}{#if g.marked}, {g.marked} marked with love{/if} · {dimLabel(g.dim)} <span class="t-num">{g.x} {g.y} {g.z}</span></div>
          {#if g.contents?.length}<div class="t-small t-muted os-grave__items">{g.contents.slice(0, 6).map((c) => `${c.count} × ${titleId(c.item)}`).join(" · ")}</div>{/if}
          {#if g.claimed_by}<div class="t-small">Claimed by <a href={osHref.player(g.claimed_by.uuid)}>{g.claimed_by.name}</a>{#if g.claimed_at} after {life(g.claimed_at - g.created_at)}{/if}</div>{/if}
        </article>
      {/each}
    </div>
    <Pager url={page.url} total={data.graves.data.total} limit={data.limit} offset={data.offset} what="graves" />
  {/if}
</div>

<style>
  .os-controls {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .os-graves {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space-4);
  }
  .os-grave {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .os-grave[data-claimed="no"] {
    border-color: var(--acc);
  }
  .os-grave__head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .os-grave__name {
    flex: 1;
    min-width: 0;
    font-weight: 600;
    color: var(--text);
    overflow-wrap: anywhere;
  }
  .os-grave__items {
    overflow-wrap: anywhere;
  }
</style>
