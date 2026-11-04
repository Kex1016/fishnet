<script lang="ts">
  import { page } from "$app/state";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import PlayerName from "#lib/design/PlayerName.svelte";
  import Stub from "#lib/design/Stub.svelte";
  let { data } = $props();
</script>

<div class="fp-page">
  <header class="fp-hero">
    <h1 class="t-display">Players</h1>
    <p class="fp-lede">Everyone the network has seen.</p>
    <Stub unit="W5" what="this page" />
  </header>
  <form class="fp-filters" method="get" action="/players">
    <label class="fp-field fp-search"><input type="search" name="q" value={data.q} placeholder="Find a player" aria-label="Find a player" maxlength="64" /></label>
    <nav class="fp-seg" aria-label="Who">
      <a href="/players{data.q ? `?q=${encodeURIComponent(data.q)}` : ''}" aria-current={!data.online ? "true" : undefined}>Everyone</a>
      <a href="/players?online=true{data.q ? `&q=${encodeURIComponent(data.q)}` : ''}" aria-current={data.online ? "true" : undefined}>Online</a>
    </nav>
    <button class="fp-btn" type="submit">Search</button>
  </form>
  {#if !data.players.ok}
    <Notice kind="warning"><b>cakeutils could not be reached.</b> The player list will be back when it is.</Notice>
  {:else if data.players.empty}
    <EmptyState title={data.q ? "No player by that name" : data.online ? "Nobody is online right now" : "No one has joined yet"} />
  {:else}
    <ul class="fp-rows" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr)); gap: var(--space-1)">
      {#each data.players.data.players as p (p.uuid)}
        <li class="fp-row" style="grid-template-columns: minmax(0, 1fr)"><PlayerName uuid={p.uuid} name={p.name} size="md" online={p.online} /></li>
      {/each}
    </ul>
    <Pager url={page.url} total={data.players.data.total} limit={data.limit} offset={data.offset} what="players" />
  {/if}
</div>
