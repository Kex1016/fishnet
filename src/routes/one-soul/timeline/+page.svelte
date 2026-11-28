<script lang="ts">
  import { page } from "$app/state";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import Segmented from "#lib/design/Segmented.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import EventRow from "#lib/onesoul/EventRow.svelte";
  import OsTabs from "#lib/onesoul/OsTabs.svelte";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();
  const SHOW = [
    ["deaths", "deaths"],
    ["souls", "souls"],
    ["graves", "graves"],
    ["thresholds", "Nether and End"],
    ["round", "the round"],
    ["ghosts", "ghosts"]
  ];
</script>

<PageHead path="~/one-soul" cmd="tail" args="timeline.log" title="timeline" lede="Sign-ups, souls, deaths, graves and the first steps into the Nether and the End, newest first.">
  <OsTabs />
  <div class="fx-filters">
    {#if data.rounds.length > 1}
      <Segmented label="Round" options={data.rounds.map((r: number) => ({ href: withParams(page.url, { round: String(r) }), label: `round ${r}`, current: r === data.round }))} />
    {/if}
    {#if data.osFeatures.tracking}
      <Segmented label="Show" options={[{ href: withParams(page.url, { show: null }), label: "everything", current: data.show === null }, ...SHOW.map(([k, l]) => ({ href: withParams(page.url, { show: k }), label: l, current: data.show === k }))]} />
    {/if}
  </div>
</PageHead>

{#if !data.events || !data.events.ok}
  <Notice kind="warning">The timeline could not be loaded right now.</Notice>
{:else if data.events.data.events.length === 0}
  <EmptyState title="Nothing has happened yet" line="Sign-ups, souls, deaths and graves show up here as they happen." />
{:else}
  <Window path="~/one-soul/timeline" args={data.show ? `--show ${data.show}` : undefined}>
    <WindowHead title="Events"><AsOf at={data.events.asOf} stale={data.events.stale} /></WindowHead>
    <div class="fx-feed">
      {#each data.events.data.events as e, i (i)}<EventRow {e} now={data.events.asOf} />{/each}
    </div>
    <Pager url={page.url} total={data.events.data.total} limit={data.limit} offset={data.offset} what="events" prev="newer" next="older" />
  </Window>
{/if}
