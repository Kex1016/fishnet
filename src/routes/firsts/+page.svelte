<script lang="ts">
  import { page } from "$app/state";
  import { Award, Clock, Compass, Gem, ListChecks, Mountain, Sparkles, Landmark, ChartColumn } from "@lucide/svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import { FIRST_KINDS, firstKind } from "#lib/network/words.ts";
  import { dateTime } from "#lib/format/dates.ts";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();
  const ICONS: Record<string, typeof Sparkles> = { advancement: Award, criterion: ListChecks, dimension: Compass, biome: Mountain, structure: Landmark, item: Gem, playtime: Clock, stat: ChartColumn };
</script>

<div class="fp-page">
  <header class="fp-hero">
    <h1 class="t-display">Firsts</h1>
    <p class="fp-lede">Who did it first: advancements and their parts, new dimensions and biomes, rare items and hours played, newest first.</p>
  </header>
  <div class="fx-bar">
    {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} />{/if}
    <nav class="fp-seg fx-kinds" aria-label="Kind">
      <a href={withParams(page.url, { kind: null })} aria-current={data.kind === null ? "page" : undefined}>All</a>
      {#each FIRST_KINDS as k (k.id)}<a href={withParams(page.url, { kind: k.id })} aria-current={data.kind === k.id ? "page" : undefined}>{k.label}</a>{/each}
    </nav>
  </div>

  {#if data.mini}
    <p class="t-small t-muted">Firsts are kept per server and for the whole network, not per mini-server. Pick a server or the network above.</p>
  {:else if !data.feed || !data.feed.ok}
    <Notice kind="warning">Firsts could not be loaded right now.</Notice>
  {:else if data.feed.data.firsts.length === 0}
    <EmptyState icon={Sparkles} title="No firsts yet" line="Someone shows up here the moment they do something nobody on the network has done before." />
  {:else}
    <section class="fp-card fx-feed">
      <div class="fp-section__head fx-head"><h2 class="t-title-4">{data.feed.data.total} first{data.feed.data.total === 1 ? "" : "s"}</h2><AsOf at={data.feed.asOf} stale={data.feed.stale} /></div>
      <ol class="fx-list">
        {#each data.feed.data.firsts as f, i (`${f.kind}-${f.uuid}-${f.title}-${i}`)}
          {@const Icon = ICONS[f.kind] ?? Sparkles}
          <li class="fx-row">
            <span class="fx-ico" title={firstKind(f.kind)}><Icon class="fp-ico" strokeWidth={1.4} aria-hidden="true" /></span>
            <div class="fx-body">
              <div class="fx-title">{f.title}</div>
              <div class="t-small t-muted">
                <span class="visually-hidden">{firstKind(f.kind)}: </span><a href="/players/{encodeURIComponent(f.name)}">{f.name}</a>{#if data.scope === "network" && f.server}{" "}on {data.serverNames[f.server] ?? f.server}{/if}
              </div>
            </div>
            <Face uuid={f.uuid} name={f.name} size="sm" />
            <span class="t-caption fx-when">{f.at === null ? "before tracking began" : dateTime(f.at)}{#if f.imported} · imported{/if}</span>
          </li>
        {/each}
      </ol>
    </section>
    <Pager url={page.url} total={data.feed.data.total} limit={data.limit} offset={data.offset} what="firsts" />
  {/if}
</div>

<style>
  .fx-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .fx-kinds {
    overflow-x: auto;
    max-width: 100%;
    scrollbar-width: none;
  }
  .fx-feed {
    padding: var(--space-4);
  }
  .fx-head {
    margin-bottom: var(--space-2);
  }
  .fx-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .fx-row {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) 24px auto;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--line-soft);
  }
  .fx-row:last-child {
    border-bottom: 0;
  }
  .fx-ico {
    color: var(--acc-ink);
    display: inline-flex;
  }
  .fx-title {
    font: 500 14px/20px var(--font-text);
    overflow-wrap: anywhere;
  }
  .fx-when {
    color: var(--faint);
    text-align: right;
  }
  @media (max-width: 520px) {
    .fx-row {
      grid-template-columns: 24px minmax(0, 1fr) 24px;
    }
    .fx-when {
      grid-column: 2 / -1;
      text-align: left;
    }
  }
</style>
