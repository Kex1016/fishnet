<script lang="ts">
  import { page } from "$app/state";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import { osHref } from "#lib/onesoul/links.ts";
  import { day } from "#lib/format/dates.ts";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();
  const reg = $derived(data.reg);
  const played = $derived(data.players.filter((p) => p.played).length);
</script>

<div class="fp-page">
  <section class="fp-section">
    <div class="fp-section__head">
      <h1 class="t-display">Sign-ups{#if reg?.ok}, round {reg.data.round}{/if}</h1>
      {#if reg?.ok}<AsOf at={reg.asOf} stale={reg.stale} />{/if}
    </div>
    <p class="t-body t-muted">Everyone who signed up, by name. The order of turns is drawn in secret and is not shown anywhere, not even by sign-up time.</p>
    {#if data.rounds.length > 1}
      <nav class="fp-seg" aria-label="Round">
        {#each data.rounds as r (r)}<a href={withParams(page.url, { round: String(r) })} aria-current={reg?.ok && r === reg.data.round ? "page" : undefined}>Round {r}</a>{/each}
      </nav>
    {/if}
  </section>
  {#if !reg || !reg.ok}
    <Notice kind="warning">Sign-ups could not be loaded right now.</Notice>
  {:else if data.players.length === 0}
    <EmptyState title="Nobody has signed up yet" line="Sign up in game with /onesoul join." />
  {:else}
    <p class="t-small t-muted"><span class="t-num">{reg.data.total}</span> signed up, <span class="t-num">{played}</span> had their turn.</p>
    <ul class="os-wall">
      {#each data.players as p (p.uuid)}
        <li>
          <a class="os-wall__p" href={osHref.player(p.uuid)}>
            <Face uuid={p.uuid} name={p.name} size="sm" />
            <span class="os-wall__name">{p.name}</span>
            {#if p.played}<span class="fp-tag">Played</span>{/if}
          </a>
          <span class="t-caption">since {day(p.registered_at)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .os-wall {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-3);
  }
  .os-wall li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-3);
    background: var(--surface);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-lg);
  }
  .os-wall__p {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text);
    text-decoration: none;
  }
  .os-wall__name {
    flex: 1;
    min-width: 0;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
</style>
