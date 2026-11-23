<script lang="ts">
  // The players directory (H3), after the canvas board "Players": a search, who and a table of the page's
  // players. The API orders the directory by name and has no other order, so the table is by name too; the
  // playtime column is one batch call for the page. The API has no first or last seen for a directory row.
  import { page } from "$app/state";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import PlayerName from "#lib/design/PlayerName.svelte";
  import Segmented from "#lib/design/Segmented.svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import Window from "#lib/design/Window.svelte";
  import { durationMs, group } from "#lib/format/stat-display.ts";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();
  const list = $derived(data.players);
  const total = $derived(list.ok ? list.data.total : null);
  const lede = $derived.by(() => {
    if (!list.ok) return "Everyone the network has seen.";
    if (data.q || data.online) return total === 0 ? "No players match." : `${group(total ?? 0)} player${total === 1 ? "" : "s"} match.`;
    if (total === 0) return "Nobody has joined the network yet.";
    const names = `${group(total ?? 0)} name${total === 1 ? "" : "s"} in the guest book`;
    return data.totalOnline !== null ? `${names}. ${group(data.totalOnline)} of them ${data.totalOnline === 1 ? "is" : "are"} here right now.` : `${names}.`;
  });
  const args = $derived(data.q ? `--find "${data.q}"` : data.online ? "--online" : "--all");
  const who = $derived([
    { href: withParams(page.url, { online: null, offset: null }), label: "everyone", current: !data.online },
    { href: withParams(page.url, { online: "true", offset: null }), label: "online now", current: data.online }
  ]);
</script>

<PageHead cmd="who" {args} title="players" {lede} />

<Window path="~/players" args="| sort -k name">
  <div class="fx-filters bar">
    <form class="find" method="get" action="/players" role="search">
      {#if data.online}<input type="hidden" name="online" value="true" />{/if}
      <label class="fx-search"><span class="c4" aria-hidden="true">»</span><input type="search" name="q" value={data.q} placeholder="find a player" aria-label="Find a player" maxlength="64" autocomplete="off" /></label>
      <button class="ink c5" type="submit">search</button>
      {#if data.q}<a class="ink flat" href={withParams(page.url, { q: null, offset: null })}>clear</a>{/if}
    </form>
    <Segmented label="Who" options={who} />
    {#if list.ok && list.stale}<AsOf at={list.asOf} stale />{/if}
  </div>

  {#if !list.ok}
    {#if list.kind === "rate_limited"}
      <Notice kind="info"><b>The site is busy.</b> The player list will load again in a moment.</Notice>
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
    <div class="fx-scroll">
      <table class="fx-table" aria-label="Players">
        <thead><tr><th>player</th><th>where</th><th class="r">playtime</th></tr></thead>
        <tbody>
          {#each list.data.players as p (p.uuid)}
            {@const row = data.rows[p.uuid]}
            <tr>
              <td><PlayerName uuid={p.uuid} name={p.name} /></td>
              <td class={p.online ? "c6" : "c1"}>{#if p.online}● {p.server ? (data.serverNames[p.server] ?? p.server) : "online"}{:else}offline{/if}</td>
              <td class="r">{#if row}{durationMs(row.total_ms)}{:else}<span class="c1">–</span>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <Pager url={page.url} total={list.data.total} limit={data.limit} offset={data.offset} what="players" />
  {/if}
</Window>

<style>
  .bar { margin-bottom: var(--space-4); justify-content: space-between; }
  .find { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
  @media (max-width: 720px) {
    .find { width: 100%; }
    .find :global(.fx-search) { flex: 1; }
  }
</style>
