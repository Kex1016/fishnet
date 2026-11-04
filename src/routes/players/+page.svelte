<script lang="ts">
  import { page } from "$app/state";
  import { Search } from "@lucide/svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import { durationMs } from "#lib/format/stat-display.ts";
  import { group } from "#lib/format/stat-display.ts";
  import { withParams } from "#lib/url.ts";
  import { playerLabel, shortUuid, isUuidName } from "#lib/players/names.ts";
  let { data } = $props();
  const list = $derived(data.players);
  const total = $derived(list.ok ? list.data.total : null);
  const everyone = $derived(withParams(page.url, { online: null }));
  const onlineOnly = $derived(withParams(page.url, { online: "true" }));
</script>

<div class="fp-page">
  <header class="fp-hero">
    <span class="t-kicker">Directory</span>
    <h1 class="t-display">{data.heading}</h1>
    <p class="fp-lede">
      {#if list.ok && !data.q && !data.online}
        {#if total === 0}Nobody has joined the network yet.{:else}{group(total ?? 0)} player{total === 1 ? "" : "s"} the network has seen{#if data.totalOnline !== null}, {group(data.totalOnline)} online right now{/if}.{/if}
      {:else if list.ok}
        {#if total === 0}No players match.{:else}{group(total ?? 0)} player{total === 1 ? "" : "s"}.{/if}
      {:else}
        Everyone the network has seen.
      {/if}
    </p>
  </header>

  <form class="fp-filters" method="get" action="/players" role="search">
    {#if data.online}<input type="hidden" name="online" value="true" />{/if}
    <label class="fp-field fp-search">
      <Search class="fp-ico fp-ico--sm" strokeWidth={1.4} />
      <input type="search" name="q" value={data.q} placeholder="Find a player" aria-label="Find a player" maxlength="64" autocomplete="off" />
    </label>
    <button class="fp-btn" type="submit">Search</button>
    <nav class="fp-seg" aria-label="Who">
      <a href={everyone} aria-current={!data.online ? "true" : undefined}>Everyone</a>
      <a href={onlineOnly} aria-current={data.online ? "true" : undefined}>Online</a>
    </nav>
    {#if list.ok && list.stale}<AsOf at={list.asOf} stale />{/if}
  </form>

  {#if !list.ok}
    {#if list.kind === "rate_limited"}
      <Notice kind="warning"><b>Too many requests to cakeutils.</b> The player list will be back in a moment.</Notice>
    {:else}
      <Notice kind="warning"><b>cakeutils could not be reached.</b> The player list will be back when it is.</Notice>
    {/if}
  {:else if list.empty || list.data.players.length === 0}
    {#if data.q}
      <EmptyState title="No player by that name" line={data.online ? "Nobody online matches. Try everyone." : "Names match on any part, so a few letters are enough."} />
    {:else if data.online}
      <EmptyState title="Nobody is online right now" line="Players show up here the moment they join." />
    {:else}
      <EmptyState title="No one has joined yet" line="The first player to join the network shows up here." />
    {/if}
  {:else}
    {#if data.batchDown}<Notice kind="info">Playtime could not be read right now; names and status are current.</Notice>{/if}
    <ul class="fp-dir" aria-label="Players">
      {#each list.data.players as p (p.uuid)}
        {@const pt = data.playtime[p.uuid]}
        <li>
          <a class="fp-dir__card" href="/players/{encodeURIComponent(p.name)}">
            <Face uuid={p.uuid} name={playerLabel(p.name)} size="md" />
            <span class="fp-dir__who">
              <span class="fp-dir__name t-truncate" class:t-muted={isUuidName(p.name)}>{playerLabel(p.name)}</span>
              <span class="fp-dir__sub t-truncate">
                {#if p.online}<span class="fp-dot fp-dot--on" aria-hidden="true"></span><span class="t-truncate">{p.server ? `Online on ${data.serverNames[p.server] ?? p.server}` : "Online"}</span>
                {:else if isUuidName(p.name)}{shortUuid(p.uuid)}
                {:else}Offline{/if}
              </span>
            </span>
            {#if pt}<span class="fp-dir__time" title="Playtime on the network">{durationMs(pt.total_ms)}</span>{/if}
          </a>
        </li>
      {/each}
    </ul>
    <Pager url={page.url} total={list.data.total} limit={data.limit} offset={data.offset} what="players" />
  {/if}
</div>

<style>
  .fp-dir { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)); gap: var(--space-2); list-style: none; margin: 0; padding: 0; }
  .fp-dir__card { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; align-items: center; gap: var(--space-3); min-height: 56px; padding: var(--space-2) var(--space-3); border: 1px solid var(--line-soft); border-radius: var(--radius-lg); background: var(--surface); color: inherit; text-decoration: none; transition: background-color var(--duration-fast) var(--ease-soft), border-color var(--duration-fast) var(--ease-soft); }
  .fp-dir__card:hover { background: var(--raised); border-color: var(--line); text-decoration: none; }
  .fp-dir__who { display: flex; flex-direction: column; min-width: 0; gap: 1px; }
  .fp-dir__name { font: 500 15px/20px var(--font-text); }
  .fp-dir__sub { display: inline-flex; align-items: center; gap: var(--space-1); font: 400 12px/16px var(--font-mono); color: var(--faint); }
  .fp-dir__time { font: 400 13px/20px var(--font-mono); font-variant-numeric: tabular-nums; color: var(--muted); white-space: nowrap; }
  @media (max-width: 640px) { .fp-dir { grid-template-columns: 1fr; } }
</style>
