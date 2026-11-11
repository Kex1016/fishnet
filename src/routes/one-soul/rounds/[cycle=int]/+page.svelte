<script lang="ts">
  import { page } from "$app/state";
  import { BookOpen } from "@lucide/svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import { BarList, StatTile, viewParam } from "#lib/charts/index.ts";
  import { AdvancementFeed, MilestoneFeed } from "#lib/milestones/index.ts";
  import Outcome from "#lib/onesoul/Outcome.svelte";
  import { life, titleId } from "#lib/onesoul/format.ts";
  import { osHref } from "#lib/onesoul/links.ts";
  import { barRows } from "#lib/onesoul/boards.ts";
  import { day } from "#lib/format/dates.ts";
  let { data } = $props();
  const view = $derived(viewParam(page.url));
  const s = $derived(data.summary);
  const souls = $derived(data.souls.rows);
  const graves = $derived(data.graves.rows);
  const over = $derived(!!s.ended_at);
</script>

<div class="fp-page">
  <section class="fp-section">
    <div class="fp-section__head">
      <h1 class="t-display">Round {data.cycle}</h1>
      <span class="t-small t-muted">
        {#if s.started_at}{day(s.started_at)}{#if s.ended_at} to {day(s.ended_at)}{:else}, still running{/if}{:else}Sign-ups, world not opened yet{/if}
      </span>
    </div>
    <div class="fp-tiles os-tiles">
      <StatTile label="Souls" value={String(s.souls)} />
      <StatTile label="Time survived" value={life(s.total_survival_ms)} />
      {#if s.longest}<StatTile label="Longest life" value={life(s.longest.duration_ms)} note={s.longest.name} href={osHref.soul(data.cycle, s.longest.turn)} />{/if}
      <StatTile label="Deaths" value={String(s.deaths)} />
      {#if s.graves}<StatTile label="Graves claimed" value={s.graves.total ? `${s.graves.claimed} of ${s.graves.total}` : "None"} />{/if}
      {#if s.registered !== null}<StatTile label="Signed up" value={String(s.registered)} />{/if}
    </div>
    {#if over && s.seed !== null && s.seed !== undefined}<p class="t-small t-muted">World seed <span class="t-num">{s.seed}</span>{#if s.archive}, archived as <span class="t-num">{s.archive}</span>{/if}.</p>{/if}
  </section>

  {#if data.records?.length}
    <section class="fp-section">
      <h2 class="t-title-3">Records of the round</h2>
      <div class="fp-tiles os-tiles">
        {#each data.records as r (r.id)}<StatTile label={r.title} value={r.display} note={`${r.name}, turn ${r.turn}`} href={osHref.soul(data.cycle, r.turn)} />{/each}
      </div>
    </section>
  {/if}

  <section class="fp-section">
    <h2 class="t-title-3">Souls</h2>
    {#if souls.length === 0}
      <EmptyState title="No soul has played in this round yet" />
    {:else}
      <ol class="fp-rows">
        {#each souls as x (x.turn)}
          <a class="fp-row os-soulrow" href={osHref.soul(x.cycle, x.turn)}>
            <span class="fp-row__rank">{x.turn}</span>
            <span></span>
            <span class="fp-row__name">{x.name}{#if x.cause}<span class="fp-row__sub os-cause">{x.cause}</span>{/if}</span>
            <span class="os-soulrow__end">
              {#if x.has_journal}<BookOpen class="fp-ico fp-ico--sm" strokeWidth={1.4} aria-label="Journal published" />{/if}
              <Outcome outcome={x.outcome} />
              <span class="fp-row__value">{x.duration_ms === null ? "playing" : life(x.duration_ms)}</span>
            </span>
          </a>
        {/each}
      </ol>
    {/if}
  </section>

  {#if data.scoped}
    <div class="os-boards">
      {#if data.boards.playtime}<BarList title="Most time in this world" sub="spectating counts" rows={barRows(data.boards.playtime.data)} faces {view} emptyTitle="Nobody has played yet" />{/if}
      {#if data.boards.mined}<BarList title="Blocks mined" sub="this round" rows={barRows(data.boards.mined.data)} faces {view} emptyTitle="Nobody has mined yet" />{/if}
      {#if data.boards.killed}<BarList title="Mobs killed" sub="this round" rows={barRows(data.boards.killed.data)} faces {view} emptyTitle="Nobody has killed a mob yet" />{/if}
    </div>
  {/if}
  {#if data.firsts}<MilestoneFeed result={data.firsts} title="Firsts in this round" limit={8} />{/if}
  {#if data.advancements}<AdvancementFeed result={data.advancements} title="Advancement firsts in this round" showServer={false} limit={8} />{/if}

  <section class="fp-section">
    <h2 class="t-title-3">Graves</h2>
    {#if graves.length === 0}
      <EmptyState title="No graves in this round" line="A grave appears where a soul dies for good." />
    {:else}
      <p class="t-body">{graves.filter((g) => g.claimed_by).length} of {graves.length} claimed. <a href="{osHref.graveyard}?round={data.cycle}">See the graveyard</a>.</p>
    {/if}
  </section>

  {#if over}
    <section class="fp-section">
      <h2 class="t-title-3">Haunting</h2>
      {#if data.pranks && data.pranks.ghosts.length}
        <ol class="fp-rows">
          {#each data.pranks.ghosts as g, i (g.uuid)}
            <a class="fp-row" href={osHref.player(g.uuid)}>
              <span class="fp-row__rank" class:fp-row__rank--top={i < 3}>{i + 1}</span>
              <span></span>
              <span class="fp-row__name">{g.name}<span class="fp-row__sub">{Object.entries(g.kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${titleId(k)} ${n}`).join(" · ")}</span></span>
              <span class="fp-row__value">{g.total} pranks</span>
            </a>
          {/each}
        </ol>
      {:else if data.pranks}
        <EmptyState title="No ghost played a prank this round" />
      {:else}
        <Notice kind="info">Prank counts per ghost show here once the server shares them for finished rounds.</Notice>
      {/if}
    </section>
  {/if}
</div>

<style>
  .os-tiles {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }
  .os-boards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--space-4);
  }
  .os-soulrow {
    grid-template-columns: 28px 0 minmax(0, 1fr) auto;
  }
  .os-soulrow__end {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  .os-cause {
    font-style: italic;
    white-space: normal;
  }
  @media (max-width: 640px) {
    .os-soulrow {
      grid-template-columns: 28px 0 minmax(0, 1fr);
      padding: var(--space-2) var(--space-3);
    }
    .os-soulrow__end {
      grid-column: 3;
    }
  }
</style>
