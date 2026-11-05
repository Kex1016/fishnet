<script lang="ts">
  import { page } from "$app/state";
  import { ChevronDown } from "@lucide/svelte";
  import Pager from "#lib/design/Pager.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import { BarList, Heatmap, ViewSwitch, viewParam } from "#lib/charts/index.ts";
  import { MilestoneFeed } from "#lib/milestones/index.ts";
  import HiddenServersNote from "#lib/milestones/HiddenServersNote.svelte";
  import { dayGrid } from "#lib/milestones/helpers.ts";
  import { group } from "#lib/format/stat-display.ts";
  let { data } = $props();

  const view = $derived(viewParam(page.url));
  const scopeLabel = $derived(data.scope === "network" ? "Network" : (data.network.ok ? data.network.data.servers.find((s) => `server:${s.id}` === data.scope)?.display_name : null) ?? data.scope);
  const grid = $derived(dayGrid(data.perDay.days, data.perDay.since, Date.now()));
  const typeLabel = $derived(data.typeOptions.find((t) => t.key === data.type)?.label);
  const sub = $derived(`${scopeLabel}${typeLabel ? ` · ${typeLabel}` : ""}`);
  const f = $derived(data.firstsFrom);
</script>

<div class="fp-page">
  <header class="fp-hero">
    <h1 class="t-display">Milestones</h1>
    <p class="fp-lede">Who was first to each threshold of a stat, newest first.</p>
  </header>

  <div class="fp-ms-bar">
    {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} />{/if}
    {#if data.typeOptions.length}
      <form method="get" class="fp-ms-filter" aria-label="Filter by stat type">
        {#if data.scope !== "network"}<input type="hidden" name="scope" value={data.scope} />{/if}
        {#if view === "tables"}<input type="hidden" name="view" value="tables" />{/if}
        <label class="fp-select">
          <span class="visually-hidden">Stat type</span>
          <select name="type" onchange={(e) => e.currentTarget.form?.submit()}>
            <option value="" selected={!data.type}>All stat types</option>
            {#each data.typeOptions as t (t.key)}<option value={t.key} selected={t.key === data.type}>{t.label}</option>{/each}
          </select>
          <ChevronDown class="fp-ico fp-ico--sm" strokeWidth={1.4} />
        </label>
        <button class="fp-btn" type="submit">Filter</button>
      </form>
    {/if}
    <ViewSwitch url={page.url} {view} />
  </div>

  <div class="fp-two">
    <div class="fp-ms-feed">
      <MilestoneFeed result={data.feed} title="Feed" limit={data.limit} />
      <HiddenServersNote scope={data.scope} />
      {#if data.feed.ok}<Pager url={page.url} total={data.feed.data.total} limit={data.limit} offset={data.offset} what="milestones" />{/if}
    </div>

    <div class="fp-ms-side">
      <BarList
        title="Most firsts"
        {sub}
        {view}
        faces
        rows={data.firsts.map((p, i) => ({ rank: i + 1, key: p.uuid, label: p.name, v: p.count, display: group(p.count), href: `/players/${encodeURIComponent(p.name)}`, uuid: p.uuid }))}
        asOf={f.asOf ?? undefined}
        stale={f.stale}
        emptyTitle={f.ok ? "No firsts yet" : "Firsts are not available"}
        emptyLine={f.ok ? "Players show up here once they are the first to reach a milestone." : "cakeutils could not be reached."}
      />
      {#if f.ok && f.total > f.read}
        <p class="t-caption fp-ms-note">Counted over the newest {group(f.read)} of {group(f.total)} milestones.</p>
      {/if}
      <Heatmap
        title="Milestones per day"
        sub="{scopeLabel} · by week, UTC"
        {view}
        since={data.perDay.since}
        rows={grid.rows}
        columns={grid.columns}
        cellLabel={(row, column) => `${row}, week of ${column}`}
        emptyTitle="No milestones recorded yet"
        emptyLine="The days fill in as the site records milestones."
      />
    </div>
  </div>
</div>

<style>
  .fp-ms-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3) var(--space-4); }
  .fp-ms-filter { display: inline-flex; align-items: center; gap: var(--space-2); }
  .fp-ms-feed { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
  .fp-ms-side { display: flex; flex-direction: column; gap: var(--space-5); min-width: 0; }
  .fp-ms-note { margin-top: calc(var(--space-3) * -1); }
</style>
