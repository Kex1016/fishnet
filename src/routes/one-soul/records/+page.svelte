<script lang="ts">
  import { BookOpen, Ghost, Hourglass, Tombstone, Trophy } from "@lucide/svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import { life } from "#lib/onesoul/format.ts";
  import { osHref } from "#lib/onesoul/links.ts";
  import { day } from "#lib/format/dates.ts";
  let { data } = $props();
</script>

<div class="fp-page">
  <section class="fp-section">
    <div class="fp-section__head">
      <h1 class="t-display">Records</h1>
      {#if data.ok && data.asOf}<AsOf at={data.asOf} stale={data.stale} />{/if}
    </div>
    <p class="t-body t-muted">The longest lives and the kindest strangers, over every round. A soul who is still playing joins these lists once their turn is over.</p>
    {#if data.ok && data.capped}<Notice kind="info">Only the first 500 lives are counted here.</Notice>{/if}
  </section>

  {#if !data.ok}
    <Notice kind="warning">The records could not be loaded right now.</Notice>
  {:else}
    <div class="os-grid">
      <section class="fp-card os-rec">
        <h2 class="t-title-3"><Hourglass class="fp-ico" strokeWidth={1.4} aria-hidden="true" />Longest lives</h2>
        {#if data.longest.length === 0}
          <EmptyState title="No life has ended yet" />
        {:else}
          <ol class="os-list">
            {#each data.longest as s, i (`${s.cycle}/${s.turn}`)}
              <li>
                <span class="os-rank t-num">{i + 1}</span>
                <Face uuid={s.uuid} name={s.name} size="sm" />
                <span class="os-name"><a href={osHref.soul(s.cycle, s.turn)}>{s.name}</a><span class="t-caption">round {s.cycle}, turn {s.turn}</span></span>
                <span class="t-num">{life(s.duration_ms)}</span>
              </li>
            {/each}
          </ol>
        {/if}
      </section>

      <section class="fp-card os-rec">
        <h2 class="t-title-3"><Trophy class="fp-ico" strokeWidth={1.4} aria-hidden="true" />Best of each round</h2>
        {#if data.rounds.length === 0}
          <EmptyState title="No round has a finished life yet" />
        {:else}
          <ol class="os-list">
            {#each data.rounds as r (r.cycle)}
              {@const l = r.longest!}
              <li>
                <span class="os-rank t-num">R{r.cycle}</span>
                <Face uuid={l.uuid} name={l.name} size="sm" />
                <span class="os-name"><a href={osHref.soul(r.cycle, l.turn)}>{l.name}</a><span class="t-caption">{r.souls} soul{r.souls === 1 ? "" : "s"}{r.ended_at ? "" : ", still running"}</span></span>
                <span class="t-num">{life(l.duration_ms)}</span>
              </li>
            {/each}
          </ol>
        {/if}
      </section>

      <section class="fp-card os-rec">
        <h2 class="t-title-3"><Tombstone class="fp-ico" strokeWidth={1.4} aria-hidden="true" />Graves claimed for others</h2>
        {#if !data.gravesOk}
          <Notice kind="warning">Graves could not be loaded right now.</Notice>
        {:else if data.claimers.length === 0}
          <EmptyState title="Nobody has claimed someone else's grave yet" />
        {:else}
          <ol class="os-list">
            {#each data.claimers as c, i (c.uuid)}
              <li>
                <span class="os-rank t-num">{i + 1}</span>
                <Face uuid={c.uuid} name={c.name} size="sm" />
                <span class="os-name"><a href={osHref.player(c.uuid)}>{c.name}</a><span class="t-caption">{c.items} item{c.items === 1 ? "" : "s"} recovered</span></span>
                <span class="t-num">{c.graves}</span>
              </li>
            {/each}
          </ol>
        {/if}
      </section>

      {#if data.haunts.length}
        <section class="fp-card os-rec">
          <h2 class="t-title-3"><Ghost class="fp-ico" strokeWidth={1.4} aria-hidden="true" />Busiest ghost of each round</h2>
          <ol class="os-list">
            {#each data.haunts as h (h.cycle)}
              <li>
                <span class="os-rank t-num">R{h.cycle}</span>
                <Face uuid={h.ghost.uuid} name={h.ghost.name} size="sm" />
                <span class="os-name"><a href={osHref.player(h.ghost.uuid)}>{h.ghost.name}</a><span class="t-caption"><a href={osHref.round(h.cycle)}>round {h.cycle}</a></span></span>
                <span class="t-num">{h.ghost.total} prank{h.ghost.total === 1 ? "" : "s"}</span>
              </li>
            {/each}
          </ol>
        </section>
      {/if}

      <section class="fp-card os-rec">
        <h2 class="t-title-3"><BookOpen class="fp-ico" strokeWidth={1.4} aria-hidden="true" />Journals</h2>
        {#if data.journals.length === 0}
          <EmptyState title="No journal yet" line="A soul can write a journal; it is published when their turn ends." />
        {:else}
          <ul class="os-list">
            {#each data.journals as s (`${s.cycle}/${s.turn}`)}
              <li>
                <Face uuid={s.uuid} name={s.name} size="sm" />
                <span class="os-name"><a href={osHref.journal(s.cycle, s.turn)}>{s.name}</a><span class="t-caption">round {s.cycle}, turn {s.turn}{s.ended_at ? `, ${day(s.ended_at)}` : ""}</span></span>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>
  {/if}
</div>

<style>
  .os-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--space-4);
  }
  @media (max-width: 400px) {
    .os-grid {
      grid-template-columns: 1fr;
    }
  }
  .os-rec {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .os-rec h2 {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
  }
  .os-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .os-list li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .os-rank {
    width: 2.5ch;
    color: var(--faint);
  }
  .os-name {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow-wrap: anywhere;
  }
</style>
