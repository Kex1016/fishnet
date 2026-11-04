<script lang="ts">
  import { page } from "$app/state";
  import { Search } from "@lucide/svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import { BarList, ViewSwitch, viewParam } from "#lib/charts/index.ts";
  import { boardHref } from "#lib/api/metric.ts";
  import { subjectName } from "#lib/players/names.ts";
  import { barRows } from "../../leaderboards/board.ts";
  let { data } = $props();
  const view = $derived(viewParam(page.url));
</script>

<div class="fp-page">
  <header class="fp-hero">
    <span class="t-kicker">Stat type · {data.key}</span>
    <h1 class="t-display">{data.label}</h1>
    {#if data.mixed}
      <p class="fp-lede">Custom stats count different things: blocks, centimetres, ticks. There is no board for all of them together, so pick one below.</p>
    {:else if !data.unknown && !data.down}
      <p class="fp-lede">Every subject recorded under {data.label.toLowerCase()}, and the players ahead on all of them together.</p>
    {/if}
    <div class="fp-filters">
      <a class="fp-chip" href="/stats">All stats</a>
      {#if data.total?.ok && !data.total.empty}<ViewSwitch url={page.url} {view} />{/if}
    </div>
  </header>

  {#if data.down}
    <Notice kind="warning"><b>cakeutils could not be reached.</b> This type will be back when it is.</Notice>
  {:else if data.unknown}
    <EmptyState title="Nobody has done this yet" line="{data.label} appears in the catalogue as soon as someone records it." />
  {:else}
    {#if data.total?.ok && !data.total.empty}
      <div class="fp-panels">
        <BarList
          title="{data.label} total"
          href={boardHref({ kind: "stat", type: data.key, subject: "*" })}
          sub="Network · top 5 of {data.total.data.total}"
          {view}
          faces
          unit={data.total.data.unit}
          asOf={data.total.asOf}
          stale={data.total.stale}
          rows={barRows(data.total.data.entries)}
        />
      </div>
    {/if}

    <section class="fp-section">
      <div class="fp-section__head"><h2 class="t-title-2">Subjects</h2></div>
      <form action={page.url.pathname} method="get" role="search">
        <label class="fp-field fp-search">
          <Search class="fp-ico fp-ico--sm" strokeWidth={1.4} />
          <input type="search" name="q" value={data.q} placeholder="Search {data.label.toLowerCase()}" aria-label="Search subjects" maxlength="64" autocomplete="off" />
        </label>
      </form>
      {#if !data.subjects?.ok}
        <Notice kind="warning"><b>cakeutils could not be reached.</b> Subjects will be back when it is.</Notice>
      {:else if data.subjects.empty}
        {#if data.q}
          <EmptyState title="No subjects match" line="Nothing under {data.label.toLowerCase()} matches “{data.q}”."><a class="fp-chip" href={page.url.pathname}>Clear search</a></EmptyState>
        {:else}
          <EmptyState title="Nothing recorded under this type yet" />
        {/if}
      {:else}
        <ul class="fp-rows subjects">
          {#each data.subjects.data.subjects as s (s.key + s.kind)}
            <li>
              <a class="fp-row" style="grid-template-columns: 36px minmax(0, 1fr)" href={boardHref({ kind: "stat", type: data.key, subject: s.key })}>
                <Slot icon={s.icon} kind={s.kind as never} name={subjectName(s.name, s.key)} />
                <span class="fp-row__name">{subjectName(s.name, s.key)}</span>
              </a>
            </li>
          {/each}
        </ul>
        <Pager url={page.url} total={data.subjects.data.total} limit={data.limit} offset={data.offset} what="subjects" />
      {/if}
    </section>
  {/if}
</div>

<style>
  .subjects { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)); gap: var(--space-1); }
</style>
