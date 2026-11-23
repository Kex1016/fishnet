<script lang="ts">
  import { page } from "$app/state";
  import Catalogue from "#lib/design/Catalogue.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import Segmented from "#lib/design/Segmented.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import { group } from "#lib/format/stat-display.ts";
  import { subjectName } from "#lib/players/names.ts";
  import { typeLabel } from "#lib/format/labels.ts";
  import { withParams } from "#lib/url.ts";
  import { KINDS, kindLabel, subjectItems } from "./kinds.ts";
  let { data } = $props();
  const filtered = $derived(data.q !== "" || data.kind !== null);
  const kindOptions = $derived([
    { href: withParams(page.url, { kind: null }), label: "All", current: data.kind === null },
    ...KINDS.map((k) => ({ href: withParams(page.url, { kind: k }), label: kindLabel(k), current: data.kind === k }))
  ]);
  const items = $derived(
    data.subjects.ok ? subjectItems(data.subjects.data.subjects, subjectName, (k) => `/stats/subject/${encodeURIComponent(k)}`) : []
  );
</script>

<PageHead
  path="~/stats"
  cmd="ls"
  args="types/ subjects/"
  title="stats"
  lede="The network keeps a ledger of everything you do."
  note="Every stat the network knows. New ones appear when someone first records them, so this list is never fixed. Pick a type for its subjects, or a subject for every board it is on."
/>

<Window path="~/stats/types" label="Types">
  <WindowHead title="Types" asof={data.types.ok && !data.types.empty ? `${group(data.types.data.types.length)} ${data.types.data.types.length === 1 ? "type" : "types"}` : undefined} />
  {#if !data.types.ok}
    <Notice kind="warning"><b>cakeutils could not be reached.</b> The catalogue will be back when it is.</Notice>
  {:else if data.types.empty}
    <EmptyState title="Nothing recorded yet" line="Stat types show up once a server sends its first stats." />
  {:else}
    <div class="stat-panel fx-tiles">
      {#each data.types.data.types as t (t.key)}
        {@const n = data.typeCounts[t.key]}
        <a href="/stats/{encodeURIComponent(t.key)}">
          <span class="kv_label">{typeLabel(t.key, t.name)}</span>
          <span class="kv_value num">{n === undefined ? "—" : group(n)}<small>{n === 1 ? "subject" : "subjects"}</small></span>
          {#if t.kind}<span class="note">{t.kind}</span>{/if}
        </a>
      {/each}
    </div>
  {/if}
</Window>

<Window path="~/stats/subjects" args="| grep" label="Subjects">
  <WindowHead title="Subjects" asof={data.subjects.ok && !data.subjects.empty ? `${group(data.subjects.data.total)} ${data.subjects.data.total === 1 ? "subject" : "subjects"}` : undefined} />
  <div class="fx-filters" style="margin-bottom: 16px">
    <form action="/stats" method="get" role="search" style="display: contents">
      <label class="fx-search"><span class="c4">»</span><input type="search" name="q" value={data.q} placeholder="search subjects" aria-label="Search subjects" maxlength="64" autocomplete="off" /></label>
      {#if data.kind}<input type="hidden" name="kind" value={data.kind} />{/if}
    </form>
    <Segmented label="Kind" options={kindOptions} />
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
        <a class="ink c5" href="/stats">clear filters</a>
      </EmptyState>
    {:else}
      <EmptyState title="Nothing recorded yet" line="Subjects show up once someone mines, crafts or kills something." />
    {/if}
  {:else}
    <Catalogue {items} pic label="Subjects" />
    <Pager url={page.url} total={data.subjects.data.total} limit={data.limit} offset={data.offset} what="subjects" />
  {/if}
</Window>
