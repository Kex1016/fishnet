<script lang="ts">
  import { page } from "$app/state";
  import Catalogue from "#lib/design/Catalogue.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import RankList from "#lib/design/RankList.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import { boardHref } from "#lib/api/metric.ts";
  import { group } from "#lib/format/stat-display.ts";
  import { subjectName } from "#lib/players/names.ts";
  import { rankRows } from "#lib/boards.ts";
  import { subjectItems } from "../kinds.ts";
  let { data } = $props();
  const lede = $derived(
    data.mixed
      ? "Custom stats count different things: blocks, centimetres, ticks. There is no board for all of them together, so pick one below."
      : !data.unknown && !data.down
        ? `Every subject recorded under ${data.label.toLowerCase()}, and the players ahead on all of them together.`
        : undefined
  );
  const items = $derived(
    data.subjects?.ok ? subjectItems(data.subjects.data.subjects, subjectName, (k) => boardHref({ kind: "stat", type: data.key, subject: k }), false) : []
  );
</script>

<PageHead path="~/stats" cmd="ls" args={data.key} title={data.label} {lede}>
  <div class="fx-filters"><a class="ink c5" href="/stats">all stats</a></div>
</PageHead>

{#if data.down}
  <Notice kind="warning"><b>cakeutils could not be reached.</b> This type will be back when it is.</Notice>
{:else if data.unknown}
  <EmptyState title="Nobody has done this yet" line="{data.label} appears in the catalogue as soon as someone records it." />
{:else}
  {#if data.total?.ok && !data.total.empty}
    <Window path="~/leaderboards" args="--top 5" label="{data.label} total">
      <WindowHead title="{data.label} total" href={boardHref({ kind: "stat", type: data.key, subject: "*" })}>
        {#if data.total.stale}<AsOf at={data.total.asOf} stale />{:else}<span class="num">network · top {data.total.data.entries.length} of {group(data.total.data.total)}</span>{/if}
      </WindowHead>
      <RankList rows={rankRows(data.total.data.entries)} label="{data.label} total, network" />
    </Window>
  {/if}

  <Window path="~/stats" args="| grep" label="Subjects">
    <WindowHead title="Subjects" asof={data.subjects?.ok && !data.subjects.empty ? `${group(data.subjects.data.total)} ${data.subjects.data.total === 1 ? "subject" : "subjects"}` : undefined} />
    <form action={page.url.pathname} method="get" role="search" class="fx-filters" style="margin-bottom: 16px">
      <label class="fx-search"><span class="c4">»</span><input type="search" name="q" value={data.q} placeholder="search {data.label.toLowerCase()}" aria-label="Search subjects" maxlength="64" autocomplete="off" /></label>
    </form>
    {#if !data.subjects?.ok}
      <Notice kind="warning"><b>cakeutils could not be reached.</b> Subjects will be back when it is.</Notice>
    {:else if data.subjects.empty}
      {#if data.q}
        <EmptyState title="No subjects match" line="Nothing under {data.label.toLowerCase()} matches “{data.q}”."><a class="ink c5" href={page.url.pathname}>clear search</a></EmptyState>
      {:else}
        <EmptyState title="Nothing recorded under this type yet" />
      {/if}
    {:else}
      <Catalogue {items} pic label="Subjects" />
      <Pager url={page.url} total={data.subjects.data.total} limit={data.limit} offset={data.offset} what="subjects" />
    {/if}
  </Window>
{/if}
