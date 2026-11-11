<script lang="ts">
  import { BookOpen } from "@lucide/svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import { StatTile } from "#lib/charts/index.ts";
  import Outcome from "#lib/onesoul/Outcome.svelte";
  import { life } from "#lib/onesoul/format.ts";
  import { osHref } from "#lib/onesoul/links.ts";
  import { day } from "#lib/format/dates.ts";
  let { data } = $props();
  const p = $derived(data.p);
  const lived = $derived(p.turns.filter((t) => t.outcome !== "playing" && t.duration_ms !== null).length);
  const rounds = $derived([...new Set([...p.registrations.map((r) => r.round), ...p.turns.map((t) => t.cycle)])].sort((a, b) => a - b));
</script>

<div class="fp-page">
  <section class="fp-section">
    <div class="os-who">
      <Face uuid={p.uuid} name={p.name} size="lg" />
      <div>
        <span class="t-kicker">One Soul</span>
        <h1 class="t-display os-who__name">{p.name}</h1>
        <div class="t-small t-muted">
          {#if rounds.length}Signed up for {rounds.length === 1 ? "round" : "rounds"} {rounds.join(", ")}{" · "}{/if}<a href={`/players/${p.uuid}`}>Network profile</a>
        </div>
        {#if data.asOf}<AsOf at={data.asOf} />{/if}
      </div>
    </div>
    <div class="fp-tiles os-tiles">
      <StatTile label="Turns" value={String(p.turns.length)} note={lived === p.turns.length ? undefined : `${lived} finished`} />
      <StatTile label="Longest life" value={p.best ? life(p.best.duration_ms) : "–"} note={p.best ? `round ${p.best.cycle}, turn ${p.best.turn}` : "no finished turn yet"} />
      <StatTile label="Graves claimed" value={String(p.graves_claimed)} />
      <StatTile label="Graves left unclaimed" value={String(p.graves_left_open)} />
      <StatTile label="Journals" value={String(p.journals)} />
      {#if data.full}<StatTile label="Pranks as a ghost" value={String(p.pranks.total)} note="finished rounds only" />{/if}
    </div>
  </section>

  <section class="fp-section">
    <h2 class="t-title-3">Turns</h2>
    {#if p.turns.length === 0}
      <EmptyState title="No turn yet" line="A turn starts when this player becomes the soul." />
    {:else}
      <ol class="fp-card os-turns">
        {#each p.turns as t (`${t.cycle}/${t.turn}`)}
          <li class="os-turn">
            <span class="os-turn__head"><a href={osHref.soul(t.cycle, t.turn)}>Round {t.cycle}, turn {t.turn}</a><span class="t-caption">{day(t.started_at)}</span></span>
            <span class="t-num os-turn__lived">{t.outcome === "playing" ? "still alive" : life(t.duration_ms)}</span>
            <span class="os-turn__more">
              <Outcome outcome={t.outcome} />
              {#if t.cause}<q class="os-cause">{t.cause}</q>{/if}
              {#if t.has_journal && t.outcome !== "playing"}<a class="fp-chip" href={osHref.journal(t.cycle, t.turn)}><BookOpen class="fp-ico fp-ico--sm" strokeWidth={1.4} />Journal</a>{/if}
            </span>
          </li>
        {/each}
      </ol>
    {/if}
  </section>
</div>

<style>
  .os-who {
    display: flex;
    gap: var(--space-4);
    align-items: center;
    flex-wrap: wrap;
  }
  .os-who > div {
    flex: 1;
    min-width: 0;
  }
  .os-who__name {
    margin: var(--space-1) 0;
    overflow-wrap: anywhere;
  }
  .os-tiles {
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  }
  .os-turns {
    list-style: none;
    margin: 0;
    padding: 0 var(--space-4);
  }
  .os-turn {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-1) var(--space-3);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--line-soft);
  }
  .os-turn:last-child {
    border-bottom: 0;
  }
  .os-turn__head {
    display: flex;
    flex-direction: column;
  }
  .os-turn__head a {
    font-weight: 600;
    color: var(--text);
  }
  .os-turn__more {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-3);
    align-items: center;
  }
  .os-cause {
    color: var(--muted);
    font-style: italic;
    overflow-wrap: anywhere;
  }
</style>
