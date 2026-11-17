<script lang="ts">
  // World firsts: every row has a picture (the catalogue's icon of what it is about, added by the load in
  // pictures.server.ts, or the kind's glyph in the same slot), what it was, who and when, like the milestone
  // and advancement feeds.
  import { page } from "$app/state";
  import { Award, Clock, Compass, Gem, ListChecks, Mountain, Sparkles, Landmark, Sigma } from "@lucide/svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import PlayerName from "#lib/design/PlayerName.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import { FIRST_KINDS, firstKind, firstLine } from "#lib/network/words.ts";
  import { ago, dateTime, iso } from "#lib/format/dates.ts";
  import { group } from "#lib/format/stat-display.ts";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();
  const GLYPHS: Record<string, typeof Sparkles> = { advancement: Award, criterion: ListChecks, dimension: Compass, biome: Mountain, structure: Landmark, item: Gem, playtime: Clock, stat: Sigma };
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
      <div class="fp-section__head fx-head"><h2 class="t-title-4">{group(data.feed.data.total)} first{data.feed.data.total === 1 ? "" : "s"}</h2><AsOf at={data.feed.asOf} stale={data.feed.stale} /></div>
      <ol class="fx-list">
        {#each data.feed.data.firsts as f, i (`${f.kind}-${f.uuid}-${f.title}-${i}`)}
          {@const line = firstLine(f)}
          <li class="fx-row">
            <Slot icon={f.icon} kind={f.iconKind} glyph={GLYPHS[f.kind] ?? Sparkles} name={line.text} />
            <div class="fx-body">
              <div class="fx-what">
                {#if line.href}<a class="fx-title" href={line.href}>{line.text}</a>{:else}<span class="fx-title">{line.text}</span>{/if}
                <span class="fx-kind">{firstKind(f.kind)}</span>
              </div>
              <div class="fx-who">
                {#if f.uuid && f.name}<PlayerName uuid={f.uuid} name={f.name} />{:else}<span class="t-muted">First player unknown</span>{/if}
                {#if data.scope === "network" && f.server}<span class="t-muted">on <a href="/servers/{encodeURIComponent(f.server)}">{data.serverNames[f.server] ?? f.server}</a></span>{/if}
              </div>
            </div>
            <div class="fx-when">
              {#if f.at === null}<span class="fp-tag">Reached before tracking began</span>{:else}<time datetime={iso(f.at)} title={dateTime(f.at)}>{ago(f.at)}</time>{/if}
              {#if f.imported}<span class="fp-tag" title="The time comes from the server's world files: this was done before live tracking began.">Imported</span>{/if}
            </div>
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
    margin: 0 calc(-1 * var(--space-3));
    padding: 0;
  }
  /* the same row as the milestone and advancement feeds (MilestoneItem, AdvancementItem) */
  .fx-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: var(--space-3);
    align-items: center;
    min-height: 52px;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-lg);
  }
  .fx-row:hover {
    background: var(--raised);
  }
  .fx-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .fx-what {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
  }
  .fx-title {
    font: 600 15px/20px var(--font-text);
    color: var(--text);
    overflow-wrap: anywhere;
  }
  a.fx-title:hover {
    color: var(--acc-ink);
    text-decoration: none;
  }
  .fx-kind {
    font: 500 11px/16px var(--font-mono);
    color: var(--faint);
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  .fx-who {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-2);
    font: 400 13px/20px var(--font-text);
    min-width: 0;
  }
  .fx-who a:not(:global(.fp-player)) {
    color: inherit;
  }
  .fx-who a:not(:global(.fp-player)):hover {
    color: var(--acc-ink);
    text-decoration: none;
  }
  .fx-when {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    font: 400 12px/16px var(--font-mono);
    color: var(--faint);
    text-align: right;
    max-width: 150px;
  }
  .fx-when :global(.fp-tag) {
    height: auto;
    min-height: 20px;
    padding-top: 2px;
    padding-bottom: 2px;
    white-space: normal;
    text-align: left;
    line-height: 14px;
  }
  @media (max-width: 640px) {
    .fx-when {
      max-width: 110px;
    }
  }
</style>
