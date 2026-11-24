<script lang="ts">
  import { page } from "$app/state";
  import Pager from "#lib/design/Pager.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import { scopeLabel } from "#lib/servers.ts";
  import { critLabel } from "#lib/network/words.ts";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import PlayerName from "#lib/design/PlayerName.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import { ago, dateTime, iso } from "#lib/format/dates.ts";
  import { group } from "#lib/format/stat-display.ts";
  import { titleCase } from "#lib/players/names.ts";
  let { data } = $props();
  const serverName = (id: string) => data.serverNames[id] ?? titleCase(id);
  const players = (n: number) => `${group(n)} player${n === 1 ? "" : "s"}`;
  const scopeName = $derived(scopeLabel(data.scope, data.servers));
  const imported = "The time comes from the server's world files: this was completed before live tracking began.";
</script>

<PageHead path="~/advancements" cmd="stat" title={data.title} note={data.category ? `${data.category} · ${data.id}` : data.id}>
  <p><a class="ink c5" href="/advancements">all advancements</a></p>
</PageHead>

{#if !data.detail.ok}
  {#if data.detail.kind === "not_found"}
    <Window path="~/advancements" args="--first"><EmptyState title="Nobody has completed this yet" line=" It shows up here once a player completes it on a server." /></Window>
  {:else if data.detail.kind === "rate_limited"}
    <Notice kind="info"><b>The site is busy.</b> This advancement will load again in a moment{#if data.detail.retryAfter}, in about {data.detail.retryAfter} s{/if}.</Notice>
  {:else}
    <Notice kind="warning"><b>cakeutils could not be reached.</b> This advancement will be back when it is. {#if data.detail.asOf}<AsOf at={data.detail.asOf} stale />{/if}</Notice>
  {/if}
{:else}
  {@const d = data.detail.data}
  {#if data.detail.stale}<Notice kind="warning"><b>cakeutils could not be reached.</b> Showing the last good data, <AsOf at={data.detail.asOf} stale />.</Notice>{/if}

  <Window path="~/advancements" args="--first --network">
    <WindowHead title="First in the network" asof="the earliest completion on any server" />
    {#if !d.network}
      <EmptyState title="Nobody has completed this yet" line=" It shows up here once a player completes it on a server." />
    {:else}
      {@const n = d.network}
      <div class="first">
        <Slot icon={data.icon} size="lg" name={data.title} />
        <div class="fx-stack">
          {#if n.uuid && n.name}<PlayerName uuid={n.uuid} name={n.name} size="md" />{:else}<span class="c1">First player unknown</span>{/if}
          <span>
            on <a href="/servers/{encodeURIComponent(n.server)}">{serverName(n.server)}</a>,
            <time datetime={iso(n.earned_at)} title={dateTime(n.earned_at)}>{ago(n.earned_at)}</time>
            {#if n.imported}<span class="chip" title={imported}>imported</span>{/if}
          </span>
          <span class="c1">{players(n.earners)} {n.earners === 1 ? "has" : "have"} it across the network.</span>
        </div>
      </div>
    {/if}
  </Window>

  {#if data.earners.ok || data.earners.kind !== "off"}
    <Window path="~/advancements" args="--who">
      <WindowHead title="Who has it">
        {scopeName}{" "}· in the order they got it{#if data.earners.ok && data.earners.stale}{" "}· <AsOf at={data.earners.asOf} stale />{/if}
      </WindowHead>
      {#if data.servers.length}<div class="scope"><ScopeSwitch url={page.url} scope={data.scope} servers={data.servers} /></div>{/if}
      {#if data.miniScope}
        <EmptyState title="Not kept per mini-server" line=" Advancements are kept per server and for the whole network. Pick a server or the network above." />
      {:else if !data.earners.ok}
        {#if data.earners.kind === "not_found"}
          <EmptyState title="Nobody has this here yet" line=" Players show up here once they complete it." />
        {:else if data.earners.kind === "rate_limited"}
          <EmptyState title="The site is busy" line=" The list will load again in a moment." />
        {:else}
          <EmptyState title="The list is not available" line=" cakeutils could not be reached." />
        {/if}
      {:else if data.earners.data.earners.length === 0}
        <EmptyState title="Nobody has this here yet" line=" Players show up here once they complete it." />
      {:else}
        {@const showServer = data.scope === "network"}
        <div class="fx-scroll">
          <table class="fx-table">
            <thead><tr><th class="r">#</th><th>Player</th>{#if showServer}<th>Server</th>{/if}<th>When</th></tr></thead>
            <tbody>
              {#each data.earners.data.earners as e (e.uuid)}
                <tr>
                  <td class="r c1">{group(e.rank)}</td>
                  <td><PlayerName uuid={e.uuid} name={e.name} /></td>
                  {#if showServer}<td><a href="/servers/{encodeURIComponent(e.server)}">{serverName(e.server)}</a></td>{/if}
                  <td>
                    <time datetime={iso(e.earned_at)} title={dateTime(e.earned_at)}>{ago(e.earned_at)}</time>
                    {#if e.imported}{" "}<span class="chip" title={imported}>imported</span>{/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <Pager url={page.url} total={data.earners.data.total} limit={data.limit} offset={data.offset} what="players" prev="earlier" next="later" />
      {/if}
    </Window>
  {/if}

  <Window path="~/advancements" args="--by-server">
    <WindowHead title="By server" asof="each server on its own; a player with it on two servers counts on both" />
    {#if d.servers.length === 0}
      <EmptyState title="No server has this yet" />
    {:else}
      <div class="fx-scroll">
        <table class="fx-table">
          <thead><tr><th>Server</th><th>First</th><th>When</th><th class="r">Players with it</th></tr></thead>
          <tbody>
            {#each d.servers as s (s.server)}
              <tr>
                <td><a href="/servers/{encodeURIComponent(s.server)}">{serverName(s.server)}</a></td>
                <td>{#if s.uuid && s.name}<PlayerName uuid={s.uuid} name={s.name} />{:else}<span class="c1">First player unknown</span>{/if}</td>
                <td>
                  <time datetime={iso(s.earned_at)} title={dateTime(s.earned_at)}>{ago(s.earned_at)}</time>
                  {#if s.imported}{" "}<span class="chip" title={imported}>imported</span>{/if}
                </td>
                <td class="r">{group(s.earners)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </Window>

  {#if data.criteria && data.criteria.length}
    <Window path="~/advancements" args="--parts">
      <WindowHead title="First to each part" asof="the network; each criterion on its own" />
      <div class="fx-scroll">
        <table class="fx-table">
          <thead><tr><th>Part</th><th>First</th><th>When</th><th class="r">Players with it</th></tr></thead>
          <tbody>
            {#each data.criteria as c (c.criterion)}
              <tr>
                <td>{critLabel(c.criterion)}</td>
                <td><PlayerName uuid={c.uuid} name={c.name} /></td>
                <td>{#if c.earned_at}<time datetime={iso(c.earned_at)} title={dateTime(c.earned_at)}>{ago(c.earned_at)}</time>{:else}<span class="c1">before tracking began</span>{/if}{#if c.imported}{" "}<span class="chip">imported</span>{/if}</td>
                <td class="r">{c.earners === undefined ? "–" : group(c.earners)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Window>
  {/if}
{/if}

<style>
  .first { display: flex; gap: 16px; align-items: flex-start; }
  .scope { margin-bottom: 12px; }
</style>
