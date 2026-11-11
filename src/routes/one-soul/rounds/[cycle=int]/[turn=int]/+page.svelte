<script lang="ts">
  import { BookOpen, Tombstone } from "@lucide/svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import { StatTile } from "#lib/charts/index.ts";
  import Outcome from "#lib/onesoul/Outcome.svelte";
  import { dimLabel, life, titleId } from "#lib/onesoul/format.ts";
  import { osHref } from "#lib/onesoul/links.ts";
  import { dateTime, day } from "#lib/format/dates.ts";
  import { subjectLabel, typeLabel } from "#lib/format/labels.ts";
  let { data } = $props();
  const s = $derived(data.soul);
  const byType = $derived.by(() => {
    const m = new Map<string, NonNullable<typeof data.stats>["stats"]>();
    for (const r of data.stats?.stats ?? []) m.set(r.type, [...(m.get(r.type) ?? []), r]);
    return [...m.entries()].map(([type, rows]) => ({ type, rows: [...rows].sort((a, b) => b.value - a.value) }));
  });
  const scr = $derived(s.second_chance_result ?? null);
</script>

<div class="fp-page">
  <section class="fp-section">
    <div class="os-who">
      <Face uuid={s.uuid} name={s.name} size="lg" />
      <div>
        <span class="t-kicker">Round {data.cycle} · turn {data.turn}</span>
        <h1 class="t-display os-who__name"><a href={osHref.player(s.uuid)}>{s.name}</a></h1>
        <div class="os-chips">
          <Outcome outcome={s.outcome} />
          {#if s.second_chance}<span class="fp-tag fp-tag--warning">Had a second chance</span>{/if}
          {#if s.has_journal}<a class="fp-chip" href={osHref.journal(s.cycle, s.turn)}><BookOpen class="fp-ico fp-ico--sm" strokeWidth={1.4} />Read the journal</a>{/if}
        </div>
      </div>
    </div>
    {#if s.cause}<blockquote class="os-cause">{s.cause}</blockquote>{/if}
    <div class="fp-tiles os-tiles">
      <StatTile label={data.playing ? "Turn started" : "Lived"} value={data.playing ? day(s.started_at) : life(s.duration_ms)} note={data.playing ? undefined : `${day(s.started_at)} to ${s.ended_at ? day(s.ended_at) : "?"}`} />
      {#if s.death && !data.playing}<StatTile label="Died in" value={dimLabel(s.death.dim)} note={`x ${s.death.x}, y ${s.death.y}, z ${s.death.z}`} />{/if}
      {#if s.waited_ms}<StatTile label="Waited for this turn" value={life(s.waited_ms)} note="from sign-up to turn" />{/if}
      {#if scr}<StatTile label="Borrowed time" value={life(scr.used_ms)} note={`${scr.offerings} offering${scr.offerings === 1 ? "" : "s"}, ${life(scr.added_ms)} bought, ${titleId(scr.outcome).toLowerCase()}`} />{/if}
      {#if s.waystones}<StatTile label="Waystones found" value={String(s.waystones)} />{/if}
    </div>
  </section>

  {#if s.headline?.length}
    <section class="fp-section">
      <h2 class="t-title-3">{data.playing ? "This life so far" : "This life"}</h2>
      <div class="fp-tiles os-tiles">{#each s.headline as h (h.id)}<StatTile label={h.title} value={h.display} />{/each}</div>
    </section>
  {/if}

  <section class="fp-section">
    <h2 class="t-title-3">Grave</h2>
    {#if data.grave}
      {@const g = data.grave}
      <div class="fp-card os-grave">
        <Tombstone class="fp-ico" strokeWidth={1.4} aria-hidden="true" />
        <div>
          <div>{g.items} item{g.items === 1 ? "" : "s"}{#if g.marked}, {g.marked} with the Mark of Love{/if} · {dimLabel(g.dim)} <span class="t-num">{g.x} {g.y} {g.z}</span></div>
          <div class="t-small t-muted">{#if g.claimed_by}Claimed by <a href={osHref.player(g.claimed_by.uuid)}>{g.claimed_by.name}</a>{#if g.claimed_at}, {life(g.claimed_at - g.created_at)} after the death{/if}{:else}Still open since {dateTime(g.created_at)}{/if}</div>
          {#if g.contents?.length}<div class="t-small os-contents">{g.contents.map((c) => `${c.count} × ${titleId(c.item)}`).join(" · ")}</div>{/if}
        </div>
      </div>
    {:else}
      <EmptyState title={data.playing ? "Still alive" : "No grave"} line={data.playing ? "A grave appears where a soul dies for good." : "This turn ended without a grave."} />
    {/if}
  </section>

  {#if data.stats}
    <section class="fp-section">
      <div class="fp-section__head">
        <h2 class="t-title-3">Run stats</h2>
        <span class="t-small t-muted">{data.stats.final ? "Counted over this turn only" : "This turn so far, still counting"}</span>
      </div>
      {#if byType.length === 0}
        <EmptyState title="Nothing counted for this turn" />
      {:else}
        <div class="os-statgroups">
          {#each byType as g (g.type)}
            <div class="fp-card os-statgroup">
              <h3 class="t-title-4">{typeLabel(g.type)}</h3>
              <ol class="os-statlist">
                {#each g.rows.slice(0, 8) as r (r.subject)}<li><span>{subjectLabel(r.name, r.subject)}</span><span class="t-num">{r.display}</span></li>{/each}
              </ol>
              {#if g.rows.length > 8}<span class="t-caption">and {g.rows.length - 8} more</span>{/if}
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .os-who {
    display: flex;
    gap: var(--space-4);
    align-items: center;
  }
  .os-who__name {
    margin: var(--space-1) 0 var(--space-2);
    overflow-wrap: anywhere;
  }
  .os-who__name a {
    color: var(--text);
  }
  .os-chips {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    align-items: center;
  }
  .os-cause {
    margin: 0;
    padding-left: var(--space-4);
    border-left: 2px solid var(--line);
    font-style: italic;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .os-tiles {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }
  .os-grave {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-4);
  }
  .os-contents {
    margin-top: var(--space-1);
    color: var(--muted);
  }
  .os-statgroups {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--space-4);
  }
  .os-statgroup {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .os-statlist {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .os-statlist li {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    font: 400 14px/22px var(--font-text);
  }
</style>
