<script lang="ts">
  import { page } from "$app/state";
  import Pager from "#lib/design/Pager.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import { BarList, Heatmap } from "#lib/charts/index.ts";
  import { AdvancementFeed, advHref, dayGrid } from "#lib/milestones/index.ts";
  import { group } from "#lib/format/stat-display.ts";
  import { playerHref, playerRowLabel } from "#lib/players/names.ts";
  import { scopeLabel } from "#lib/servers.ts";
  let { data } = $props();

  const scopeName = $derived(scopeLabel(data.scope, data.network.ok ? data.network.data.servers : []));
  const f = $derived(data.countedFrom);
  const grid = $derived(dayGrid(data.perDay.days, data.perDay.since, Date.now()));
</script>

<div class="fp-page">
  <header class="fp-hero">
    <h1 class="t-display">Advancements</h1>
    <p class="fp-lede">Who completed each advancement first, per server and for the whole network, newest first.</p>
  </header>

  <div class="fp-adv-bar">
    {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} />{/if}
  </div>

  {#if data.miniScope}
    <p class="t-small t-muted">Advancements are kept per server and for the whole network, not per mini-server. Pick a server or the network above.</p>
  {:else}
    <div class="fp-two">
      <div class="fp-adv-feed">
        <AdvancementFeed result={data.feed} title="Feed" limit={data.limit} serverNames={data.serverNames} showServer={data.scope === "network"} />
        {#if data.feed.ok}<Pager url={page.url} total={data.feed.data.total} limit={data.limit} offset={data.offset} what="advancements" />{/if}
      </div>

      <div class="fp-adv-side">
        <BarList
          title="Most firsts"
          sub="{scopeName} · advancements completed before anyone else"
          faces
          rows={data.firsts.map((p, i) => ({ rank: i + 1, key: p.uuid, label: playerRowLabel(p), v: p.count, display: group(p.count), href: playerHref(p), uuid: p.uuid }))}
          asOf={f.asOf ?? undefined}
          stale={f.stale}
          emptyTitle={f.ok ? "No firsts yet" : "Firsts are not available"}
          emptyLine={f.ok ? "Players show up here once they are the first to complete an advancement." : "cakeutils could not be reached."}
        />
        <BarList
          title="Most completed"
          sub="{scopeName} · players who have it"
          rows={data.completed.map((a, i) => ({ rank: i + 1, key: a.advancement, label: a.title, v: a.earners, display: group(a.earners), href: advHref(a.advancement) }))}
          asOf={f.asOf ?? undefined}
          stale={f.stale}
          emptyTitle={f.ok ? "No advancements yet" : "Advancements are not available"}
          emptyLine={f.ok ? "Advancements show up here once a player completes one." : "cakeutils could not be reached."}
        />
        {#if f.ok && f.total > f.read}
          <p class="t-caption fp-adv-note">Counted over the newest {group(f.read)} of {group(f.total)} advancements.</p>
        {/if}
        <Heatmap
          title="Firsts per day"
          sub="{scopeName} · by week, UTC · imported completions on their own day"
          since={data.perDay.since}
          rows={grid.rows}
          columns={grid.columns}
          cellLabel={(row, column) => `${row}, week of ${column}`}
          emptyTitle="No firsts recorded yet"
          emptyLine="The days fill in as the site records advancement firsts."
        />
      </div>
    </div>
  {/if}
</div>

<style>
  .fp-adv-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3) var(--space-4); }
  .fp-adv-feed { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
  .fp-adv-side { display: flex; flex-direction: column; gap: var(--space-5); min-width: 0; }
  .fp-adv-note { margin-top: calc(var(--space-3) * -1); }
</style>
