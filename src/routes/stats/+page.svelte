<script lang="ts">
  import { page } from "$app/state";
  import { Search } from "@lucide/svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import { StatTile } from "#lib/charts/index.ts";
  import { group } from "#lib/format/stat-display.ts";
  import { subjectName } from "#lib/players/names.ts";
  import { typeLabel } from "#lib/format/labels.ts";
  import { withParams } from "#lib/url.ts";
  import { KINDS, kindLabel } from "./kinds.ts";
  let { data } = $props();
  const filtered = $derived(data.q !== "" || data.kind !== null);
</script>

<div class="fp-page">
  <header class="fp-hero">
    <h1 class="t-display">Stats</h1>
    <p class="fp-lede">Every stat the network knows. New ones appear when someone first records them, so this list is never fixed. Pick a type for its subjects, or a subject for every board it is on.</p>
  </header>

  <section class="fp-section">
    <div class="fp-section__head"><h2 class="t-title-2">Types</h2></div>
    {#if !data.types.ok}
      <Notice kind="warning"><b>cakeutils could not be reached.</b> The catalogue will be back when it is.</Notice>
    {:else if data.types.empty}
      <EmptyState title="Nothing recorded yet" line="Stat types show up once a server sends its first stats." />
    {:else}
      <div class="fp-tiles">
        {#each data.types.data.types as t (t.key)}
          {@const n = data.typeCounts[t.key]}
          <StatTile
            label={typeLabel(t.key, t.name)}
            value={n === undefined ? "—" : group(n)}
            unit={n === 1 ? "subject" : "subjects"}
            note={t.kind ?? undefined}
            href="/stats/{encodeURIComponent(t.key)}"
          />
        {/each}
      </div>
    {/if}
  </section>

  <section class="fp-section">
    <div class="fp-section__head"><h2 class="t-title-2">Subjects</h2></div>
    <div class="fp-filters">
      <form action="/stats" method="get" role="search" style="display: contents">
        <label class="fp-field fp-search">
          <Search class="fp-ico fp-ico--sm" strokeWidth={1.4} />
          <input type="search" name="q" value={data.q} placeholder="Search subjects" aria-label="Search subjects" maxlength="64" autocomplete="off" />
        </label>
        {#if data.kind}<input type="hidden" name="kind" value={data.kind} />{/if}
      </form>
      <nav class="fp-seg" aria-label="Kind">
        <a href={withParams(page.url, { kind: null })} aria-current={data.kind === null ? "true" : undefined}>All</a>
        {#each KINDS as k (k)}
          <a href={withParams(page.url, { kind: k })} aria-current={data.kind === k ? "true" : undefined}>{kindLabel(k)}</a>
        {/each}
      </nav>
    </div>

    {#if !data.subjects.ok}
      {#if data.subjects.kind === "bad_request"}
        <EmptyState title="That search did not work" line="Try a shorter search." />
      {:else}
        <Notice kind="warning"><b>cakeutils could not be reached.</b> Subjects will be back when it is.</Notice>
      {/if}
    {:else if data.subjects.empty}
      {#if filtered}
        <EmptyState title="No subjects match" line={data.q ? `Nothing recorded matches “${data.q}”.` : "Nothing of that kind has been recorded yet."}>
          <a class="fp-chip" href="/stats">Clear filters</a>
        </EmptyState>
      {:else}
        <EmptyState title="Nothing recorded yet" line="Subjects show up once someone mines, crafts or kills something." />
      {/if}
    {:else}
      <ul class="fp-rows catalogue">
        {#each data.subjects.data.subjects as s (s.key + s.kind)}
          <li>
            <a class="fp-row" style="grid-template-columns: 36px minmax(0, 1fr)" href="/stats/subject/{encodeURIComponent(s.key)}">
              <Slot icon={s.icon} kind={s.kind as never} name={subjectName(s.name, s.key)} />
              <span class="fp-row__name">{subjectName(s.name, s.key)} <span class="fp-row__sub">{s.kind ?? "?"}</span></span>
            </a>
          </li>
        {/each}
      </ul>
      <Pager url={page.url} total={data.subjects.data.total} limit={data.limit} offset={data.offset} what="subjects" />
    {/if}
  </section>
</div>

<style>
  .catalogue { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)); gap: var(--space-1); }
</style>
