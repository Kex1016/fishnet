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
  import OsTabs from "#lib/onesoul/OsTabs.svelte";
  import Outcome from "#lib/onesoul/Outcome.svelte";
  import { life, dimLabel } from "#lib/onesoul/format.ts";
  import { osHref } from "#lib/onesoul/links.ts";
  import { day } from "#lib/format/dates.ts";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();
  const souls = $derived(data.souls);
</script>

<PageHead path="~/one-soul" cmd="cat" args="chronicle.md" title="chronicle" lede="Every soul that has had a turn, in the order they played. Who plays next is a secret, and stays one.">
  <OsTabs />
  <div class="fx-filters">
    {#if data.rounds.length > 1}
      <Segmented label="Round" options={data.rounds.map((r: number) => ({ href: withParams(page.url, { round: String(r) }), label: `round ${r}`, current: r === data.round }))} />
    {/if}
    {#if data.osFeatures.tracking}
      <Segmented
        label="Order"
        options={[
          { href: withParams(page.url, { sort: null }), label: "by turn", current: data.sort === "turn" },
          { href: withParams(page.url, { sort: "duration" }), label: "longest first", current: data.sort === "duration" }
        ]}
      />
    {/if}
  </div>
</PageHead>

{#if !souls || !souls.ok}
  <Notice kind="warning">The chronicle could not be loaded right now.</Notice>
{:else if souls.data.souls.length === 0}
  <EmptyState title="No soul has played in this round yet" line="The first soul's turn starts when the world opens." />
{:else}
  <Window path="~/one-soul/chronicle" args={data.round ? `--round ${data.round}` : undefined}>
    <WindowHead title="Every soul">{#if souls.ok}<AsOf at={souls.asOf} stale={souls.stale} />{/if}</WindowHead>
    <div class="fx-scroll">
      <table class="fx-table">
        <thead>
          <tr><th scope="col" class="r">Turn</th><th scope="col">Soul</th><th scope="col" class="r">Lived</th><th scope="col">Outcome</th><th scope="col">How it ended</th><th scope="col"><span class="visually-hidden">Journal</span></th></tr>
        </thead>
        <tbody>
          {#each souls.data.souls as s (`${s.cycle}-${s.turn}`)}
            <tr>
              <td class="r">{s.turn}</td>
              <td><a class="lnk" href={osHref.soul(s.cycle, s.turn)}>{s.name}</a><span class="os-since">{day(s.started_at)}</span></td>
              <td class="r">{s.duration_ms === null ? "playing" : life(s.duration_ms)}</td>
              <td><Outcome outcome={s.outcome} /></td>
              <td class="os-cause">
                {#if s.cause}<q>{s.cause}</q>{/if}
                {#if s.death && s.outcome !== "playing"}<span class="os-since">{dimLabel(s.death.dim)}</span>{/if}
                {#if s.second_chance}<span class="os-since">had a second chance</span>{/if}
              </td>
              <td>{#if s.has_journal}<a class="lnk i" href={osHref.journal(s.cycle, s.turn)} aria-label="Read {s.name}'s journal">journal</a>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <Pager url={page.url} total={souls.data.total} limit={data.limit} offset={data.offset} what="souls" />
  </Window>
{/if}

<style>
  .os-since {
    display: block;
    font-size: 12px;
    color: var(--ink-muted);
  }
  .os-cause {
    white-space: normal;
    min-width: 22ch;
    max-width: 52ch;
    overflow-wrap: anywhere;
  }
  td {
    vertical-align: top;
  }
</style>
